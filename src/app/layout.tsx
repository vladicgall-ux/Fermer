import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import 'leaflet/dist/leaflet.css'
import './globals.css'

const ENV_SCRIPT = `(function(){try{
var d=document.documentElement,w=window.Telegram&&window.Telegram.WebApp;
var tg=!!(w&&w.initData);d.setAttribute('data-env',tg?'tg':'web');
}catch(e){}})()`

export const metadata: Metadata = {
  title: 'Fermer — учёт рулонов',
  description: 'Учёт заготовки сена в рулонах с геопривязкой',
  robots: { index: false, follow: false },
  applicationName: 'Fermer',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  // iOS: «На экран Домой» открывает приложение без адресной строки.
  appleWebApp: { capable: true, title: 'Fermer', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // Android: клавиатура сжимает страницу, а не перекрывает нижнюю карточку с полями.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#17212b' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Script src="/telegram-web-app.js" strategy="beforeInteractive" />
        {/* До отрисовки: где запущено приложение (Telegram / браузер) — от этого зависит высота экрана. */}
        <script dangerouslySetInnerHTML={{ __html: ENV_SCRIPT }} />
        {children}
      </body>
    </html>
  )
}
