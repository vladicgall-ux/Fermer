'use client'

import { useEffect, useRef, useState } from 'react'
import { supports, tg } from './telegram'

/** Показывает системную кнопку «Назад» Telegram, пока active = true. */
export function useBackButton(active: boolean, onBack: () => void) {
  const cb = useRef(onBack)
  useEffect(() => {
    cb.current = onBack
  })
  useEffect(() => {
    const w = tg()
    if (!active || !w || !supports('6.1')) return
    const handler = () => cb.current()
    w.BackButton.onClick(handler)
    w.BackButton.show()
    return () => {
      w.BackButton.offClick(handler)
      w.BackButton.hide()
    }
  }, [active])
}

export interface GeoState {
  pos: [number, number] | null
  accuracy: number | null
  error: string | null
}

/** Отслеживание геопозиции через Geolocation API (работает во WebView Telegram). */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ pos: null, accuracy: null, error: null })
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      queueMicrotask(() => setState((s) => ({ ...s, error: 'Геолокация не поддерживается' })))
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ pos: [p.coords.latitude, p.coords.longitude], accuracy: p.coords.accuracy, error: null }),
      (e) =>
        setState((s) => ({
          ...s,
          error: e.code === e.PERMISSION_DENIED ? 'Нет доступа к геопозиции' : 'Не удалось определить местоположение',
        })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])
  return state
}
