import { ApiError, handle, readJson } from '@/lib/api'
import { sql } from '@/lib/db'
import { assertUserExists, getMark, manualWorkerId, markSelect, snapshot } from '@/lib/marks'
import type { Mark } from '@/lib/types'
import { createMarkSchema } from '@/lib/validation'

const MAX_MARKS = 20000

// Рабочий получает только свои отметки, админ — все.
export const GET = handle({}, async (_req, { user, isAdmin }) => {
  const db = sql()
  const marks = await db<Mark[]>`
    ${markSelect(db)}
    ${isAdmin ? db`` : db`where m.worker_id = ${user.id}`}
    order by m.date desc
    limit ${MAX_MARKS}
  `
  return { marks }
})

// Дата ставится сервером автоматически (default now()), клиент её не передаёт.
export const POST = handle({ write: true }, async (req, { user, isAdmin }) => {
  const body = createMarkSchema.parse(await readJson(req))
  if (!isAdmin && ((body.worker_id && body.worker_id !== user.id) || body.worker_name)) {
    throw new ApiError(403, 'workers can only create marks for themselves')
  }

  const mark = await sql().begin(async (tx) => {
    const workerId = body.worker_name ? await manualWorkerId(tx, body.worker_name) : (body.worker_id ?? user.id)
    if (workerId !== user.id) await assertUserExists(tx, workerId)
    const [row] = await tx<{ id: number }[]>`
      insert into marks (worker_id, created_by_id, lat, lng, bales_count)
      values (${workerId}, ${user.id}, ${body.lat}, ${body.lng}, ${body.bales_count})
      returning id
    `
    const created = await getMark(tx, row.id)
    await tx`
      insert into audit_log (entity, entity_id, action, actor_id, after)
      values ('mark', ${created.id}, 'create', ${user.id}, ${tx.json(snapshot(created))})
    `
    return created
  })

  return Response.json({ mark }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
})
