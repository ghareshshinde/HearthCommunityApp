'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { checkSession, makeSession, verifyPassword } from '@/lib/auth'
import { cookieName } from '@/lib/session'
import * as repo from '@/lib/repo'
import { persist } from '@/lib/persist'
import { allow } from '@/lib/ratelimit'
import { deliverEmails } from '@/lib/mail'
import { normalizeMobile } from '@/lib/registration/rules'
import { hashPassword } from '@/lib/auth'
import type { Contact, SubmitResult } from '@/lib/repo'
import type { ParticipantInput } from '@/lib/registration/rules'
import { brandingOverrideSchema } from '@/lib/branding/tokens'
import { resolveBranding, validateContrast } from '@/lib/branding/resolve'
import { istInputToIso } from '@/lib/time'
import { DEFAULT_COLUMNS, RULE_KEYS, parseQuestions, parseRules, type OptionalColumn } from '@/lib/registration/rules'

async function adminCtx(slug: string) {
  const c = repo.getCommunityBySlug(slug)
  if (!c || !checkSession((await cookies()).get(cookieName(slug))?.value, slug)) throw new Error('Not authorised')
  return c
}

// ---------- public ----------
export async function submitRegistration(slug: string, eventId: number, contact: Contact, rows: ParticipantInput[]): Promise<SubmitResult> {
  const c = repo.getCommunityBySlug(slug)
  const ev = c && repo.getEvent(c.id, eventId)
  if (!c || !ev) return { ok: false, error: 'Event not found' }
  const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  if (!allow(`reg:${ip}`, 100, 10 * 60_000)) return { ok: false, error: 'Too many registrations from this connection. Please wait a few minutes and try again.' }
  const r = repo.createRegistration(ev, contact, rows)
  if (!r.ok) return r
  const saved = await savedOrError(r)
  if (saved.ok) await deliverEmails()
  return saved
}

export type FindState = { error?: string; values?: { ref: string; mobile: string } }
export type EmailLinksState = { message?: string; error?: string }
/** Lost-link recovery: the reference plus the registrant's mobile number leads back to the edit page. */
export async function findMyRegistration(slug: string, _prev: FindState | undefined, form: FormData): Promise<FindState> {
  const c = repo.getCommunityBySlug(slug)
  const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const values = { ref: String(form.get('ref') ?? ''), mobile: String(form.get('mobile') ?? '') }
  if (!c || !allow(`find:${ip}`, 10, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.', values }
  const token = repo.findTokenByRefAndMobile(c.id, values.ref, normalizeMobile(values.mobile))
  if (!token) return { error: 'We could not find a registration with that reference and mobile number.', values }
  redirect(`/c/${slug}/r/${token}`)
}

/** Make the write durable before telling the person it worked (a no-op when no bucket is configured). */
async function savedOrError<T extends { ok: boolean }>(r: T): Promise<T | { ok: false; error: string }> {
  try {
    await persist()
    return r
  } catch (e) {
    console.error('persist failed', e)
    return { ok: false, error: 'We could not store this safely. Please try again in a minute.' }
  }
}

export async function editRegistration(token: string, contact: Contact, rows: ParticipantInput[]): Promise<SubmitResult> {
  const reg = repo.getRegistrationByToken(token)
  const ev = reg && repo.getEvent(reg.community_id, reg.event_id)
  if (!reg || !ev) return { ok: false, error: 'Registration not found' }
  const r = repo.updateRegistration(ev, reg, contact, rows)
  return r.ok ? savedOrError(r) : r
}

export async function cancelOwnRegistration(token: string) {
  const reg = repo.getRegistrationByToken(token)
  const ev = reg && repo.getEvent(reg.community_id, reg.event_id)
  if (reg && ev) repo.cancelRegistration(ev, reg, 'public')
  await persist()
  revalidatePath('/c')
}

// ---------- admin auth ----------
const attempts = new Map<string, { n: number; until: number }>()
export async function adminLogin(slug: string, _prev: { error?: string } | undefined, form: FormData) {
  const c = repo.getCommunityBySlug(slug)
  const ip = (await headers()).get('x-forwarded-for') ?? 'local'
  const key = `${slug}:${ip}`
  const a = attempts.get(key)
  if (a && a.n >= 5 && a.until > Date.now()) return { error: 'Too many attempts. Try again in a few minutes.' }
  if (!c || !verifyPassword(String(form.get('password') ?? ''), c.admin_hash)) {
    attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 5 * 60_000 })
    repo.audit(c?.id ?? null, 'anonymous', 'admin.login_failed', slug)
    return { error: 'Incorrect password' }
  }
  attempts.delete(key)
  ;(await cookies()).set(cookieName(slug), makeSession(slug), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 })
  repo.audit(c.id, 'admin', 'admin.login', slug)
  redirect(`/c/${slug}/admin`)
}
/** First run with no ADMIN_PASSWORD set: the first visitor chooses it, once. After that this does nothing. */
export async function adminSetup(slug: string, _prev: { error?: string } | undefined, form: FormData) {
  const c = repo.getCommunityBySlug(slug)
  if (!c || c.admin_hash) return { error: 'The admin password is already set. Sign in instead.' }
  const pw = String(form.get('password') ?? '')
  if (pw.length < 10) return { error: 'Use at least 10 characters.' }
  if (pw !== String(form.get('again') ?? '')) return { error: 'The two passwords differ.' }
  repo.setAdminPassword(c.id, hashPassword(pw))
  repo.audit(c.id, 'admin', 'admin.password_set_first_run', slug)
  await persist()
  ;(await cookies()).set(cookieName(slug), makeSession(slug), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 })
  redirect(`/c/${slug}/admin`)
}
export async function adminLogout(slug: string) {
  ;(await cookies()).delete(cookieName(slug))
  redirect(`/c/${slug}`)
}

