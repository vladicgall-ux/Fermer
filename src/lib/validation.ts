import { z } from 'zod'
import { cleanName } from './telegram-auth'

const lat = z.number().min(-90).max(90)
const lng = z.number().min(-180).max(180)
const bales = z.number().int().min(1).max(100000)
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

const personName = z
  .string()
  .max(200)
  .transform((v) => cleanName(v))
  .pipe(
    z
      .string()
      .min(2, 'Имя слишком короткое')
      .max(64, 'Имя слишком длинное')
      .refine((v) => !/[\p{Cc}<>]/u.test(v), 'Недопустимые символы'),
  )

export const createMarkSchema = z
  .object({
    lat,
    lng,
    bales_count: bales,
    worker_id: id.optional(),
    // Админ: имя рабочего, которого нет в приложении (создаётся «ручной» рабочий).
    worker_name: personName.optional(),
  })
  .strict()
  .refine((v) => !(v.worker_id && v.worker_name), 'worker_id and worker_name are exclusive')

export const updateMarkSchema = z
  .object({
    lat: lat.optional(),
    lng: lng.optional(),
    bales_count: bales.optional(),
    worker_id: id.optional(),
    worker_name: personName.optional(),
    date: z.iso
      .datetime({ offset: true })
      .refine((s) => {
        const t = Date.parse(s)
        return t >= Date.UTC(2000, 0, 1) && t <= Date.now() + 24 * 3600 * 1000
      }, 'date out of range')
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update')
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), 'lat and lng must be set together')
  .refine((v) => !(v.worker_id && v.worker_name), 'worker_id and worker_name are exclusive')

// null — вернуть имя из Telegram.
export const nameSchema = z.object({ name: personName.nullable() }).strict()

export const loginField = z
  .string()
  .trim()
  .min(3, 'Логин: минимум 3 символа')
  .max(32, 'Логин: максимум 32 символа')
  .regex(/^[\p{L}\p{N}_.-]+$/u, 'Логин: только буквы, цифры и _ . -')

export const passwordField = z
  .string()
  .min(6, 'Пароль: минимум 6 символов')
  .max(128, 'Пароль слишком длинный')

export const addWorkerSchema = z.object({ name: personName }).strict()

// Админ выдаёт пользователю логин и пароль для входа через браузер.
export const adminCredentialsSchema = z.object({ login: loginField, password: passwordField }).strict()

export const loginSchema = z
  .object({ login: z.string().trim().min(1).max(32), password: z.string().min(1).max(128) })
  .strict()

export const credentialsSchema = z
  .object({
    login: loginField,
    password: passwordField,
    current_password: z.string().max(128).optional(),
  })
  .strict()

export const roleSchema = z.object({ role: z.enum(['worker', 'admin']) }).strict()

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export function isValidTimeZone(tz: string): boolean {
  if (tz.length > 64 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const rangeSchema = z
  .object({
    from: ymd,
    to: ymd,
    tz: z.string().refine(isValidTimeZone, 'bad timezone'),
    worker_id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .refine((v) => !Number.isNaN(Date.parse(v.from)) && !Number.isNaN(Date.parse(v.to)), 'bad date')
  .refine((v) => v.from <= v.to, 'from must be <= to')
  .refine((v) => Date.parse(v.to) - Date.parse(v.from) <= 3700 * 24 * 3600 * 1000, 'range too large')

export type Range = z.infer<typeof rangeSchema>

export function rangeFromSearchParams(sp: URLSearchParams): Range {
  return rangeSchema.parse({
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    tz: sp.get('tz') ?? '',
    worker_id: sp.get('worker_id') || undefined,
  })
}
