// Usage: node scripts/loadtest.mjs http://localhost:3100 [families=300] [concurrency=300]
// Captures one real browser submission, then replays it for many families at once, each with its own
// connection address, key and mobile number, and reports timings, failures and what the database ended up with.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const base = process.argv[2] ?? 'http://localhost:3000'
const families = Number(process.argv[3] ?? 300), conc = Number(process.argv[4] ?? families)

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const page = await browser.newPage()
let captured
page.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) captured = { headers: r.headers(), body: r.postData() } })
await page.goto(`${base}/c/jsg/e/1/register`); await page.waitForLoadState('networkidle')
await page.getByLabel('Your name').fill('Load Probe'); await page.getByLabel('Your mobile').fill('9000000001')
await page.getByLabel(/^Your email/).fill('probe@example.test'); await page.getByLabel('Emergency contact name').fill('Em Contact'); await page.getByLabel('Emergency contact mobile').fill('9899999999')
await page.locator('[data-r="0"][data-c="name"]').fill('Probe Person'); await page.locator('[data-r="0"][data-c="age"]').fill('30'); await page.locator('[data-r="0"][data-c="gender"]').selectOption('Male')
await page.locator('[data-r="0"][data-c="mobile"]').fill('9000000001'); await page.locator('td[data-label="Sports"] label', { hasText: 'Chess' }).first().click()
await page.locator('[data-r="0"][data-c^="skill-"]').first().selectOption('casual'); await page.getByLabel('I accept the injury waiver').check()
await page.getByRole('button', { name: 'Submit registration' }).click(); await page.waitForURL(/\/r\//)
const probeUrl = page.url().split('?')[0]
await browser.close()
console.log(`Probe registration saved. After a restart this link must still open: ${probeUrl}`)
if (!captured) throw new Error('could not capture the submission')

const skip = new Set(['content-length', 'host', 'connection', 'cookie'])
const headers = Object.fromEntries(Object.entries(captured.headers).filter(([k]) => !skip.has(k)))
const args = JSON.parse(captured.body)
const lat = [], errors = []
// Names must be English letters only, so numbers become letters.
const letters = (n) => { let s = ''; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0); return s }
let next = 0
async function one(i) {
  const a = structuredClone(args)
  const contact = a.find((x) => x && typeof x === 'object' && 'registrantName' in x)
  const rows = a.find((x) => Array.isArray(x))
  const mob = String(9100000000 + i)
  contact.submissionKey = `load-${Date.now()}-${i}-xxxxxxxx`; contact.registrantMobile = mob; contact.registrantName = `Family ${letters(i)}`
  for (let k = 0; k < 4; k++) { const r = structuredClone(rows[0]); r.name = `Person ${letters(i)} ${letters(k)}`; r.mobile = k ? '' : mob; r.age = k ? '9' : '35'; rows[k] = r }
  const t0 = performance.now()
  try {
    const res = await fetch(`${base}/c/jsg/e/1/register`, { method: 'POST', headers: { ...headers, 'x-forwarded-for': `10.${i % 250}.${(i >> 8) & 255}.${(i * 7) % 250}` }, body: JSON.stringify(a) })
    const text = await res.text()
    lat.push(performance.now() - t0)
    if (!res.ok || !/"ok":true/.test(text)) errors.push(`${i}: ${res.status} ${text.slice(0, 160)}`)
  } catch (e) { errors.push(`${i}: ${e.message}`) }
}
const t0 = performance.now()
await Promise.all(Array.from({ length: conc }, async () => { while (next < families) await one(next++) }))
const secs = (performance.now() - t0) / 1000
lat.sort((a, b) => a - b)
const q = (p) => Math.round(lat[Math.min(lat.length - 1, Math.floor(lat.length * p))])
console.log(JSON.stringify({ families, concurrency: conc, seconds: Math.round(secs * 10) / 10, perSecond: Math.round(families / secs), p50ms: q(0.5), p95ms: q(0.95), maxms: Math.round(lat.at(-1)), failed: errors.length, sample: errors.slice(0, 3) }, null, 1))
