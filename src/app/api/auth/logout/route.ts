import { NextResponse, type NextRequest } from 'next/server'
import { clientIp } from '@/lib/api'
import { hitRateLimit, LIMITS } from '@/lib/rate-limit'
import { clearSessionCookie, deleteSession, SESSION_COOKIE } from '@/lib/session'

export async function POST(req: NextRequest) {
  const retryAfter = await hitRateLimit([{ key: `ip:${clientIp(req)}`, limit: LIMITS.ip }])
  if (retryAfter !== null) return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) await deleteSession(token)
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  clearSessionCookie(res)
  return res
}
