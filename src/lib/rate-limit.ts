import 'server-only'
import { sql } from './db'

export const WINDOW_SEC = 60

/** Лимиты на окно WINDOW_SEC. */
export const LIMITS = {
  ip: 300, // все запросы с одного IP, включая неавторизованные
  user: 120, // все запросы одного пользователя
  userWrite: 30, // изменяющие запросы одного пользователя
  login: 10, // попыток входа по паролю с одного IP и на один логин
} as const

export interface RateLimitKey {
  key: string
  limit: number
}

/**
 * Фиксированное окно в Postgres: счётчик общий для всех serverless-инстансов.
 * Возвращает число секунд до сброса, если лимит превышен, иначе null.
 */
export async function hitRateLimit(keys: RateLimitKey[]): Promise<number | null> {
  const nowSec = Math.floor(Date.now() / 1000)
  const windowStartSec = nowSec - (nowSec % WINDOW_SEC)
  const windowStart = new Date(windowStartSec * 1000)
  const db = sql()

  const rows = await db<{ key: string; count: number }[]>`
    insert into rate_limits ${db(keys.map((k) => ({ key: k.key, window_start: windowStart, count: 1 })))}
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning key, count
  `

  if (Math.random() < 0.01) {
    db`delete from rate_limits where window_start < now() - interval '10 minutes'`.catch(() => {})
  }

  const limitByKey = new Map(keys.map((k) => [k.key, k.limit]))
  const exceeded = rows.some((r) => r.count > (limitByKey.get(r.key) ?? 0))
  return exceeded ? windowStartSec + WINDOW_SEC - nowSec : null
}
