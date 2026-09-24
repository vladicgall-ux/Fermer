'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/client-api'
import { bales, fmtDay, fmtMonth, fmtNum, localTimeZone, parseYmd, plural, toYmd } from '@/lib/format'
import { alertDialog, supports, tg } from '@/lib/telegram'
import type { StatsResponse, User } from '@/lib/types'

type Mode = 'day' | 'month' | 'year' | 'range'

const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
  { id: 'range', label: 'Период' },
]

function computeRange(mode: Mode, anchor: Date, custom: { from: string; to: string }) {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  switch (mode) {
    case 'day':
      return { from: toYmd(anchor), to: toYmd(anchor) }
    case 'month':
      return { from: toYmd(new Date(y, m, 1)), to: toYmd(new Date(y, m + 1, 0)) }
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'range':
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  }
}

function shift(mode: Mode, anchor: Date, dir: -1 | 1): Date {
  const d = new Date(anchor)
  if (mode === 'day') d.setDate(d.getDate() + dir)
  if (mode === 'month') d.setMonth(d.getMonth() + dir, 1)
  if (mode === 'year') d.setFullYear(d.getFullYear() + dir, 0, 1)
  return d
}

export default function StatsTab({ me, workers }: { me: User; workers: User[] }) {
  const isAdmin = me.role === 'admin'
  const today = toYmd(new Date())
  const [mode, setMode] = useState<Mode>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [custom, setCustom] = useState({ from: today.slice(0, 8) + '01', to: today })
  const [workerId, setWorkerId] = useState(0)
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const range = computeRange(mode, anchor, custom)
  const query = useMemo(() => {
    const q = new URLSearchParams({ from: range.from, to: range.to, tz: localTimeZone() })
    if (isAdmin && workerId) q.set('worker_id', String(workerId))
    return q.toString()
  }, [range.from, range.to, isAdmin, workerId])

  useEffect(() => {
    let cancelled = false
    api<StatsResponse>(`/api/stats?${query}`)
      .then((r) => {
        if (cancelled) return
        setData(r)
        setError(null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [query])

  const byMonth = useMemo(() => {
    if (!data) return []
    const groups = new Map<string, { bales: number; marks: number; days: StatsResponse['days'] }>()
    for (const d of data.days) {
      const k = d.day.slice(0, 7)
      const g = groups.get(k) ?? { bales: 0, marks: 0, days: [] }
      g.bales += d.bales
      g.marks += d.marks
      g.days.push(d)
      groups.set(k, g)
    }
    return [...groups.entries()]
  }, [data])

  const longRange = parseYmd(range.to).getTime() - parseYmd(range.from).getTime() > 31 * 86400000

  const exportCsv = async () => {
    setExporting(true)
    try {
      const { url } = await api<{ url: string }>(`/api/export/link?${query}`, { method: 'POST' })
      const w = tg()
      const fileName = `fermer_${range.from}_${range.to}.csv`
      if (w?.initData && supports('8.0') && w.downloadFile) {
        w.downloadFile({ url, file_name: fileName })
      } else if (w?.initData) {
        w.openLink(url)
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
      }
    } catch (e) {
      await alertDialog((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const selectedWorker = workers.find((w) => w.id === workerId)

  return (
    <div className="page">
      <h1>Статистика</h1>

      <div className="segmented">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="period-picker">
        {mode !== 'range' && (
          <button className="icon-btn" onClick={() => setAnchor(shift(mode, anchor, -1))} aria-label="Назад">
            ‹
          </button>
        )}
        {mode === 'day' && (
          <input
            type="date"
            value={toYmd(anchor)}
            max={today}
            onChange={(e) => e.target.value && setAnchor(parseYmd(e.target.value))}
          />
        )}
        {mode === 'month' && (
          <input
            type="month"
            value={toYmd(anchor).slice(0, 7)}
            max={today.slice(0, 7)}
            onChange={(e) => e.target.value && setAnchor(parseYmd(`${e.target.value}-01`))}
          />
        )}
        {mode === 'year' && (
          <select
            value={anchor.getFullYear()}
            onChange={(e) => setAnchor(new Date(Number(e.target.value), 0, 1))}
          >
            {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {mode === 'range' && (
          <>
            <input
              type="date"
              value={custom.from}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span>—</span>
            <input
              type="date"
              value={custom.to}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </>
        )}
        {mode !== 'range' && (
          <button className="icon-btn" onClick={() => setAnchor(shift(mode, anchor, 1))} aria-label="Вперёд">
            ›
          </button>
        )}
      </div>

      {isAdmin && (
        <select className="full" value={workerId} onChange={(e) => setWorkerId(Number(e.target.value))}>
          <option value={0}>Все рабочие</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      {error && <div className="error-pill">{error}</div>}

      {data && (
        <>
          <div className="total-card">
            <div className="hint">
              {isAdmin ? (selectedWorker ? selectedWorker.name : 'Все рабочие') : 'Ваши рулоны'} ·{' '}
              {range.from === range.to ? fmtDay(range.from) : `${fmtDay(range.from)} — ${fmtDay(range.to)}`}
            </div>
            <div className="total-value">{fmtNum(data.total.bales)}</div>
            <div className="hint">
              {plural(data.total.bales, ['рулон', 'рулона', 'рулонов'])} · {fmtNum(data.total.marks)}{' '}
              {plural(data.total.marks, ['отметка', 'отметки', 'отметок'])}
            </div>
          </div>

          {isAdmin && !workerId && (
            <section>
              <h2>По рабочим</h2>
              {data.workers.length === 0 ? (
                <p className="hint">Нет данных за период</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Рабочий</th>
                      <th className="num">Рулонов</th>
                      <th className="num">Отметок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.map((w) => (
                      <tr key={w.worker_id} onClick={() => setWorkerId(w.worker_id)} className="clickable">
                        <td>{w.name}</td>
                        <td className="num">{fmtNum(w.bales)}</td>
                        <td className="num">{fmtNum(w.marks)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Итого</td>
                      <td className="num">{fmtNum(data.total.bales)}</td>
                      <td className="num">{fmtNum(data.total.marks)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          )}

          {range.from !== range.to && (
            <section>
              <h2>{longRange ? 'По месяцам и дням' : 'По дням'}</h2>
              {data.days.length === 0 ? (
                <p className="hint">Нет отметок за период</p>
              ) : longRange ? (
                byMonth.map(([month, g]) => (
                  <details key={month} className="month-group">
                    <summary>
                      <span>{fmtMonth(month)}</span>
                      <b>{bales(g.bales)}</b>
                    </summary>
                    <DayList days={g.days} />
                  </details>
                ))
              ) : (
                <DayList days={data.days} />
              )}
            </section>
          )}

          <button className="btn secondary full" onClick={exportCsv} disabled={exporting}>
            {exporting ? 'Подготовка…' : '⬇ Экспорт в CSV'}
          </button>
        </>
      )}
    </div>
  )
}

function DayList({ days }: { days: StatsResponse['days'] }) {
  return (
    <ul className="day-list">
      {days.map((d) => (
        <li key={d.day}>
          <span>{fmtDay(d.day)}</span>
          <span className="hint">
            {d.marks} {plural(d.marks, ['отм.', 'отм.', 'отм.'])}
          </span>
          <b>{fmtNum(d.bales)}</b>
        </li>
      ))}
    </ul>
  )
}
