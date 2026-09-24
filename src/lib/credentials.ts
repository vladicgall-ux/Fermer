import 'server-only'
import type postgres from 'postgres'
import { ApiError } from './api'
import { sql } from './db'
import { hashPassword } from './password'

type Tx = postgres.Sql | postgres.TransactionSql

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'
}

/** Задать или сменить логин и пароль пользователя. */
export async function setCredentials(db: Tx, userId: number, login: string, password: string): Promise<void> {
  const hash = await hashPassword(password)
  try {
    await db`
      insert into user_credentials (user_id, login, password_hash)
      values (${userId}, ${login}, ${hash})
      on conflict (user_id) do update
        set login = excluded.login, password_hash = excluded.password_hash, updated_at = now()
    `
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, 'Этот логин уже занят')
    throw e
  }
}

export async function getLogin(userId: number): Promise<string | null> {
  const [row] = await sql()<{ login: string }[]>`select login from user_credentials where user_id = ${userId}`
  return row?.login ?? null
}
