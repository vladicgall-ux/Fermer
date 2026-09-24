import 'server-only'
import postgres from 'postgres'

declare global {
  var __fermerSql: postgres.Sql | undefined
}

function createClient(): postgres.Sql {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) throw new Error('DATABASE_URL is not configured')
  return postgres(url, {
    // Пулеры (Supabase Supavisor / Neon pgbouncer) в transaction mode не поддерживают prepared statements.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    types: {
      // bigint -> number: id в пределах Number.MAX_SAFE_INTEGER (Telegram id < 2^53).
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => x.toString(),
        parse: (x: string) => Number(x),
      },
    },
  })
}

/** Ленивый клиент: ошибка конфигурации всплывает при запросе, а не при сборке. */
export function sql(): postgres.Sql {
  if (!globalThis.__fermerSql) globalThis.__fermerSql = createClient()
  return globalThis.__fermerSql
}
