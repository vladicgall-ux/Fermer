import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

// Mini App открывается во фрейме web.telegram.org (Telegram Web) — разрешаем только Telegram.
// Современные браузеры при наличии CSP frame-ancestors игнорируют X-Frame-Options,
// а X-Frame-Options: SAMEORIGIN остаётся защитой для старых клиентов.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
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
  // Для запуска на своём сервере (Docker): самодостаточная сборка .next/standalone.
  output: 'standalone',
  // Карты и геокодер проксируются через наш домен: пользователю (в т.ч. в России без VPN)
  // нужен доступ только к серверу приложения.
  async rewrites() {
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services'
    return [
      { source: '/tiles/osm/:z/:x/:y.png', destination: 'https://tile.openstreetmap.org/:z/:x/:y.png' },
      { source: '/tiles/esri/imagery/:z/:y/:x', destination: `${esri}/World_Imagery/MapServer/tile/:z/:y/:x` },
      {
        source: '/tiles/esri/labels/:z/:y/:x',
        destination: `${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/:z/:y/:x`,
      },
      { source: '/geo/reverse', destination: 'https://nominatim.openstreetmap.org/reverse' },
    ]
  },
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
