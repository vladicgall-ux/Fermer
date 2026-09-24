import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

// Mini App открывается во фрейме web.telegram.org (Telegram Web) — разрешаем только Telegram.
// Современные браузеры при наличии CSP frame-ancestors игнорируют X-Frame-Options,
// а X-Frame-Options: SAMEORIGIN остаётся защитой для старых клиентов.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://telegram.org${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://server.arcgisonline.com",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
].join('; ')

const common = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...common,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

export default nextConfig
