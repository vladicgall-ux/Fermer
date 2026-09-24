'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import { bales } from '@/lib/format'
import { alertDialog, confirmDialog, haptic } from '@/lib/telegram'
import type { AuditEntry, Role, User } from '@/lib/types'
import AuditList from './AuditList'

type Row = User & { bales: number; marks: number; locked: boolean }

export default function UsersTab({ me, onChanged }: { me: User; onChanged: (u: User) => void }) {
  const [view, setView] = useState<'users' | 'audit'>('users')
  const [users, setUsers] = useState<Row[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [query, setQuery] = useState('')
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
                    </div>
                  </div>
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
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            Новые пользователи появляются здесь после первого входа в приложение и получают роль «Рабочий».
          </p>
        </>
      )}

      {view === 'audit' && (audit === null ? <p className="hint">Загрузка…</p> : <AuditList entries={audit} />)}
    </div>
  )
}
