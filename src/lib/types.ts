export type Role = 'worker' | 'admin'

export interface User {
  id: number
  telegram_id: number
  name: string
  username: string | null
  role: Role
  name_custom: boolean
  created_at: string
}

export interface Mark {
  id: number
  worker_id: number
  worker_name: string
  created_by_id: number
  created_by_name: string
  lat: number
  lng: number
  bales_count: number
  date: string
  created_at: string
  updated_by_id: number | null
  updated_by_name: string | null
  updated_at: string | null
}

export interface AuditEntry {
  id: number
  entity: 'mark' | 'user'
  entity_id: number
  action: 'create' | 'update' | 'delete' | 'role' | 'rename'
  actor_id: number
  actor_name: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

export interface StatsResponse {
  from: string
  to: string
  total: { bales: number; marks: number }
  workers: { worker_id: number; name: string; bales: number; marks: number }[]
  days: { day: string; bales: number; marks: number }[]
}
