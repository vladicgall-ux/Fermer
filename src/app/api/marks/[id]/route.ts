import { handle, parseId, readJson } from '@/lib/api'
import { sql } from '@/lib/db'
import { assertUserExists, getMark, manualWorkerId, snapshot } from '@/lib/marks'
import { updateMarkSchema } from '@/lib/validation'

type P = { id: string }

// Редактирование — только админ. Изменение пишется в audit_log (кто, когда, до/после).
export const PATCH = handle<P>({ admin: true, write: true }, async (req, { user }, params) => {
  const id = parseId(params.id)
  const body = updateMarkSchema.parse(await readJson(req))

  const mark = await sql().begin(async (tx) => {
    await tx`select id from marks where id = ${id} for update`
    const before = await getMark(tx, id)
    const workerId = body.worker_name ? await manualWorkerId(tx, body.worker_name) : body.worker_id
    if (workerId !== undefined) await assertUserExists(tx, workerId)

    await tx`
      update marks set
        worker_id   = ${workerId ?? before.worker_id},
        lat         = ${body.lat ?? before.lat},
        lng         = ${body.lng ?? before.lng},
        bales_count = ${body.bales_count ?? before.bales_count},
        date        = ${body.date ? new Date(body.date) : before.date},
        updated_by_id = ${user.id},
        updated_at  = now()
      where id = ${id}
    `
    const after = await getMark(tx, id)
    await tx`
      insert into audit_log (entity, entity_id, action, actor_id, before, after)
      values ('mark', ${id}, 'update', ${user.id}, ${tx.json(snapshot(before))}, ${tx.json(snapshot(after))})
    `
    return after
  })

  return { mark }
})

// Удаление — только админ. Снимок удалённой отметки сохраняется в audit_log.
export const DELETE = handle<P>({ admin: true, write: true }, async (_req, { user }, params) => {
  const id = parseId(params.id)

  await sql().begin(async (tx) => {
    await tx`select id from marks where id = ${id} for update`
    const before = await getMark(tx, id)
    await tx`delete from marks where id = ${id}`
    await tx`
      insert into audit_log (entity, entity_id, action, actor_id, before)
      values ('mark', ${id}, 'delete', ${user.id}, ${tx.json(snapshot(before))})
    `
  })

  return { ok: true }
})
