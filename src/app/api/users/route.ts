import { handle, isBootstrapAdmin } from '@/lib/api'
import { sql } from '@/lib/db'
import type { User } from '@/lib/types'

export const GET = handle({ admin: true }, async () => {
  const users = await sql()<(User & { bales: number; marks: number })[]>`
    select u.*,
      coalesce(sum(m.bales_count), 0)::bigint as bales,
      count(m.id)::bigint as marks
    from users u left join marks m on m.worker_id = u.id
    group by u.id
    order by u.name
  `
  return {
    users: users.map((u) => ({ ...u, locked: isBootstrapAdmin(u.telegram_id) })),
  }
})
