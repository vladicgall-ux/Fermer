import { handle } from '@/lib/api'
import { sql } from '@/lib/db'
import type { AuditEntry } from '@/lib/types'

export const GET = handle({ admin: true }, async () => {
  const entries = await sql()<AuditEntry[]>`
    select a.*, u.name as actor_name
    from audit_log a join users u on u.id = a.actor_id
    where a.action <> 'create'
    order by a.created_at desc
    limit 200
  `
  return { entries }
})
