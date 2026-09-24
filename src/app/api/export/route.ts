import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { clientIp } from '@/lib/api'
import { sql } from '@/lib/db'
import { csvCell, verifyExportToken } from '@/lib/export-token'
import { hitRateLimit, LIMITS } from '@/lib/rate-limit'
import { getMarksInRange } from '@/lib/stats'
import type { User } from '@/lib/types'
import { rangeSchema } from '@/lib/validation'

const deny = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) return deny(503, 'server misconfigured')

    const retryAfter = await hitRateLimit([{ key: `ip:${clientIp(req)}`, limit: LIMITS.ip }])
    if (retryAfter !== null) return deny(429, 'too many requests')

    const p = verifyExportToken(req.nextUrl.searchParams.get('t') ?? '', botToken)
    if (!p) return deny(401, 'invalid or expired link')

    const db = sql()
    const [user] = await db<User[]>`select * from users where id = ${p.u}`
    if (!user) return deny(401, 'unauthorized')

    const range = rangeSchema.parse({ from: p.from, to: p.to, tz: p.tz, worker_id: p.w })
    const marks = await getMarksInRange(db, range)

    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: range.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    const header = ['ID', 'Дата', 'Рабочий', 'Рулонов', 'Широта', 'Долгота', 'Создал', 'Изменил', 'Изменено']
    const lines = [header.join(';')]
    for (const m of marks) {
      lines.push(
        [
          m.id,
          fmt.format(new Date(m.date)),
          m.worker_name,
          m.bales_count,
          m.lat.toFixed(6),
          m.lng.toFixed(6),
          m.created_by_name,
          m.updated_by_name ?? '',
          m.updated_at ? fmt.format(new Date(m.updated_at)) : '',
        ]
          .map(csvCell)
          .join(';'),
      )
    }
    const total = marks.reduce((s, m) => s + m.bales_count, 0)
    lines.push(['', 'Итого', '', total, '', '', '', '', ''].map(csvCell).join(';'))

    // BOM — чтобы Excel корректно открыл UTF-8.
    const body = '﻿' + lines.join('\r\n') + '\r\n'
    const filename = `fermer_${range.from}_${range.to}.csv`
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    if (e instanceof ZodError) return deny(400, 'bad request')
    console.error(e)
    return deny(500, 'internal error')
  }
}
