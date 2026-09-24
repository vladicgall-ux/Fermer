import { ApiError, handle, parseId, readJson } from '@/lib/api'
import { setCredentials } from '@/lib/credentials'
import { sql } from '@/lib/db'
import { adminCredentialsSchema } from '@/lib/validation'

// Админ выдаёт или сбрасывает логин и пароль пользователя (самостоятельной регистрации нет).
// «Ручной» рабочий после этого может сам входить в приложение.
export const PUT = handle<{ id: string }>({ admin: true, write: true }, async (req, { user }, params) => {
  const id = parseId(params.id)
  const { login, password } = adminCredentialsSchema.parse(await readJson(req))

  await sql().begin(async (tx) => {
    const [target] = await tx<{ id: number; name: string }[]>`select id, name from users where id = ${id} for update`
    if (!target) throw new ApiError(404, 'user not found')
    await setCredentials(tx, id, login, password)
    await tx`update users set kind = 'web' where id = ${id} and kind = 'manual'`
    // Новый пароль — все старые браузерные сессии этого пользователя закрываются.
    await tx`delete from sessions where user_id = ${id}`
    await tx`
      insert into audit_log (entity, entity_id, action, actor_id, after)
      values ('user', ${id}, 'update', ${user.id}, ${tx.json({ name: target.name, login })})
    `
  })

  return { login }
})
