import { handle } from '@/lib/api'
import { sql } from '@/lib/db'
import { getStats } from '@/lib/stats'
import { rangeFromSearchParams } from '@/lib/validation'

export const GET = handle({}, async (req) => {
  const range = rangeFromSearchParams(req.nextUrl.searchParams)
  return getStats(sql(), range)
})