// ---------- admin: events ----------
export async function saveEventAction(slug: string, eventId: number | null, form: FormData) {
  const c = await adminCtx(slug)
  const cols = Object.fromEntries((Object.keys(DEFAULT_COLUMNS) as OptionalColumn[]).map((k) => [k, { show: form.get(`show_${k}`) === 'on', required: form.get(`req_${k}`) === 'on' }]))
  const sports: string[] = []
  const capacity: Record<string, number> = {}
  const ages: Record<string, { min?: number; max?: number }> = {}
  for (let i = 0; form.has(`sport_name_${i}`); i++) {
    const name = String(form.get(`sport_name_${i}`) ?? '').trim()
    if (!name || sports.includes(name)) continue
    sports.push(name)
    const cap = Number(form.get(`sport_cap_${i}`)), min = Number(form.get(`sport_min_${i}`)), max = Number(form.get(`sport_max_${i}`))
    if (cap > 0) capacity[name] = Math.floor(cap)
    if (min > 0 || max > 0) ages[name] = { min: min > 0 ? min : undefined, max: max > 0 ? max : undefined }
  }
  const title = String(form.get('title') ?? '').trim()
  if (!title || !sports.length) throw new Error('Title and at least one sport are required')
  const waiver = String(form.get('waiver') ?? '').trim().slice(0, 1000)
  const questions = parseQuestions(Array.from({ length: 5 }, (_, i) => ({ label: form.get(`q_label_${i}`), kind: String(form.get(`q_options_${i}`) ?? '').trim() ? 'choice' : 'text', options: String(form.get(`q_options_${i}`) ?? '').split(','), required: form.get(`q_required_${i}`) === 'on' })))
  const ruleSports: Record<string, Record<string, string>> = {}
  for (let i = 0; form.has(`rule_sport_${i}`); i++) {
    const sp = String(form.get(`rule_sport_${i}`))
    if (!sports.includes(sp)) continue
    ruleSports[sp] = Object.fromEntries(RULE_KEYS.map((k) => [k, String(form.get(`rule_${i}_${k}`) ?? '')]))
  }
  const rules = parseRules({ general: form.get('rule_general'), sports: ruleSports })
  const diets = [...new Set([...form.getAll('diet_opt').map(String), ...String(form.get('diet_custom') ?? '').split(',')].map((d) => d.trim().slice(0, 30)).filter(Boolean))].slice(0, 12)
  const existing = eventId ? JSON.parse(repo.getEvent(c.id, eventId)?.config || '{}') : {}
  const id = repo.saveEvent(c.id, eventId, {
    title, description: String(form.get('description') ?? ''), venue: String(form.get('venue') ?? ''), map_url: String(form.get('map_url') ?? ''),
    starts_at: istInputToIso(String(form.get('starts_at') ?? '')), ends_at: istInputToIso(String(form.get('ends_at') ?? '')),
    cutoff_at: istInputToIso(String(form.get('cutoff_at') ?? '')), sports: JSON.stringify(sports), config: JSON.stringify({ ...existing, columns: cols, diets, questions, rules, capacity, ages, waiver, approvalRequired: form.get('approvalRequired') === 'on', contactEmailRequired: form.get('contactEmailRequired') === 'on' }),
    status: (['draft', 'published', 'closed'].includes(String(form.get('status'))) ? String(form.get('status')) : 'draft') as 'draft',
  })
  repo.audit(c.id, 'admin', eventId ? 'event.updated' : 'event.created', String(id), { title })
  await persist()
  redirect(`/c/${slug}/admin/events/${id}`)
}

