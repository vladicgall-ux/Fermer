'use client'

import { useState } from 'react'
import { api } from '@/lib/client-api'
import { alertDialog, haptic } from '@/lib/telegram'
import type { User } from '@/lib/types'

export default function ProfileTab({ me, onChanged }: { me: User; onChanged: (u: User) => void }) {
  const [name, setName] = useState(me.name)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const trimmed = name.trim()
  const valid = trimmed.length >= 2 && trimmed.length <= 64

  const save = async (value: string | null) => {
    setBusy(true)
    try {
      const r = await api<{ user: User }>('/api/me', { method: 'PATCH', body: { name: value } })
      setName(r.user.name)
      setSaved(true)
      onChanged(r.user)
      haptic('success')
    } catch (e) {
      haptic('error')
      await alertDialog((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Профиль</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy && trimmed !== me.name) save(trimmed)
        }}
      >
        <div className="field">
          <label htmlFor="name">Имя — так вас видят в отметках и статистике</label>
          <input
            id="name"
            type="text"
            value={name}
            maxLength={64}
            autoComplete="name"
            placeholder="Например, Иван Петров"
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
          />
        </div>
        <button type="submit" className="btn primary full" disabled={!valid || busy || trimmed === me.name}>
          {busy ? 'Сохранение…' : 'Сохранить имя'}
        </button>
        {saved && <p className="hint">✓ Сохранено</p>}
      </form>

      {me.name_custom && (
        <button className="link-btn" disabled={busy} onClick={() => save(null)}>
          Вернуть имя из Telegram
        </button>
      )}

      <dl className="props">
        <dt>Роль</dt>
        <dd>{me.role === 'admin' ? 'Администратор' : 'Рабочий'}</dd>
        {me.username && (
          <>
            <dt>Telegram</dt>
            <dd>@{me.username}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
