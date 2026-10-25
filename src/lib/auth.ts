import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const a = scryptSync(pw, salt, 32)
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production')
  return s ?? 'dev-only-secret'
}
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('hex')

/** Admin session cookie value, scoped to one community slug so it never unlocks another. */
export function makeSession(slug: string, ttlHours = 12, now = Date.now()): string {
  const body = `${slug}.${now + ttlHours * 3600_000}`
  return `${body}.${sign(body)}`
}
export function checkSession(value: string | undefined, slug: string, now = Date.now()): boolean {
  if (!value) return false
  const i = value.lastIndexOf('.')
  const body = value.slice(0, i)
  const sig = value.slice(i + 1)
  const expected = sign(body)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  const [s, exp] = [body.slice(0, body.lastIndexOf('.')), Number(body.slice(body.lastIndexOf('.') + 1))]
  return s === slug && exp > now
}

export const newToken = () => randomBytes(18).toString('base64url')
export const newRef = () => `HR-${randomBytes(4).toString('hex').toUpperCase()}`
