import 'server-only'
import type postgres from 'postgres'
import { ApiError } from './api'
import type { Mark } from './types'

type Tx = postgres.Sql | postgres.TransactionSql

export function markSelect(db: Tx) {
  return db`
    select
      m.id, m.worker_id, w.name as worker_name,
      m.created_by_id, c.name as created_by_name,
      m.lat, m.lng, m.bales_count, m.date, m.created_at,
      m.updated_by_id, u.name as updated_by_name, m.updated_at
    from marks m
    join users w on w.id = m.worker_id
    join users c on c.id = m.created_by_id
    left join users u on u.id = m.updated_by_id
  `
}

export async function getMark(db: Tx, id: number): Promise<Mark> {
  const [mark] = await db<Mark[]>`${markSelect(db)} where m.id = ${id}`
  if (!mark) throw new ApiError(404, 'mark not found')
  return mark
}

/** Снимок отметки для журнала аудита. */
export function snapshot(m: Mark) {
  return {
    worker_id: m.worker_id,
    worker_name: m.worker_name,
    lat: m.lat,
    lng: m.lng,
    bales_count: m.bales_count,
    date: new Date(m.date).toISOString(),
  }
}

export async function assertUserExists(db: Tx, id: number): Promise<void> {
  const [row] = await db`select 1 from users where id = ${id}`
  if (!row) throw new ApiError(400, 'worker not found')
}
