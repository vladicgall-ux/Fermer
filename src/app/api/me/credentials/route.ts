import { ApiError, handle, readJson } from '@/lib/api'
import { setCredentials } from '@/lib/credentials'
import { sql } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { hashToken, SESSION_COOKIE } from '@/lib/session'
import { credentialsSchema } from '@/lib/validation'

// Задать / сменить логин и пароль для входа через браузер.
// Если пароль уже есть и запрос пришёл по cookie-сессии — нужен текущий пароль.
// Из Telegram (подпись initData) текущий пароль не требуется.
export const PUT = handle({ write: true }, async (req, { user, tg }) => {
  const body = credentialsSchema.parse(await readJson(req))
  const db = sql()
  const [existing] = await db<{ password_hash: string }[]>`
    select password_hash from user_credentials where user_id = ${user.id}
  `
  if (existing && !tg) {
    const ok = body.current_password ? await verifyPassword(body.current_password, existing.password_hash) : false
    if (!ok) throw new ApiError(409, 'Неверный текущий пароль')
  }
  await setCredentials(db, user.id, body.login, body.password)
  // Смена пароля завершает все остальные браузерные сессии пользователя.
  const current = req.cookies.get(SESSION_COOKIE)?.value
  await db`
    delete from sessions
    where user_id = ${user.id} and token_hash <> ${current && !tg ? hashToken(current) : ''}
  `
  return { login: body.login }
})
