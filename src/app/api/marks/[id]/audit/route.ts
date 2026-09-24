import { handle, parseId } from '@/lib/api'
import { sql } from '@/lib/db'
import type { AuditEntry } from '@/lib/types'

export const GET = handle<{ id: string }>({ admin: true }, async (_req, _ctx, params) => {
  const id = parseId(params.id)
  const db = sql()
  const entries = await db<AuditEntry[]>`
    select a.*, u.name as actor_name
    from audit_log a join users u on u.id = a.actor_id
    where a.entity = 'mark' and a.entity_id = ${id}
    order by a.created_at desc
    limit 100
  `
  return { entries }
})
