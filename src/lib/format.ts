const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const num = new Intl.NumberFormat('ru-RU')

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso))
export const fmtNum = (n: number) => num.format(n)
export const fmtCoords = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`

/** 'YYYY-MM-DD' как локальная дата (без сдвига часового пояса). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const fmtDay = (ymd: string) => dateOnly.format(parseYmd(ymd))
export const fmtMonth = (ym: string) => {
  const s = monthName.format(parseYmd(`${ym}-01`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Склонение: plural(5, ['рулон', 'рулона', 'рулонов']). */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export const bales = (n: number) => `${fmtNum(n)} ${plural(n, ['рулон', 'рулона', 'рулонов'])}`

/** Устойчивый цвет рабочего для маркеров. */
export function workerColor(id: number): string {
  const hue = (id * 137.508) % 360
  return `hsl(${hue.toFixed(0)} 65% 42%)`
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
