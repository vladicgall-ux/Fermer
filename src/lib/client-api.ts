'use client'

import { getInitData } from './telegram'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const MESSAGES: Record<number, string> = {
  401: 'Не удалось подтвердить вход через Telegram. Перезапустите приложение.',
  403: 'Недостаточно прав',
  429: 'Слишком много запросов, подождите минуту',
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const initData = getInitData()
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    // В Telegram — initData в заголовке; в обычном браузере — cookie сессии (same-origin).
    headers: {
      ...(initData ? { Authorization: `tma ${initData}` } : {}),
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'same-origin',
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const custom = res.status === 409 || (res.status === 400 && /[а-яё]/i.test(String(data?.error ?? '')))
    const msg = typeof data?.error === 'string' && custom ? data.error : MESSAGES[res.status]
    throw new HttpError(res.status, msg ?? `Ошибка сервера (${res.status})`)
  }
  return data as T
}
