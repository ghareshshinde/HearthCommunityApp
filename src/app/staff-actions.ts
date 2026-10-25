'use server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import * as repo from '@/lib/repo'
import * as staff from '@/lib/staff'
import { persist } from '@/lib/persist'
import { canCheckIn, gateCookieName, getActor, staffCookieName } from '@/lib/session'
import type { ParticipantInput } from '@/lib/registration/rules'

const tries = new Map<string, { n: number; until: number }>()

async function adminOnly(slug: string) {
  const c = repo.getCommunityBySlug(slug)
  const a = await getActor(slug)
  if (!c || a?.kind !== 'admin') throw new Error('Not authorised')
  return c
}
async function gateActor(slug: string) {
  const c = repo.getCommunityBySlug(slug)
  const a = await getActor(slug)
  if (!c || !canCheckIn(a)) throw new Error('Not authorised')
  return { c, a: a! }
}
const currentGate = async (slug: string) => (await cookies()).get(gateCookieName(slug))?.value ?? ''

// ---------- sign-in ----------
export async function staffLogin(slug: string, _prev: { error?: string } | undefined, form: FormData) {
  const c = repo.getCommunityBySlug(slug)
  const key = `${slug}:${(await headers()).get('x-forwarded-for') ?? 'local'}`
  const t = tries.get(key)
  if (t && t.n >= 8 && t.until > Date.now()) return { error: 'Too many attempts. Try again in a few minutes.' }
  const s = c && staff.verifyStaffLogin(c.id, String(form.get('username') ?? ''), String(form.get('password') ?? ''))
  if (!c || !s) {
    tries.set(key, { n: (t && t.until > Date.now() ? t.n : 0) + 1, until: Date.now() + 5 * 60_000 })
    return { error: 'Wrong username or password' }
  }
  tries.delete(key)
  ;(await cookies()).set(staffCookieName(slug), staff.makeStaffSession(slug, s.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 })
  repo.audit(c.id, s.name, 'staff.login', s.username)
  redirect(`/c/${slug}/staff`)
}
export async function staffLogout(slug: string) {
  ;(await cookies()).delete(staffCookieName(slug))
  redirect(`/c/${slug}/staff/login`)
}

// ---------- gate ----------
export async function setGate(slug: string, form: FormData) {
  await gateActor(slug)
  ;(await cookies()).set(gateCookieName(slug), String(form.get('gate') ?? '').slice(0, 40), { path: '/', maxAge: 24 * 3600, sameSite: 'lax' })
  revalidatePath(`/c/${slug}/staff/gate`)
}

export async function checkInAction(slug: string, ticket: string, form: FormData) {
  const { c, a } = await gateActor(slug)
  const ids = form.getAll('ids').map(Number).filter(Number.isInteger)
  repo.checkIn(c.id, ids, a.label, await currentGate(slug))
  await persist()
  redirect(`/c/${slug}/staff/gate?t=${encodeURIComponent(ticket)}&done=${ids.length}`)
}

export async function undoCheckInAction(slug: string, ticket: string, participantId: number) {
  const { c, a } = await gateActor(slug)
  repo.undoCheckIn(c.id, participantId, a.label)
  await persist()
  redirect(`/c/${slug}/staff/gate?t=${encodeURIComponent(ticket)}`)
}

export type WalkInState = { error?: string; ok?: string; rowErrors?: Record<string, string>; contactErrors?: Record<string, string> }
export async function walkInAction(slug: string, eventId: number, registrationId: number | null, ticket: string, _prev: WalkInState | undefined, form: FormData): Promise<WalkInState> {
  const { c, a } = await gateActor(slug)
  const ev = repo.getEvent(c.id, eventId)
  if (!ev) return { error: 'Event not found' }
  const person: ParticipantInput = {
    name: String(form.get('name') ?? ''), age: String(form.get('age') ?? ''), gender: String(form.get('gender') ?? ''), mobile: String(form.get('mobile') ?? ''),
    email: '', sports: form.getAll('sports').map(String), skill: String(form.get('skill') ?? ''), diet: String(form.get('diet') ?? 'Vegetarian'),
    tshirt: '', accessibility: '', kind: String(form.get('kind') ?? 'guest'),
  }
  const adult = Number(person.age) >= 18
  const r = repo.addWalkIn(ev, {
    person, registrationId: registrationId ?? undefined, waiver: form.get('waiver') === 'on', by: a.label, gate: await currentGate(slug) || 'Spot desk',
    contact: registrationId ? undefined : {
      name: adult ? person.name : String(form.get('guardianName') ?? ''), mobile: adult ? person.mobile : String(form.get('guardianMobile') ?? ''),
      emergencyName: String(form.get('emergencyName') ?? ''), emergencyMobile: String(form.get('emergencyMobile') ?? ''),
    },
  })
  if (!r.ok) return { error: r.error, rowErrors: r.rowErrors, contactErrors: r.contactErrors }
  try { await persist() } catch (e) { console.error(e); return { error: 'Saved here but not yet backed up. Check the connection and press the button again to retry.' } }
  revalidatePath(`/c/${slug}/staff/gate`)
  if (registrationId) redirect(`/c/${slug}/staff/gate?t=${encodeURIComponent(ticket)}&done=1`)
  const reg = repo.getRegistrationById(c.id, r.registrationId)!
  redirect(`/c/${slug}/staff/gate?t=${encodeURIComponent((await import('@/lib/ticket')).makeTicket(reg.id))}&done=1`)
}

