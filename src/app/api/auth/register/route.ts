import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { ApiError, clientIp, readJson } from '@/lib/api'
import { setCredentials } from '@/lib/credentials'
import { sql } from '@/lib/db'
import { hitRateLimit, LIMITS } from '@/lib/rate-limit'
import { createSession, setSessionCookie } from '@/lib/session'
import type { User } from '@/lib/types'
import { registerSchema } from '@/lib/validation'

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

// Регистрация без Telegram: имя + логин + пароль. Создаёт рабочего и открывает сессию (cookie).
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const retryAfter = await hitRateLimit([
      { key: `ip:${ip}`, limit: LIMITS.ip },
      { key: `reg:${ip}`, limit: LIMITS.register },
    ])
    if (retryAfter !== null) return fail(429, 'too many requests')

    const { name, login, password } = registerSchema.parse(await readJson(req))

    const user = await sql().begin(async (tx) => {
      const [row] = await tx<User[]>`
        insert into users (telegram_id, name, username, role, name_custom, kind)
        values (null, ${name}, null, 'worker', true, 'web')
        returning *
      `
      await setCredentials(tx, row.id, login, password)
      await tx`
        insert into audit_log (entity, entity_id, action, actor_id, after)
        values ('user', ${row.id}, 'create', ${row.id}, ${tx.json({ name: row.name, via: 'web' })})
      `
      return row
    })

    const token = await createSession(user.id)
    const res = NextResponse.json({ user, login }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    setSessionCookie(res, token)
    return res
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.message)
    if (e instanceof ZodError) return fail(400, e.issues[0]?.message ?? 'validation error')
    if (e instanceof SyntaxError) return fail(400, 'bad json')
    console.error(e)
    return fail(500, 'internal error')
  }
}
