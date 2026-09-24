import { ApiError, handle, isBootstrapAdmin, parseId, readJson } from '@/lib/api'
import { sql } from '@/lib/db'
import type { User } from '@/lib/types'
import { roleSchema } from '@/lib/validation'

// Назначить / снять админа. Только админ.
export const PATCH = handle<{ id: string }>({ admin: true, write: true }, async (req, { user }, params) => {
  const id = parseId(params.id)
  const { role } = roleSchema.parse(await readJson(req))

  const updated = await sql().begin(async (tx) => {
    // Сериализуем смены ролей, чтобы два админа не сняли друг друга одновременно.
    await tx`select pg_advisory_xact_lock(hashtext('fermer:roles'))`
    const [target] = await tx<User[]>`select * from users where id = ${id} for update`
    if (!target) throw new ApiError(404, 'user not found')
    if (target.role === role) return target

    if (role === 'worker') {
      if (isBootstrapAdmin(target.telegram_id)) {
        throw new ApiError(409, 'этот админ задан в ADMIN_TELEGRAM_IDS и не может быть снят')
      }
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::bigint as n from users where role = 'admin' and id <> ${id}
      `
      if (n === 0) throw new ApiError(409, 'нельзя снять последнего админа')
    }

    const [row] = await tx<User[]>`update users set role = ${role} where id = ${id} returning *`
    await tx`
      insert into audit_log (entity, entity_id, action, actor_id, before, after)
      values ('user', ${id}, 'role', ${user.id},
              ${tx.json({ role: target.role, name: target.name })},
              ${tx.json({ role, name: target.name })})
    `
    return row
  })

  return { user: updated }
})
