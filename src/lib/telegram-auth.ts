import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: number }
  | { ok: false; reason: string }

const HASH_RE = /^[0-9a-f]{64}$/
const MAX_INIT_DATA_LENGTH = 4096

/**
 * Проверяет Telegram Mini App initData по алгоритму
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 * hash       = hex(HMAC_SHA256(key = secret_key, data = data_check_string))
 *
 * Любая ошибка разбора/проверки — отказ (fail-closed).
 */
export function validateInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeSec: number; nowSec?: number },
): InitDataResult {
  if (!botToken) return { ok: false, reason: 'bot token is not configured' }
  if (!initData || initData.length > MAX_INIT_DATA_LENGTH) return { ok: false, reason: 'bad initData' }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return { ok: false, reason: 'bad initData' }
  }

  const seen = new Set<string>()
  const pairs: string[] = []
  let hash: string | null = null
  for (const [key, value] of params) {
    if (seen.has(key)) return { ok: false, reason: 'duplicate key' }
    seen.add(key)
    if (key === 'hash') hash = value
    else pairs.push(`${key}=${value}`)
  }
  if (!hash || !HASH_RE.test(hash)) return { ok: false, reason: 'missing hash' }

  pairs.sort()
  const dataCheckString = pairs.join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const received = Buffer.from(hash, 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'invalid hash' }
  }

  const authDate = Number(params.get('auth_date'))
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000)
  if (!Number.isInteger(authDate) || authDate <= 0) return { ok: false, reason: 'bad auth_date' }
  if (authDate > now + 60) return { ok: false, reason: 'auth_date in the future' }
  if (now - authDate > opts.maxAgeSec) return { ok: false, reason: 'initData expired' }

  const rawUser = params.get('user')
  if (!rawUser) return { ok: false, reason: 'no user' }
  let user: unknown
  try {
    user = JSON.parse(rawUser)
  } catch {
    return { ok: false, reason: 'bad user' }
  }
  if (!isTelegramUser(user)) return { ok: false, reason: 'bad user' }

  return { ok: true, user, authDate }
}

function isTelegramUser(u: unknown): u is TelegramUser {
  if (typeof u !== 'object' || u === null) return false
  const r = u as Record<string, unknown>
  return (
    typeof r.id === 'number' &&
    Number.isSafeInteger(r.id) &&
    r.id > 0 &&
    typeof r.first_name === 'string' &&
    (r.last_name === undefined || typeof r.last_name === 'string') &&
    (r.username === undefined || typeof r.username === 'string')
  )
}

/** Строит подписанный initData — используется в тестах и скрипте dev:initdata. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(pairs.join('\n')).digest('hex')
  const params = new URLSearchParams(fields)
  params.set('hash', hash)
  return params.toString()
}

// Невидимые символы, которыми часто «очищают» имя в Telegram (Hangul filler, пустой Брайль, zero-width).
const INVISIBLE_RE = /[\p{Cf}ᅟᅠㅤﾠ⠀]/gu

export function cleanName(s: string | undefined): string {
  return (s ?? '').replace(INVISIBLE_RE, '').replace(/\s+/g, ' ').trim()
}

export function displayName(u: TelegramUser): string {
  const name = [cleanName(u.first_name), cleanName(u.last_name)].filter(Boolean).join(' ')
  return (name || (u.username ? `@${u.username}` : '') || `Пользователь ${u.id}`).slice(0, 128)
}
