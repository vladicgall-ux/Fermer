import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { sql } from './db'
import type { User } from './types'

/**
 * Сессии для входа без Telegram (обычный браузер).
 * В cookie лежит случайный токен (256 бит), в БД — только его SHA-256.
 * Cookie: HttpOnly, SameSite=Lax, Secure в production; срок продлевается при использовании.
 */
export const SESSION_COOKIE = 'fermer_session'
const TTL_DAYS = 365

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await sql()`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, now() + ${`${TTL_DAYS} days`}::interval)
  `
  return token
}

export async function sessionUser(token: string): Promise<User | null> {
  if (!isWellFormedToken(token)) return null
  const db = sql()
  const hash = hashToken(token)
  const [user] = await db<User[]>`
    select u.* from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash} and s.expires_at > now()
  `
  if (!user) return null
  // Скользящий срок: продлеваем не чаще раза в сутки, чтобы не писать в БД на каждый запрос.
  db`
    update sessions set last_seen_at = now(), expires_at = now() + ${`${TTL_DAYS} days`}::interval
    where token_hash = ${hash} and last_seen_at < now() - interval '1 day'
  `.catch(() => {})
  return user
}

export async function deleteSession(token: string): Promise<void> {
  if (!isWellFormedToken(token)) return
  await sql()`delete from sessions where token_hash = ${hashToken(token)}`
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_DAYS * 24 * 3600,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}