// ---------- admin: staff ----------
export type Issued = { name: string; role: string; sport: string | null; username: string; password: string; invite: string; expires: string }
export type StaffState = { error?: string; issued?: Issued[] }

function toIssued(base: string, slug: string, cred: staff.StaffCredentials): Issued {
  return { name: cred.staff.name, role: cred.staff.role, sport: cred.staff.sport, username: cred.username, password: cred.password, invite: `${base}/c/${slug}/staff/join/${cred.inviteToken}`, expires: cred.inviteExpiresAt }
}
const baseUrl = async () => {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
}

function eventFor(c: { id: number }, form: FormData) {
  const ev = repo.getEvent(c.id, Number(form.get('eventId')))
  return ev
}

export async function createStaffAction(slug: string, _prev: StaffState | undefined, form: FormData): Promise<StaffState> {
  const c = await adminOnly(slug)
  const ev = eventFor(c, form)
  if (!ev) return { error: 'Pick an event first' }
  const role = String(form.get('role')) as staff.StaffRole
  const sport = String(form.get('sport') ?? '') || null
  if (!['sport', 'sports_all', 'gate'].includes(role)) return { error: 'Choose a role' }
  if (role === 'sport' && (!sport || !(JSON.parse(ev.sports) as string[]).includes(sport))) return { error: 'Choose a sport for a sport admin' }
  const cred = staff.createStaff(c.id, { name: String(form.get('name') ?? ''), role, sport }, staff.inviteExpiry(ev.ends_at))
  repo.audit(c.id, 'admin', 'staff.created', cred.username, { role, sport })
  await persist()
  revalidatePath(`/c/${slug}/admin/staff`)
  return { issued: [toIssued(await baseUrl(), slug, cred)] }
}

export async function seedStaffAction(slug: string, _prev: StaffState | undefined, form: FormData): Promise<StaffState> {
  const c = await adminOnly(slug)
  const ev = eventFor(c, form)
  if (!ev) return { error: 'Pick an event first' }
  const made = staff.seedStandardStaff(c.id, JSON.parse(ev.sports), staff.inviteExpiry(ev.ends_at))
  repo.audit(c.id, 'admin', 'staff.standard_set', null, { created: made.length })
  await persist()
  revalidatePath(`/c/${slug}/admin/staff`)
  const base = await baseUrl()
  return { issued: made.map((m) => toIssued(base, slug, m)) }
}

export async function resetStaffAction(slug: string, staffId: number, _prev: StaffState | undefined, form: FormData): Promise<StaffState> {
  const c = await adminOnly(slug)
  const ev = eventFor(c, form)
  const cred = staff.resetStaffCredentials(c.id, staffId, staff.inviteExpiry(ev?.ends_at ?? null))
  if (!cred) return { error: 'Not found' }
  repo.audit(c.id, 'admin', 'staff.reset', cred.username)
  await persist()
  revalidatePath(`/c/${slug}/admin/staff`)
  const base = await baseUrl()
  return { issued: [toIssued(base, slug, cred)] }
}

export async function setStaffActiveAction(slug: string, staffId: number, active: boolean) {
  const c = await adminOnly(slug)
  staff.setStaffActive(c.id, staffId, active)
  repo.audit(c.id, 'admin', active ? 'staff.enabled' : 'staff.revoked', String(staffId))
  await persist()
  revalidatePath(`/c/${slug}/admin/staff`)
}

export async function saveDeskSettingsAction(slug: string, eventId: number, form: FormData) {
  const c = await adminOnly(slug)
  const ev = repo.getEvent(c.id, eventId)
  if (!ev) throw new Error('Event not found')
  const cfg = JSON.parse(ev.config || '{}')
  cfg.gates = String(form.get('gates') ?? '').split('\n').map((g) => g.trim()).filter(Boolean).slice(0, 12)
  cfg.spot = { open: form.get('spotOpen') === 'on', cap: Math.max(0, Math.floor(Number(form.get('spotCap')) || 0)) }
  repo.saveEvent(c.id, ev.id, { ...ev, config: JSON.stringify(cfg) })
  repo.audit(c.id, 'admin', 'desk.settings', String(ev.id), { gates: cfg.gates, spot: cfg.spot })
  await persist()
  revalidatePath(`/c/${slug}/admin`)
  redirect(`/c/${slug}/admin/staff?event=${ev.id}`)
}
