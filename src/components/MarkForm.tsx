'use client'

import { useState } from 'react'
import { fmtCoords } from '@/lib/format'
import type { Mark, User } from '@/lib/types'

export interface MarkFormValues {
  worker_id: number
  /** Админ: имя рабочего, которого нет в приложении (вместо worker_id). */
  worker_name?: string
  bales_count: number
  /** ISO-дата, только при редактировании админом. */
  date?: string
}

interface Props {
  me: User
  workers: User[]
  isAdmin: boolean
  editing: Mark | null
  pick: [number, number]
  busy: boolean
  canUseMyPos: boolean
  onUseMyPos: () => void
  onCancel: () => void
  onSubmit: (v: MarkFormValues) => void
}

/** ISO → значение для <input type="datetime-local"> в локальном времени. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function MarkForm(props: Props) {
  const { me, workers, isAdmin, editing, pick, busy } = props
  const [workerId, setWorkerId] = useState<number>(editing?.worker_id ?? me.id)
  const [customWorker, setCustomWorker] = useState('')
  const OTHER = -1
  const [count, setCount] = useState<string>(editing ? String(editing.bales_count) : '')
  const [dateInput, setDateInput] = useState<string>(editing ? toLocalInput(editing.date) : '')

  const n = Number(count)
  const custom = workerId === OTHER
  const valid = Number.isInteger(n) && n >= 1 && n <= 100000 && (!custom || customWorker.trim().length >= 2)

  const all = workers.some((w) => w.id === me.id) ? workers : [me, ...workers]
  const appUsers = all.filter((w) => w.kind !== 'manual')
  const manual = all.filter((w) => w.kind === 'manual')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    let date: string | undefined
    if (editing && dateInput && dateInput !== toLocalInput(editing.date)) {
      const d = new Date(dateInput)
      if (!Number.isNaN(d.getTime())) date = d.toISOString()
    }
    props.onSubmit({
      worker_id: workerId,
      worker_name: custom ? customWorker.trim() : undefined,
      bales_count: n,
      date,
    })
  }

  const step = (delta: number) => setCount(String(Math.min(100000, Math.max(1, (Number(count) || 0) + delta))))

  return (
    <form className="sheet" onSubmit={submit}>
      <div className="sheet-head">
        <div className="sheet-title">{editing ? `Отметка №${editing.id}` : 'Новая отметка'}</div>
      </div>
      <p className="hint">Нажмите на карту или перетащите метку, чтобы указать место.</p>

      <div className="field">
        <label>Место</label>
        <div className="row gap">
          <span className="mono grow">{fmtCoords(pick[0], pick[1])}</span>
          <button type="button" className="btn small" disabled={!props.canUseMyPos} onClick={props.onUseMyPos}>
            ◎ Я здесь
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="worker">Рабочий</label>
        {isAdmin ? (
          <>
            <select id="worker" value={workerId} onChange={(e) => setWorkerId(Number(e.target.value))}>
              <optgroup label="В приложении">
                {appUsers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.id === me.id ? ' (я)' : ''}
                  </option>
                ))}
              </optgroup>
              {manual.length > 0 && (
                <optgroup label="Добавленные вручную">
                  {manual.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={OTHER}>✎ Другой рабочий (вписать имя)…</option>
            </select>
            {custom && (
              <input
                className="custom-worker"
                type="text"
                value={customWorker}
                maxLength={64}
                autoFocus
                placeholder="Имя рабочего, например «Коля с трактора»"
                onChange={(e) => setCustomWorker(e.target.value)}
              />
            )}
            {custom && (
              <p className="hint">Рабочий сохранится в списке — в следующий раз просто выберите его.</p>
            )}
          </>
        ) : (
          <div className="readonly">{me.name}</div>
        )}
      </div>

      <div className="field">
        <label htmlFor="bales">Количество рулонов</label>
        <div className="stepper">
          <button type="button" onClick={() => step(-1)} aria-label="Меньше">
            −
          </button>
          <input
            id="bales"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={1}
            required
            placeholder="0"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ''))}
            autoFocus={!editing}
          />
          <button type="button" onClick={() => step(1)} aria-label="Больше">
            +
          </button>
        </div>
      </div>

      {editing ? (
        <div className="field">
          <label htmlFor="date">Дата заготовки</label>
          <input
            id="date"
            type="datetime-local"
            value={dateInput}
            max={toLocalInput(new Date().toISOString())}
            onChange={(e) => setDateInput(e.target.value)}
          />
        </div>
      ) : (
        <p className="hint">Дата и время будут проставлены автоматически.</p>
      )}

      <div className="row gap">
        <button type="button" className="btn secondary" onClick={props.onCancel} disabled={busy}>
          Отмена
        </button>
        <button type="submit" className="btn primary" disabled={!valid || busy}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
