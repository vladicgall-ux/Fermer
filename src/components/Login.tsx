'use client'

import { useState } from 'react'
import { api } from '@/lib/client-api'
import type { User } from '@/lib/types'

// Вход без Telegram — только по логину и паролю. Учётные записи выдаёт администратор.
// Сессия хранится в HttpOnly-cookie и переживает перезапуск браузера.
export default function Login({ onDone }: { onDone: (u: User) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = login.trim().length > 0 && password.length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: { login: login.trim(), password },
      })
      onDone(r.user)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="splash auth">
      <div className="splash-icon">🌾</div>
      <h1>Fermer</h1>
      <p className="hint">Учёт заготовки сена</p>

      <form className="register" onSubmit={submit}>
        <div className="field">
          <label htmlFor="login">Логин</label>
          <input
            id="login"
            type="text"
            value={login}
            maxLength={32}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Ваш логин"
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            value={password}
            maxLength={128}
            autoComplete="current-password"
            placeholder="Ваш пароль"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn primary full" disabled={!valid || busy}>
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
      <p className="hint">
        Логин и пароль выдаёт администратор. Также можно открыть приложение через бота в Telegram.
      </p>
    </div>
  )
}
