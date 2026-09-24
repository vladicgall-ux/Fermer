'use client'

// Минимальная типизация Telegram Web App SDK (https://telegram.org/js/telegram-web-app.js),
// подключаемого в layout.tsx. Описаны только используемые методы.
interface TgButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

export interface TgWebApp {
  initData: string
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string | undefined>
  ready(): void
  expand(): void
  isVersionAtLeast(v: string): boolean
  setHeaderColor(c: string): void
  setBackgroundColor(c: string): void
  setBottomBarColor?(c: string): void
  disableVerticalSwipes?(): void
  onEvent(e: string, cb: () => void): void
  offEvent(e: string, cb: () => void): void
  showConfirm(msg: string, cb: (ok: boolean) => void): void
  showAlert(msg: string, cb?: () => void): void
  openLink(url: string): void
  downloadFile?(p: { url: string; file_name: string }, cb?: (accepted: boolean) => void): void
  BackButton: TgButton
  HapticFeedback?: {
    impactOccurred(s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(t: 'error' | 'success' | 'warning'): void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

export function tg(): TgWebApp | undefined {
  if (typeof window === 'undefined') return undefined
  return window.Telegram?.WebApp
}

/** Версия SDK Telegram поддерживает метод, появившийся в `v`. */
export function supports(v: string): boolean {
  const w = tg()
  return !!w && w.isVersionAtLeast(v)
}

export function getInitData(): string {
  const data = tg()?.initData
  if (data) return data
  // Локальная разработка вне Telegram: initData, подписанный токеном бота (npm run dev:initdata).
  if (process.env.NODE_ENV === 'development') return process.env.NEXT_PUBLIC_DEV_INIT_DATA ?? ''
  return ''
}

export function confirmDialog(message: string): Promise<boolean> {
  const w = tg()
  if (w && supports('6.2')) return new Promise((resolve) => w.showConfirm(message, resolve))
  return Promise.resolve(window.confirm(message))
}

export function alertDialog(message: string): Promise<void> {
  const w = tg()
  if (w && supports('6.2')) return new Promise((resolve) => w.showAlert(message, () => resolve()))
  window.alert(message)
  return Promise.resolve()
}

export function haptic(kind: 'success' | 'error' | 'warning' | 'light') {
  const h = supports('6.1') ? tg()?.HapticFeedback : undefined
  if (!h) return
  if (kind === 'light') h.impactOccurred('light')
  else h.notificationOccurred(kind)
}
