import { handle } from '@/lib/api'
import { signExportToken } from '@/lib/export-token'
import { rangeFromSearchParams } from '@/lib/validation'

const TTL_SEC = 5 * 60

// Выдаёт короткоживущую ссылку на CSV для текущего пользователя.
export const POST = handle({ write: true }, async (req, { user, isAdmin }) => {
  const range = rangeFromSearchParams(req.nextUrl.searchParams)
  const token = signExportToken(
    {
      u: user.id,
      from: range.from,
      to: range.to,
      tz: range.tz,
      w: isAdmin ? range.worker_id : undefined,
      exp: Math.floor(Date.now() / 1000) + TTL_SEC,
    },
    process.env.TELEGRAM_BOT_TOKEN!,
  )
  const url = new URL('/api/export', req.nextUrl.origin)
  url.searchParams.set('t', token)
  return { url: url.toString() }
})
