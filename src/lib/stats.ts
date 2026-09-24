import 'server-only'
import type postgres from 'postgres'
import type { Mark, StatsResponse } from './types'
import type { Range } from './validation'
import { markSelect } from './marks'

/**
 * Условие по периоду [from; to] (включительно) в часовом поясе пользователя
 * и необязательный фильтр по рабочему. Статистику по всем рабочим видят все пользователи.
 */
function where(db: postgres.Sql, r: Range) {
  const workerId = r.worker_id
  return db`
    where m.date >= (${r.from}::date)::timestamp at time zone ${r.tz}
      and m.date <  ((${r.to}::date + 1)::timestamp) at time zone ${r.tz}
      ${workerId ? db`and m.worker_id = ${workerId}` : db``}
  `
}

export async function getStats(db: postgres.Sql, r: Range): Promise<StatsResponse> {
  const cond = where(db, r)
  const [workers, days] = await Promise.all([
    db<StatsResponse['workers']>`
      select u.id as worker_id, u.name,
        sum(m.bales_count)::bigint as bales, count(*)::bigint as marks
      from marks m join users u on u.id = m.worker_id
      ${cond}
      group by u.id, u.name
      order by bales desc, u.name
    `,
    db<StatsResponse['days']>`
      select to_char((m.date at time zone ${r.tz})::date, 'YYYY-MM-DD') as day,
        sum(m.bales_count)::bigint as bales, count(*)::bigint as marks
      from marks m
      ${cond}
      group by 1
      order by 1
    `,
  ])
  const total = workers.reduce(
    (acc, w) => ({ bales: acc.bales + w.bales, marks: acc.marks + w.marks }),
    { bales: 0, marks: 0 },
  )
  return { from: r.from, to: r.to, total, workers: [...workers], days: [...days] }
}

export async function getMarksInRange(db: postgres.Sql, r: Range): Promise<Mark[]> {
  return db<Mark[]>`${markSelect(db)} ${where(db, r)} order by m.date limit 100000`
}
