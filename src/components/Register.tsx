'use client'

import { useState } from 'react'
import { api } from '@/lib/client-api'
import type { User } from '@/lib/types'

type Mode = 'login' | 'register'

// Вход без Telegram: по логину и паролю либо регистрация (имя + логин + пароль).
// Сессия хранится в HttpOnly-cookie и переживает перезапуск браузера.
export default function Register({ onDone }: { onDone: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>('register')
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid =
    mode === 'login'
      ? login.trim().length > 0 && password.length > 0
      : name.trim().length >= 2 && login.trim().length >= 3 && password.length >= 6

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const r =
        mode === 'login'
          ? await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { login: login.trim(), password } })
          : await api<{ user: User }>('/api/auth/register', {
              method: 'POST',
              body: { name: name.trim(), login: login.trim(), password },
            })
      onDone(r.user)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
  }

  return (
    <div className="splash auth">
      <div className="splash-icon">🌾</div>
      <h1>Fermer</h1>
      <p className="hint">Учёт заготовки сена</p>

      <div className="segmented auth-tabs">
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
          Регистрация
        </button>
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
          Вход
        </button>
      </div>

      <form className="register" onSubmit={submit}>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="reg-name">Как вас зовут?</label>
            <input
              id="reg-name"
              type="text"
              value={name}
              maxLength={64}
              autoComplete="name"
              placeholder="Имя и фамилия"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="reg-login">Логин</label>
          <input
            id="reg-login"
            type="text"
            value={login}
            maxLength={32}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={mode === 'register' ? 'Придумайте логин' : 'Ваш логин'}
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="reg-password">Пароль</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            maxLength={128}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder={mode === 'register' ? 'Не короче 6 символов' : 'Ваш пароль'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn primary full" disabled={!valid || busy}>
          {busy ? 'Подождите…' : mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>
      <p className="hint">
        Вход запомнится в этом браузере. С логином и паролем можно войти с любого устройства. Также можно
        открыть приложение через бота в Telegram.
      </p>
    </div>
  )
}
