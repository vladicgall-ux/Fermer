'use client'

import { fmtCoords, fmtDateTime } from '@/lib/format'
import type { AuditEntry } from '@/lib/types'

const ACTION: Record<AuditEntry['action'], string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  role: 'Смена роли',
}

const ROLE: Record<string, string> = { admin: 'админ', worker: 'рабочий' }

type Snap = Record<string, unknown>

function describe(e: AuditEntry): string[] {
  const b = (e.before ?? {}) as Snap
  const a = (e.after ?? {}) as Snap
  if (e.entity === 'user') {
    return [`${b.name ?? ''}: ${ROLE[String(b.role)] ?? b.role} → ${ROLE[String(a.role)] ?? a.role}`]
  }
  const snap = e.action === 'delete' ? b : a
  if (e.action !== 'update') {
    return [
      `Отметка №${e.entity_id}: ${snap.worker_name}, ${snap.bales_count} рул.`,
      `${fmtCoords(Number(snap.lat), Number(snap.lng))} · ${snap.date ? fmtDateTime(String(snap.date)) : ''}`,
    ]
  }
  const out = [`Отметка №${e.entity_id}`]
  if (b.bales_count !== a.bales_count) out.push(`Рулонов: ${b.bales_count} → ${a.bales_count}`)
  if (b.worker_id !== a.worker_id) out.push(`Рабочий: ${b.worker_name} → ${a.worker_name}`)
  if (b.lat !== a.lat || b.lng !== a.lng) {
    out.push(`Место: ${fmtCoords(Number(b.lat), Number(b.lng))} → ${fmtCoords(Number(a.lat), Number(a.lng))}`)
  }
  if (b.date !== a.date) out.push(`Дата: ${fmtDateTime(String(b.date))} → ${fmtDateTime(String(a.date))}`)
  if (out.length === 1) out.push('Без изменений')
  return out
}

export default function AuditList({ entries, compact }: { entries: AuditEntry[]; compact?: boolean }) {
  if (entries.length === 0) return <p className="hint">Записей нет</p>
  return (
    <ul className={`audit${compact ? ' compact' : ''}`}>
      {entries.map((e) => (
        <li key={e.id} className={`audit-${e.action}`}>
          <div className="audit-head">
            <b>{ACTION[e.action]}</b>
            <span className="hint">
              {e.actor_name} · {fmtDateTime(e.created_at)}
            </span>
          </div>
          {describe(e).map((line, i) => (
            <div key={i} className="audit-line">
              {line}
            </div>
          ))}
        </li>
      ))}
    </ul>
  )
}
