import { handle, isBootstrapAdmin, readJson } from '@/lib/api'
import { sql } from '@/lib/db'
import { manualWorkerId } from '@/lib/marks'
import type { User } from '@/lib/types'
import { registerSchema } from '@/lib/validation'

const addWorkerSchema = registerSchema.pick({ name: true }).strict()

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

// Админ добавляет рабочего, которого нет в приложении («вписан вручную»), — чтобы выбирать его из списка.
export const POST = handle({ admin: true, write: true }, async (req) => {
  const { name } = addWorkerSchema.parse(await readJson(req))
  const id = await manualWorkerId(sql(), name)
  const [user] = await sql()<User[]>`select * from users where id = ${id}`
  return { user }
})
