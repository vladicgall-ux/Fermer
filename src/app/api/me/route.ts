import { ApiError, handle, readJson } from '@/lib/api'
import { getLogin } from '@/lib/credentials'
import { sql } from '@/lib/db'
import { displayName } from '@/lib/telegram-auth'
import type { User } from '@/lib/types'
import { nameSchema } from '@/lib/validation'

export const GET = handle({}, async (_req, { user }) => ({ user, login: await getLogin(user.id) }))

// Своё имя. { name: null } — вернуть имя из Telegram.
export const PATCH = handle({ write: true }, async (req, { user, tg }) => {
  const { name } = nameSchema.parse(await readJson(req))
  if (name === null && !tg) throw new ApiError(400, 'нет имени из Telegram')
  const nextName = name ?? displayName(tg!)
  const custom = name !== null

  const updated = await sql().begin(async (tx) => {
    const [row] = await tx<User[]>`
      update users set name = ${nextName}, name_custom = ${custom}
      where id = ${user.id}
      returning *
    `
    if (row.name !== user.name) {
      await tx`
        insert into audit_log (entity, entity_id, action, actor_id, before, after)
        values ('user', ${user.id}, 'rename', ${user.id},
                ${tx.json({ name: user.name })}, ${tx.json({ name: row.name })})
      `
    }
    return row
  })

  return { user: updated }
})
