'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import { bales } from '@/lib/format'
import { alertDialog, confirmDialog, haptic } from '@/lib/telegram'
import type { AuditEntry, Role, User } from '@/lib/types'
import AuditList from './AuditList'

type Row = User & { bales: number; marks: number; locked: boolean; login: string | null }

export default function UsersTab({ me, onChanged }: { me: User; onChanged: (u: User) => void }) {
  const [view, setView] = useState<'users' | 'audit'>('users')
  const [users, setUsers] = useState<Row[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [credFor, setCredFor] = useState<number | null>(null)
  const [newWorker, setNewWorker] = useState('')
  const [adding, setAdding] = useState(false)

  const addWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newWorker.trim()
    if (name.length < 2 || adding) return
    setAdding(true)
    try {
      const r = await api<{ user: User }>('/api/users', { method: 'POST', body: { name } })
      setNewWorker('')
      loadUsers()
      onChanged(r.user)
      haptic('success')
    } catch (err) {
      haptic('error')
      await alertDialog((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  const loadUsers = useCallback(() => {
    api<{ users: Row[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch((e: Error) => alertDialog(e.message))
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (view !== 'audit') return
    api<{ entries: AuditEntry[] }>('/api/audit')
      .then((r) => setAudit(r.entries))
      .catch((e: Error) => alertDialog(e.message))
  }, [view])

  const toggle = async (u: Row) => {
    const role: Role = u.role === 'admin' ? 'worker' : 'admin'
    const msg =
      role === 'admin'
        ? `Назначить ${u.name} администратором?`
        : u.id === me.id
          ? 'Снять права администратора с себя? Вы потеряете доступ к управлению.'
          : `Снять права администратора с ${u.name}?`
    if (!(await confirmDialog(msg))) return
    setPending(u.id)
    try {
      const r = await api<{ user: User }>(`/api/users/${u.id}`, { method: 'PATCH', body: { role } })
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, ...r.user } : x)) ?? null)
      haptic('success')
      onChanged(r.user)
    } catch (e) {
      haptic('error')
      await alertDialog((e as Error).message)
    } finally {
      setPending(null)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = users?.filter((u) => !q || u.name.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q))

  return (
    <div className="page">
      <h1>Пользователи</h1>
      <div className="segmented">
        <button className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}>
          Список
        </button>
        <button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')}>
          Журнал действий
        </button>
      </div>

      {view === 'users' && (
        <>
          <form className="add-worker" onSubmit={addWorker}>
            <input
              type="text"
              value={newWorker}
              maxLength={64}
              placeholder="Имя нового рабочего"
              onChange={(e) => setNewWorker(e.target.value)}
            />
            <button type="submit" className="btn primary" disabled={newWorker.trim().length < 2 || adding}>
              Добавить
            </button>
          </form>
          <input
            className="full"
            type="search"
            placeholder="Поиск по имени"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!filtered ? (
            <p className="hint">Загрузка…</p>
          ) : (
            <ul className="user-list">
              {filtered.map((u) => (
                <li key={u.id}>
                  <div className="grow">
                    <div className="user-name">
                      {u.name}
                      {u.id === me.id && <span className="hint"> (вы)</span>}
                    </div>
                    <div className="hint">
                      {u.username ? `@${u.username} · ` : ''}
                      {u.kind === 'web' ? 'браузер · ' : u.kind === 'manual' ? 'вписан вручную · ' : ''}
                      {u.role === 'admin' ? 'Админ' : 'Рабочий'} · {bales(u.bales)}
                      {u.login ? ` · логин: ${u.login}` : ''}
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label="Логин и пароль"
                    title="Выдать логин и пароль"
                    onClick={() => setCredFor(credFor === u.id ? null : u.id)}
                  >
                    🔑
                  </button>
                  {u.kind !== 'manual' && (
                  <label className={`switch${u.locked ? ' disabled' : ''}`} title={u.locked ? 'Задан в ADMIN_TELEGRAM_IDS' : ''}>
                    <input
                      type="checkbox"
                      checked={u.role === 'admin'}
                      disabled={u.locked || pending === u.id}
                      onChange={() => toggle(u)}
                    />
                    <span className="slider" />
                    <span className="switch-label">Админ</span>
                  </label>
                  )}
                  {credFor === u.id && (
                    <CredentialsForm
                      user={u}
                      onDone={() => {
                        setCredFor(null)
                        loadUsers()
                        onChanged(u)
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            Самостоятельной регистрации нет: чтобы человек мог войти через браузер, добавьте его и выдайте
            логин и пароль кнопкой 🔑. Пользователи Telegram появляются здесь после первого входа через бота.
          </p>
        </>
      )}

      {view === 'audit' && (audit === null ? <p className="hint">Загрузка…</p> : <AuditList entries={audit} />)}
    </div>
  )
}

function CredentialsForm({ user, onDone }: { user: Row; onDone: () => void }) {
  const [login, setLogin] = useState(user.login ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = login.trim().length >= 3 && password.length >= 6

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      await api(`/api/users/${user.id}/credentials`, {
        method: 'PUT',
        body: { login: login.trim(), password },
      })
      haptic('success')
      await alertDialog(`Готово. ${user.name}: логин «${login.trim()}», пароль «${password}». Передайте их человеку.`)
      onDone()
    } catch (err) {
      haptic('error')
      await alertDialog((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className="cred-form" onSubmit={submit}>
      <input
        type="text"
        value={login}
        maxLength={32}
        placeholder="Логин"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setLogin(e.target.value)}
      />
      <input
        type="text"
        value={password}
        maxLength={128}
        placeholder={user.login ? 'Новый пароль (от 6 символов)' : 'Пароль (от 6 символов)'}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" className="btn primary" disabled={!valid || busy}>
        {user.login ? 'Сменить' : 'Выдать вход'}
      </button>
    </form>
  )
}
