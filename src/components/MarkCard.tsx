'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import { bales, fmtCoords, fmtDateTime } from '@/lib/format'
import type { AuditEntry, Mark } from '@/lib/types'
import AuditList from './AuditList'

const addressCache = new Map<string, string | null>()

/** Обратное геокодирование через Nominatim (OSM, без ключа), с кэшем. */
function useAddress(lat: number, lng: number): string | null {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
  const [state, setState] = useState<{ key: string; value: string | null }>({ key: '', value: null })
  useEffect(() => {
    if (addressCache.has(key)) return
    const ctrl = new AbortController()
    const url = `/geo/reverse?format=jsonv2&zoom=16&accept-language=ru&lat=${lat}&lon=${lng}`
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { display_name?: string } | null) => {
        const value = d?.display_name ?? null
        addressCache.set(key, value)
        setState({ key, value })
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [key, lat, lng])
  if (addressCache.has(key)) return addressCache.get(key) ?? null
  return state.key === key ? state.value : null
}

interface Props {
  mark: Mark
  isAdmin: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function MarkCard({ mark, isAdmin, onClose, onEdit, onDelete }: Props) {
  const address = useAddress(mark.lat, mark.lng)
  const [history, setHistory] = useState<AuditEntry[] | null>(null)
  const [historyFor, setHistoryFor] = useState<number | null>(null)

  const showHistory = async () => {
    setHistoryFor(mark.id)
    setHistory(null)
    try {
      const r = await api<{ entries: AuditEntry[] }>(`/api/marks/${mark.id}/audit`)
      setHistory(r.entries)
    } catch {
      setHistory([])
    }
  }

  return (
    <div className="sheet" role="dialog" aria-label="Отметка">
      <div className="sheet-head">
        <div>
          <div className="sheet-title">{bales(mark.bales_count)}</div>
          <div className="hint">Отметка №{mark.id}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>

      <dl className="props">
        <dt>Рабочий</dt>
        <dd>{mark.worker_name}</dd>
        <dt>Дата и время</dt>
        <dd>{fmtDateTime(mark.date)}</dd>
        <dt>Место</dt>
        <dd>
          {address && <div>{address}</div>}
          <div className="hint mono">{fmtCoords(mark.lat, mark.lng)}</div>
        </dd>
        <dt>Отметку создал</dt>
        <dd>
          {mark.created_by_name}
          <span className="hint"> · {fmtDateTime(mark.created_at)}</span>
        </dd>
        {mark.updated_at && (
          <>
            <dt>Изменено</dt>
            <dd>
              {mark.updated_by_name}
              <span className="hint"> · {fmtDateTime(mark.updated_at)}</span>
            </dd>
          </>
        )}
      </dl>

      {isAdmin && (
        <>
          <div className="row gap">
            <button className="btn" onClick={onEdit}>
              ✎ Редактировать
            </button>
            <button className="btn danger" onClick={onDelete}>
              🗑 Удалить
            </button>
          </div>
          {historyFor === mark.id ? (
            history === null ? (
              <p className="hint">Загрузка истории…</p>
            ) : (
              <AuditList entries={history} compact />
            )
          ) : (
            <button className="link-btn" onClick={showHistory}>
              История изменений
            </button>
          )}
        </>
      )}
    </div>
  )
}
