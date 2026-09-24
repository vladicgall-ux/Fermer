'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import { PALETTES, setPaletteId, usePalette } from '@/lib/palettes'
import { alertDialog, confirmDialog, haptic, inTelegram } from '@/lib/telegram'
import type { User } from '@/lib/types'

interface Props {
  me: User
  onChanged: (u: User) => void
  onLogout: () => void
}

export default function ProfileTab({ me, onChanged, onLogout }: Props) {
  const fromTelegram = inTelegram()
  const palette = usePalette()
  const [name, setName] = useState(me.name)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // Логин/пароль для входа через браузер.
  const [login, setLogin] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [newLogin, setNewLogin] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [credSaved, setCredSaved] = useState(false)

  useEffect(() => {
    api<{ login: string | null }>('/api/me')
      .then((r) => {
        setLogin(r.login)
        setNewLogin(r.login ?? '')
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const trimmed = name.trim()
  const valid = trimmed.length >= 2 && trimmed.length <= 64
  const needCurrent = login !== null && !fromTelegram
  const credValid =
    newLogin.trim().length >= 3 && password.length >= 6 && (!needCurrent || currentPassword.length > 0)

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

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credValid || busy) return
    setBusy(true)
    try {
      const r = await api<{ login: string }>('/api/me/credentials', {
        method: 'PUT',
        body: {
          login: newLogin.trim(),
          password,
          ...(needCurrent ? { current_password: currentPassword } : {}),
        },
      })
      setLogin(r.login)
      setPassword('')
      setCurrentPassword('')
      setCredSaved(true)
      haptic('success')
    } catch (err) {
      haptic('error')
      await alertDialog((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    const msg =
      login !== null
        ? 'Выйти из аккаунта на этом устройстве?'
        : 'Выйти? Логин и пароль не заданы — вернуться в этот аккаунт будет нельзя.'
    if (!(await confirmDialog(msg))) return
    setBusy(true)
    try {
      await api('/api/auth/logout', { method: 'POST' })
      onLogout()
    } catch (e) {
      await alertDialog((e as Error).message)
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

      {me.name_custom && me.telegram_id !== null && fromTelegram && (
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

      <h2>Цвета меток на карте</h2>
      <p className="hint">У каждого рабочего своя метка. Выберите палитру — она сохранится на этом устройстве.</p>
      <div className="palette-list">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`palette-option${palette.id === p.id ? ' active' : ''}`}
            onClick={() => {
              setPaletteId(p.id)
              haptic('light')
            }}
          >
            <b>
              {palette.id === p.id ? '✓ ' : ''}
              {p.name}
            </b>
            <span className="hint"> — {p.hint}</span>
            <span className="palette-swatches">
              {p.colors.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
          </button>
        ))}
      </div>

      <h2>Вход через браузер</h2>
      {loaded && (
        <form onSubmit={saveCredentials}>
          <p className="hint">
            {login
              ? `Ваш логин: ${login}. Здесь можно сменить логин или пароль.`
              : 'Задайте логин и пароль, чтобы входить в приложение из браузера с любого устройства.'}
          </p>
          <div className="field">
            <label htmlFor="cred-login">Логин</label>
            <input
              id="cred-login"
              type="text"
              value={newLogin}
              maxLength={32}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setNewLogin(e.target.value)
                setCredSaved(false)
              }}
            />
          </div>
          {needCurrent && (
            <div className="field">
              <label htmlFor="cred-current">Текущий пароль</label>
              <input
                id="cred-current"
                type="password"
                value={currentPassword}
                maxLength={128}
                autoComplete="current-password"
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="cred-password">{login ? 'Новый пароль' : 'Пароль'}</label>
            <input
              id="cred-password"
              type="password"
              value={password}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Не короче 6 символов"
              onChange={(e) => {
                setPassword(e.target.value)
                setCredSaved(false)
              }}
            />
          </div>
          <button type="submit" className="btn secondary full" disabled={!credValid || busy}>
            {login ? 'Сменить логин или пароль' : 'Задать логин и пароль'}
          </button>
          {credSaved && <p className="hint">✓ Сохранено</p>}
        </form>
      )}

      {!fromTelegram && (
        <button className="btn danger full logout-btn" disabled={busy} onClick={logout}>
          Выйти
        </button>
      )}
    </div>
  )
}
