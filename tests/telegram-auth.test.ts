import assert from 'node:assert/strict'
import { test } from 'node:test'
import { signInitData, validateInitData } from '../src/lib/telegram-auth.ts'
import { csvCell, signExportToken, verifyExportToken } from '../src/lib/export-token.ts'

const TOKEN = '123456:TEST-token'
const now = 1_700_000_000
const user = JSON.stringify({ id: 42, first_name: 'Иван', last_name: 'Петров', username: 'ivan' })
const opts = { maxAgeSec: 3600, nowSec: now }

test('accepts correctly signed initData', () => {
  const data = signInitData({ auth_date: String(now - 10), query_id: 'q', user }, TOKEN)
  const r = validateInitData(data, TOKEN, opts)
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.user.id, 42)
})

test('accepts initData with signature field (Bot API 8.0+)', () => {
  const data = signInitData({ auth_date: String(now), signature: 'abc', user }, TOKEN)
  assert.equal(validateInitData(data, TOKEN, opts).ok, true)
})

test('rejects wrong bot token', () => {
  const data = signInitData({ auth_date: String(now), user }, TOKEN)
  assert.equal(validateInitData(data, '999:other', opts).ok, false)
})

test('rejects tampered user', () => {
  const p = new URLSearchParams(signInitData({ auth_date: String(now), user }, TOKEN))
  p.set('user', JSON.stringify({ id: 1, first_name: 'Admin' }))
  assert.equal(validateInitData(p.toString(), TOKEN, opts).ok, false)
})

test('rejects expired and future auth_date', () => {
  const old = signInitData({ auth_date: String(now - 7200), user }, TOKEN)
  assert.equal(validateInitData(old, TOKEN, opts).ok, false)
  const future = signInitData({ auth_date: String(now + 3600), user }, TOKEN)
  assert.equal(validateInitData(future, TOKEN, opts).ok, false)
})

test('rejects missing/malformed hash, empty token, duplicates', () => {
  const data = signInitData({ auth_date: String(now), user }, TOKEN)
  const p = new URLSearchParams(data)
  p.delete('hash')
  assert.equal(validateInitData(p.toString(), TOKEN, opts).ok, false)
  assert.equal(validateInitData(data.replace(/hash=[0-9a-f]+/, 'hash=zz'), TOKEN, opts).ok, false)
  assert.equal(validateInitData(data, '', opts).ok, false)
  assert.equal(validateInitData('', TOKEN, opts).ok, false)
  assert.equal(validateInitData(`${data}&auth_date=${now}`, TOKEN, opts).ok, false)
})

test('export token: roundtrip, expiry, tamper', () => {
  const t = signExportToken({ u: 1, from: '2026-01-01', to: '2026-01-31', tz: 'UTC', exp: now + 60 }, TOKEN)
  assert.equal(verifyExportToken(t, TOKEN, now)?.u, 1)
  assert.equal(verifyExportToken(t, TOKEN, now + 120), null)
  assert.equal(verifyExportToken(t, 'other', now), null)
  const sig = t.split('.')[1]
  const forged = Buffer.from(JSON.stringify({ u: 2, from: 'x', to: 'y', tz: 'UTC', exp: now + 60 })).toString('base64url')
  assert.equal(verifyExportToken(`${forged}.${sig}`, TOKEN, now), null)
})

test('csvCell escapes separators and neutralises formulas', () => {
  assert.equal(csvCell('a;b'), '"a;b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell(-5), '-5')
})