// ---------- admin: workspace ----------
export async function editParticipantAction(slug: string, id: number, field: repo.EditableField, value: string) {
  const c = await adminCtx(slug)
  if (!repo.EDITABLE.includes(field)) return { ok: false as const, error: 'Field not editable' }
  const r = repo.adminEditParticipant(c.id, id, field, value, 'admin')
  await persist()
  revalidatePath(`/c/${slug}/admin`)
  return r
}
export async function bulkActionForm(slug: string, eventId: number, form: FormData) {
  const c = await adminCtx(slug)
  const action = String(form.get('action')) as repo.BulkAction
  if (!['verify', 'unverify', 'confirm', 'reject', 'cancel', 'member', 'guest', 'promote'].includes(action)) return
  const ids = form.getAll('ids').map(Number).filter(Number.isInteger)
  repo.bulkAction(c.id, ids, action, 'admin', String(form.get('note') ?? '').trim())
  await persist()
  revalidatePath(`/c/${slug}/admin`)
  redirect(`/c/${slug}/admin/events/${eventId}/registrations?${new URLSearchParams(String(form.get('qs') ?? ''))}`)
}

// ---------- admin: branding ----------
export async function saveBrandingAction(slug: string, _prev: { error?: string; ok?: boolean } | undefined, form: FormData) {
  const c = await adminCtx(slug)
  const colors = Object.fromEntries(['primary', 'secondary', 'accent', 'background', 'surface', 'textPrimary', 'textSecondary'].map((k) => [k, String(form.get(k) ?? '')]).filter(([, v]) => v))
  const draft = { name: String(form.get('name') ?? '') || undefined, tagline: String(form.get('tagline') ?? '') || undefined, colors }
  const parsed = brandingOverrideSchema.safeParse(draft)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  // A save is blocked if any colour pair fails WCAG AA (resolveBranding would silently fall back to defaults).
  const base = resolveBranding({})
  const candidate = { ...base, colors: { ...base.colors, ...parsed.data.colors } }
  if (validateContrast(candidate).length) {
    return { error: 'These colours fail the WCAG AA contrast check (text must be readable). Choose darker text or lighter backgrounds.' }
  }
  repo.saveBranding(c.id, parsed.data)
  repo.audit(c.id, 'admin', 'branding.updated')
  await persist()
  revalidatePath(`/c/${slug}`)
  return { ok: true }
}

// ---------- admin: change password ----------
export async function changePasswordAction(slug: string, _prev: { error?: string; ok?: boolean } | undefined, form: FormData) {
  const c = await adminCtx(slug)
  const current = String(form.get('current') ?? '')
  const next = String(form.get('next') ?? '')
  if (!verifyPassword(current, c.admin_hash)) return { error: 'Current password is incorrect' }
  if (next.length < 10) return { error: 'Use at least 10 characters' }
  if (next !== String(form.get('confirm') ?? '')) return { error: 'The two new passwords do not match' }
  repo.setAdminPassword(c.id, hashPassword(next))
  repo.audit(c.id, 'admin', 'admin.password_changed')
  await persist()
  return { ok: true }
}

// ---------- admin: approve or reject ----------
export async function decideRegistrationAction(slug: string, eventId: number, registrationId: number, decision: 'approve' | 'reject', form: FormData) {
  const c = await adminCtx(slug)
  const note = String(form.get('note') ?? '').trim()
  if (decision === 'approve') repo.approveRegistration(c.id, registrationId, 'admin', note)
  else repo.rejectRegistration(c.id, registrationId, 'admin', note)
  await persist()
  revalidatePath(`/c/${slug}/admin`)
  redirect(`/c/${slug}/admin/events/${eventId}/review`)
}

export async function retryEmailsAction(slug: string) {
  const c = await adminCtx(slug)
  const { sendQueued } = await import('@/lib/mail')
  const r = await sendQueued(50)
  repo.audit(c.id, 'admin', 'email.retry', null, r)
  await persist()
  revalidatePath(`/c/${slug}/admin/audit`)
}

/** "Email me my links": always answers the same way, so nobody can use it to learn which addresses are registered. */
export async function emailMyLinks(slug: string, _prev: EmailLinksState | undefined, form: FormData): Promise<EmailLinksState> {
  const c = repo.getCommunityBySlug(slug)
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  if (!c) return { error: 'Not found' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return { error: 'Enter a valid email address.' }
  const { mailConfigured } = await import('@/lib/mail')
  if (!mailConfigured()) return { error: 'Email is not switched on yet. Use your reference and mobile number instead, or ask a volunteer at the venue.' }
  if (!allow(`links-ip:${ip}`, 5, 10 * 60_000) || !allow(`links-mail:${email}`, 3, 60 * 60_000)) return { error: 'Too many requests. Please wait a while and try again.' }
  repo.queueLinksEmail(c.id, email)
  await persist()
  await deliverEmails()
  return { message: 'If that address was used to register, we have emailed the links. Check your inbox and spam folder.' }
}
