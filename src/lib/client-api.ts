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
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `tma ${getInitData()}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data?.error === 'string' && res.status === 409 ? data.error : MESSAGES[res.status]
    throw new HttpError(res.status, msg ?? `Ошибка сервера (${res.status})`)
  }
  return data as T
}
