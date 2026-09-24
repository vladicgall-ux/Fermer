import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { sql } from './db'
import { hitRateLimit, LIMITS, type RateLimitKey } from './rate-limit'
import { hashToken, SESSION_COOKIE, sessionUser } from './session'
import { displayName, validateInitData, type TelegramUser } from './telegram-auth'
import type { User } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface Ctx {
  user: User
  isAdmin: boolean
  /** Данные из проверенного initData; null — вход из браузера по сессии. */
  tg: TelegramUser | null
}

interface HandleOpts {
  /** Только для role = 'admin'. */
  admin?: boolean
  /** Изменяющий запрос — отдельный, более строгий лимит. */
  write?: boolean
}

const DEFAULT_MAX_AGE_SEC = 24 * 60 * 60

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return ip.slice(0, 64)
}

function maxAgeSec(): number {
  const v = Number(process.env.INITDATA_MAX_AGE_SEC)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_AGE_SEC
}

function bootstrapAdminIds(): Set<number> {
  return new Set(
    (process.env.ADMIN_TELEGRAM_IDS ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isSafeInteger(n) && n > 0),
  )
}

export function isBootstrapAdmin(telegramId: number | null): boolean {
  return telegramId !== null && bootstrapAdminIds().has(telegramId)
}

async function upsertUser(tg: TelegramUser): Promise<User> {
  const db = sql()
  const name = displayName(tg)
  const username = tg.username?.slice(0, 64) ?? null
  const bootstrap = isBootstrapAdmin(tg.id)

  const [row] = await db<User[]>`
    with ins as (
      insert into users (telegram_id, name, username, role)
      values (${tg.id}, ${name}, ${username}, ${bootstrap ? 'admin' : 'worker'})
      on conflict (telegram_id) do nothing
      returning *
    )
    select * from ins
    union all
    select * from users where telegram_id = ${tg.id}
    limit 1
  `
  if (!row) throw new ApiError(500, 'user upsert failed')

  const needsRole = bootstrap && row.role !== 'admin'
  // Имя, заданное пользователем вручную, не перезаписываем именем из Telegram.
  const nextName = row.name_custom ? row.name : name
  if (row.name !== nextName || row.username !== username || needsRole) {
    const [updated] = await db<User[]>`
      update users
      set name = ${nextName}, username = ${username}, role = ${needsRole ? 'admin' : row.role}
      where id = ${row.id}
      returning *
    `
    return updated
  }
  return row
}

/**
 * Обёртка для всех API-обработчиков:
 * аутентификация (Telegram initData или cookie-сессия, fail-closed) → rate limit →
 * пользователь из БД → проверка роли.
 */
export function handle<P = Record<string, never>>(
  opts: HandleOpts,
  fn: (req: NextRequest, ctx: Ctx, params: P) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, route: { params: Promise<P> }): Promise<Response> => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) {
        console.error('TELEGRAM_BOT_TOKEN is not configured')
        return json({ error: 'server misconfigured' }, 503)
      }

      // Внутри Telegram клиент присылает initData; в обычном браузере — cookie сессии.
      const auth = req.headers.get('authorization') ?? ''
      const initData = auth.startsWith('tma ') ? auth.slice(4) : ''
      const tgResult = initData ? validateInitData(initData, botToken, { maxAgeSec: maxAgeSec() }) : null
      const sessionToken = tgResult ? '' : (req.cookies.get(SESSION_COOKIE)?.value ?? '')

      // Лимит по пользователю считается до обращения к БД: по id Telegram или по хэшу токена сессии.
      const subject = tgResult?.ok
        ? `u:${tgResult.user.id}`
        : sessionToken
          ? `s:${hashToken(sessionToken).slice(0, 32)}`
          : null
      const keys: RateLimitKey[] = [{ key: `ip:${clientIp(req)}`, limit: LIMITS.ip }]
      if (subject) {
        keys.push({ key: subject, limit: LIMITS.user })
        if (opts.write) keys.push({ key: `w${subject}`, limit: LIMITS.userWrite })
      }
      const retryAfter = await hitRateLimit(keys)
      if (retryAfter !== null) {
        return json({ error: 'too many requests' }, 429, { 'Retry-After': String(retryAfter) })
      }

      let user: User | null = null
      let tg: TelegramUser | null = null
      if (tgResult) {
        if (!tgResult.ok) return json({ error: 'unauthorized' }, 401)
        tg = tgResult.user
        user = await upsertUser(tg)
      } else if (sessionToken) {
        user = await sessionUser(sessionToken)
      }
      if (!user) return json({ error: 'unauthorized' }, 401)

      const isAdmin = user.role === 'admin'
      if (opts.admin && !isAdmin) return json({ error: 'forbidden' }, 403)

      const out = await fn(req, { user, isAdmin, tg }, await route.params)
      return out instanceof Response ? out : json(out)
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status)
      if (e instanceof ZodError) return json({ error: 'validation error', issues: e.issues }, 400)
      if (e instanceof SyntaxError) return json({ error: 'bad json' }, 400)
      console.error(e)
      return json({ error: 'internal error' }, 500)
    }
  }
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > 16 * 1024) throw new ApiError(413, 'payload too large')
  const text = await req.text()
  if (text.length > 16 * 1024) throw new ApiError(413, 'payload too large')
  return JSON.parse(text)
}

export function parseId(raw: string): number {
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'bad id')
  return id
}
