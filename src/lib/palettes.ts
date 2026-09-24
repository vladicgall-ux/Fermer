'use client'

import { useSyncExternalStore } from 'react'

export interface Palette {
  id: string
  name: string
  hint: string
  colors: string[]
}

// 5 вариантов цветов для меток рабочих. В каждой палитре 12 хорошо различимых цветов;
// порядок подобран так, чтобы соседние рабочие получали максимально разные цвета.
export const PALETTES: Palette[] = [
  {
    id: 'bright',
    name: 'Яркая',
    hint: 'Насыщенные цвета, хорошо видны на схеме',
    colors: ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#fdd835', '#d81b60', '#6d4c41', '#3949ab', '#7cb342', '#546e7a'],
  },
  {
    id: 'satellite',
    name: 'Спутник',
    hint: 'Кислотные цвета — заметны на снимке поля',
    colors: ['#ff1744', '#00e5ff', '#ffea00', '#d500f9', '#ff9100', '#2979ff', '#76ff03', '#212121', '#1de9b6', '#ff80ab', '#651fff', '#8d6e63'],
  },
  {
    id: 'field',
    name: 'Поле',
    hint: 'Природные оттенки: пшеница, глина, листва',
    colors: ['#b8860b', '#8b4513', '#556b2f', '#cd853f', '#2e8b57', '#4682b4', '#6b8e23', '#d2691e', '#708090', '#9acd32', '#800000', '#daa520'],
  },
  {
    id: 'pastel',
    name: 'Пастель',
    hint: 'Мягкие цвета, спокойная карта',
    colors: ['#ef9a9a', '#90caf9', '#a5d6a7', '#ffcc80', '#ce93d8', '#80deea', '#fff59d', '#b39ddb', '#bcaaa4', '#9fa8da', '#e6ee9c', '#b0bec5'],
  },
  {
    id: 'strict',
    name: 'Строгая',
    hint: 'Тёмные деловые оттенки',
    colors: ['#b71c1c', '#0d47a1', '#1b5e20', '#e65100', '#4a148c', '#006064', '#827717', '#880e4f', '#3e2723', '#1a237e', '#f57f17', '#263238'],
  },
]

const KEY = 'fermer:palette'
const EVENT = 'fermer:palette'

function read(): string {
  try {
    const v = localStorage.getItem(KEY)
    return PALETTES.some((p) => p.id === v) ? (v as string) : PALETTES[0].id
  } catch {
    return PALETTES[0].id
  }
}

export function setPaletteId(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // хранилище недоступно — выбор действует до перезагрузки
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Текущая палитра (выбор хранится на устройстве и сразу применяется ко всем экранам). */
export function usePalette(): Palette {
  const id = useSyncExternalStore(subscribe, read, () => PALETTES[0].id)
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/**
 * Цвет рабочего: по порядку регистрации (id по возрастанию), чтобы у уже существующих
 * рабочих цвет не менялся при добавлении новых.
 */
export function makeColorFor(palette: Palette, workerIds: number[]): (id: number) => string {
  const rank = new Map([...workerIds].sort((a, b) => a - b).map((id, i) => [id, i]))
  return (id) => palette.colors[(rank.get(id) ?? id) % palette.colors.length]
}

/** Цвет текста поверх цвета метки: тёмный на светлых, белый на тёмных. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1c1c1e' : '#ffffff'
}
