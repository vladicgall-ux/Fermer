import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import 'leaflet/dist/leaflet.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fermer — учёт рулонов',
  description: 'Учёт заготовки сена в рулонах с геопривязкой',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  )
}
