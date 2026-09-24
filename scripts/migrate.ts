// Применяет db/schema.sql к базе из DATABASE_URL (или POSTGRES_URL). Скрипт идемпотентен.
// Использование: DATABASE_URL=postgres://... npm run db:migrate
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const schema = readFileSync(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8')
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} })
try {
  await sql.unsafe(schema)
  console.log('Schema applied')
} finally {
  await sql.end()
}
