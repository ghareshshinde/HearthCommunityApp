import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getDb } from './db'
import { hashPassword, signValue, verifyPassword } from './auth'

export type StaffRole = 'sport' | 'sports_all' | 'gate'
export type StaffRow = {
  id: number; community_id: number; name: string; role: StaffRole; sport: string | null; username: string
  password_hash: string; invite_hash: string | null; invite_expires_at: string | null; active: number; created_at: string
}
export type StaffCredentials = { staff: StaffRow; username: string; password: string; inviteToken: string; inviteExpiresAt: string }

const db = () => getDb()
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alike characters, easy to read over the phone
const randomPassword = () => Array.from(randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join('')
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function nextUsername(cid: number, base: string) {
  const taken = new Set((db().prepare('select username from staff where community_id = ?').all(cid) as { username: string }[]).map((r) => r.username))
  for (let n = 1; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Default invite life: until 24 hours after the event ends (SP1), or 7 days when no end time is set. */
export function inviteExpiry(endsAt: string | null, now = new Date()): string {
  const end = endsAt ? new Date(endsAt).getTime() + 24 * 3600_000 : now.getTime() + 7 * 86400_000
  return new Date(Math.max(end, now.getTime() + 3600_000)).toISOString()
}

export function createStaff(cid: number, input: { name: string; role: StaffRole; sport?: string | null }, expiresAt: string): StaffCredentials {
  if (input.role === 'sport' && !input.sport) throw new Error('A sport admin needs a sport')
  const base = input.role === 'gate' ? 'gate' : input.role === 'sports_all' ? 'sports' : slug(input.sport!)
  const username = nextUsername(cid, base)
  const password = randomPassword()
  const inviteToken = randomBytes(18).toString('base64url')
  const id = Number(db().prepare('insert into staff (community_id,name,role,sport,username,password_hash,invite_hash,invite_expires_at) values (?,?,?,?,?,?,?,?)')
    .run(cid, input.name.trim() || username, input.role, input.role === 'sport' ? input.sport! : null, username, hashPassword(password), sha(inviteToken), expiresAt).lastInsertRowid)
  return { staff: getStaff(cid, id)!, username, password, inviteToken, inviteExpiresAt: expiresAt }
}

export const getStaff = (cid: number, id: number) => db().prepare('select * from staff where community_id = ? and id = ?').get(cid, id) as StaffRow | undefined
export const listStaff = (cid: number) => db().prepare('select * from staff where community_id = ? order by role, sport, username').all(cid) as StaffRow[]

export function verifyStaffLogin(cid: number, username: string, password: string): StaffRow | null {
  const s = db().prepare('select * from staff where community_id = ? and username = ? and active = 1').get(cid, username.trim().toLowerCase()) as StaffRow | undefined
  return s && verifyPassword(password, s.password_hash) ? s : null
}

export function staffByInvite(cid: number, token: string, now = new Date()): StaffRow | null {
  const h = sha(token)
  const s = db().prepare('select * from staff where community_id = ? and invite_hash = ? and active = 1').get(cid, h) as StaffRow | undefined
  if (!s || !s.invite_hash || !s.invite_expires_at || new Date(s.invite_expires_at) < now) return null
  return timingSafeEqual(Buffer.from(h), Buffer.from(s.invite_hash)) ? s : null
}

export function setStaffActive(cid: number, id: number, active: boolean) {
  db().prepare('update staff set active = ? where community_id = ? and id = ?').run(active ? 1 : 0, cid, id)
}

/** New password and invite link for someone who lost theirs. The old ones stop working at once. */
export function resetStaffCredentials(cid: number, id: number, expiresAt: string): StaffCredentials | null {
  const s = getStaff(cid, id)
  if (!s) return null
  const password = randomPassword()
  const inviteToken = randomBytes(18).toString('base64url')
  db().prepare('update staff set password_hash = ?, invite_hash = ?, invite_expires_at = ?, active = 1 where community_id = ? and id = ?')
    .run(hashPassword(password), sha(inviteToken), expiresAt, cid, id)
  return { staff: getStaff(cid, id)!, username: s.username, password, inviteToken, inviteExpiresAt: expiresAt }
}

/** The PRD asks for two admins per sport plus two common sports admins, so someone is always around. */
export function coverage(cid: number, sports: string[]) {
  const rows = listStaff(cid).filter((s) => s.active)
  const perSport = Object.fromEntries(sports.map((sp) => [sp, rows.filter((s) => s.role === 'sport' && s.sport === sp).length]))
  return { perSport, common: rows.filter((s) => s.role === 'sports_all').length, gate: rows.filter((s) => s.role === 'gate').length }
}

export function seedStandardStaff(cid: number, sports: string[], expiresAt: string): StaffCredentials[] {
  const have = coverage(cid, sports)
  const out: StaffCredentials[] = []
  for (const sp of sports) for (let i = have.perSport[sp]; i < 2; i++) out.push(createStaff(cid, { name: `${sp} admin`, role: 'sport', sport: sp }, expiresAt))
  for (let i = have.common; i < 2; i++) out.push(createStaff(cid, { name: 'Common sports admin', role: 'sports_all' }, expiresAt))
  for (let i = have.gate; i < 2; i++) out.push(createStaff(cid, { name: 'Gate volunteer', role: 'gate' }, expiresAt))
  return out
}

// ---------- sessions ----------
export function makeStaffSession(slugName: string, staffId: number, ttlHours = 12, now = Date.now()) {
  const body = `${slugName}.${staffId}.${now + ttlHours * 3600_000}`
  return `${body}.${signValue(`staff:${body}`)}`
}
/** Returns the staff id when the cookie is genuine, for this community and not expired. */
export function readStaffSession(value: string | undefined, slugName: string, now = Date.now()): number | null {
  if (!value) return null
  const i = value.lastIndexOf('.')
  const body = value.slice(0, i), sig = value.slice(i + 1)
  const expected = signValue(`staff:${body}`)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  const [s, id, exp] = body.split('.')
  return s === slugName && Number(exp) > now && Number.isInteger(Number(id)) ? Number(id) : null
}
