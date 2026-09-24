import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Короткоживущая подписанная ссылка на CSV. Нужна, потому что Telegram.WebApp.downloadFile
 * и обычная навигация не могут передать заголовок Authorization с initData.
 * Роль пользователя в токен не кладётся — она перечитывается из БД при скачивании.
 */
export interface ExportPayload {
  u: number // users.id
  from: string
  to: string
  tz: string
  w?: number // фильтр по рабочему (только для админа)
  exp: number // unix seconds
}

function key(botToken: string): Buffer {
  return createHmac('sha256', botToken).update('fermer-export-v1').digest()
}

export function signExportToken(p: ExportPayload, botToken: string): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url')
  const sig = createHmac('sha256', key(botToken)).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyExportToken(
  token: string,
  botToken: string,
  nowSec = Math.floor(Date.now() / 1000),
): ExportPayload | null {
  if (!botToken || !token || token.length > 1024) return null
  const [body, sig, ...rest] = token.split('.')
  if (!body || !sig || rest.length) return null
  const expected = createHmac('sha256', key(botToken)).update(body).digest()
  const received = Buffer.from(sig, 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ExportPayload
    if (typeof p.exp !== 'number' || p.exp < nowSec) return null
    if (!Number.isSafeInteger(p.u)) return null
    return p
  } catch {
    return null
  }
}

/** Экранирование ячейки CSV (разделитель «;») с защитой от CSV/formula injection. */
export function csvCell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
