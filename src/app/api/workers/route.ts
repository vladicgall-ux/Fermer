import { handle } from '@/lib/api'
import { sql } from '@/lib/db'

// Список рабочих (id и имя) — для фильтра статистики. Доступен всем пользователям.
export const GET = handle({}, async () => {
  const workers = await sql()<{ id: number; name: string }[]>`
    select id, name from users order by name
  `
  return { workers }
})
