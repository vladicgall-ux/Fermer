// Генерирует подписанный initData для локальной разработки вне Telegram.
// Использование: TELEGRAM_BOT_TOKEN=... npm run dev:initdata -- [telegram_id] [имя]
// Результат положите в .env.local как NEXT_PUBLIC_DEV_INIT_DATA (работает только в `next dev`).
import { signInitData } from '../src/lib/telegram-auth.ts'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set')
  process.exit(1)
}
const id = Number(process.argv[2] ?? 1)
const name = process.argv[3] ?? 'Dev User'
const initData = signInitData(
  {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'dev',
    user: JSON.stringify({ id, first_name: name, language_code: 'ru' }),
  },
  token,
)
console.log(`NEXT_PUBLIC_DEV_INIT_DATA=${initData}`)
console.error('Внимание: initData действителен INITDATA_MAX_AGE_SEC секунд (по умолчанию 24 часа).')
