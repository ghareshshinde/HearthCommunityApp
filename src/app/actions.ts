'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { checkSession, makeSession, verifyPassword } from '@/lib/auth'
import { cookieName } from '@/lib/session'
import * as repo from '@/lib/repo'
import type { Contact, SubmitResult } from '@/lib/repo'
import type { ParticipantInput } from '@/lib/registration/rules'
import { brandingOverrideSchema } from '@/lib/branding/tokens'
import { resolveBranding, validateContrast } from '@/lib/branding/resolve'
import { istInputToIso } from '@/lib/time'
import { DEFAULT_COLUMNS, type OptionalColumn } from '@/lib/registration/rules'

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
  return repo.createRegistration(ev, contact, rows)
}

export async function editRegistration(token: string, contact: Contact, rows: ParticipantInput[]): Promise<SubmitResult> {
  const reg = repo.getRegistrationByToken(token)
  const ev = reg && repo.getEvent(reg.community_id, reg.event_id)
  if (!reg || !ev) return { ok: false, error: 'Registration not found' }
  return repo.updateRegistration(ev, reg, contact, rows)
}

export async function cancelOwnRegistration(token: string) {
  const reg = repo.getRegistrationByToken(token)
  const ev = reg && repo.getEvent(reg.community_id, reg.event_id)
  if (reg && ev) repo.cancelRegistration(ev, reg, 'public')
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
export async function adminLogout(slug: string) {
  ;(await cookies()).delete(cookieName(slug))
  redirect(`/c/${slug}`)
}

// ---------- admin: events ----------
export async function saveEventAction(slug: string, eventId: number | null, form: FormData) {
  const c = await adminCtx(slug)
  const cols = Object.fromEntries((Object.keys(DEFAULT_COLUMNS) as OptionalColumn[]).map((k) => [k, { show: form.get(`show_${k}`) === 'on', required: form.get(`req_${k}`) === 'on' }]))
  const sports = String(form.get('sports') ?? '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
  const title = String(form.get('title') ?? '').trim()
  if (!title || !sports.length) throw new Error('Title and at least one sport are required')
  const id = repo.saveEvent(c.id, eventId, {
    title, description: String(form.get('description') ?? ''), venue: String(form.get('venue') ?? ''), map_url: String(form.get('map_url') ?? ''),
    starts_at: istInputToIso(String(form.get('starts_at') ?? '')), ends_at: istInputToIso(String(form.get('ends_at') ?? '')),
    cutoff_at: istInputToIso(String(form.get('cutoff_at') ?? '')), sports: JSON.stringify(sports), config: JSON.stringify({ columns: cols }),
    status: (['draft', 'published', 'closed'].includes(String(form.get('status'))) ? String(form.get('status')) : 'draft') as 'draft',
  })
  repo.audit(c.id, 'admin', eventId ? 'event.updated' : 'event.created', String(id), { title })
  redirect(`/c/${slug}/admin/events/${id}`)
}

// ---------- admin: workspace ----------
export async function editParticipantAction(slug: string, id: number, field: repo.EditableField, value: string) {
  const c = await adminCtx(slug)
  if (!repo.EDITABLE.includes(field)) return { ok: false as const, error: 'Field not editable' }
  const r = repo.adminEditParticipant(c.id, id, field, value, 'admin')
  revalidatePath(`/c/${slug}/admin`)
  return r
}
export async function bulkActionForm(slug: string, eventId: number, form: FormData) {
  const c = await adminCtx(slug)
  const action = String(form.get('action')) as repo.BulkAction
  if (!['verify', 'unverify', 'confirm', 'cancel', 'member', 'guest'].includes(action)) return
  const ids = form.getAll('ids').map(Number).filter(Number.isInteger)
  repo.bulkAction(c.id, ids, action, 'admin')
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
  revalidatePath(`/c/${slug}`)
  return { ok: true }
}
