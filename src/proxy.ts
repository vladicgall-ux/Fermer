import { NextResponse, type NextRequest } from 'next/server'

/**
 * CORS для /api: разрешён только origin самого приложения (и явно перечисленные в APP_URL).
 * Запросы с чужим Origin отклоняются до выполнения обработчика.
 */
function allowedOrigins(req: NextRequest): Set<string> {
  const set = new Set<string>([req.nextUrl.origin])
  for (const raw of (process.env.APP_URL ?? '').split(',')) {
    const v = raw.trim()
    if (!v) continue
    try {
      set.add(new URL(v).origin)
    } catch {
      // игнорируем некорректные значения
    }
  }
  return set
}

export function proxy(req: NextRequest) {
  const origin = req.headers.get('origin')
  const allowed = origin !== null && allowedOrigins(req).has(origin)

  if (origin !== null && !allowed) {
    return NextResponse.json({ error: 'origin not allowed' }, { status: 403, headers: { Vary: 'Origin' } })
  }

  const cors: Record<string, string> = { Vary: 'Origin' }
  if (allowed) {
    cors['Access-Control-Allow-Origin'] = origin
    cors['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS'
    cors['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    cors['Access-Control-Max-Age'] = '600'
  }

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: allowed ? 204 : 403, headers: cors })
  }

  const res = NextResponse.next()
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  return res
}

export const config = {
  matcher: '/api/:path*',
}
