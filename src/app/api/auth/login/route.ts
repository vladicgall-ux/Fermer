import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { clientIp, readJson } from '@/lib/api'
import { sql } from '@/lib/db'
import { dummyHash, verifyPassword } from '@/lib/password'
import { hitRateLimit, LIMITS } from '@/lib/rate-limit'
import { createSession, setSessionCookie } from '@/lib/session'
import type { User } from '@/lib/types'
import { loginSchema } from '@/lib/validation'

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

// Вход по логину и паролю. Лимиты попыток — по IP и по логину (защита от перебора).
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const { login, password } = loginSchema.parse(await readJson(req))
    const retryAfter = await hitRateLimit([
      { key: `ip:${ip}`, limit: LIMITS.ip },
      { key: `login-ip:${ip}`, limit: LIMITS.login },
      { key: `login:${login.toLowerCase()}`, limit: LIMITS.login },
    ])
    if (retryAfter !== null) return fail(429, 'Слишком много попыток, подождите минуту')

    const db = sql()
    const [row] = await db<(User & { password_hash: string })[]>`
      select u.*, c.password_hash
      from user_credentials c join users u on u.id = c.user_id
      where lower(c.login) = lower(${login})
    `
    const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash()))
    if (!row || !ok) return fail(401, 'Неверный логин или пароль')

    const { password_hash: _omit, ...user } = row
    void _omit
    const token = await createSession(user.id)
    const res = NextResponse.json({ user, login }, { headers: { 'Cache-Control': 'no-store' } })
    setSessionCookie(res, token)
    return res
  } catch (e) {
    if (e instanceof ZodError) return fail(400, 'Введите логин и пароль')
    if (e instanceof SyntaxError) return fail(400, 'bad json')
    console.error(e)
    return fail(500, 'internal error')
  }
}
