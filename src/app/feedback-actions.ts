'use server'
import { redirect } from 'next/navigation'
import { getCommunityBySlug, getEvent, getRegistrationByToken } from '@/lib/repo'
import { saveFeedback, setFeedbackMode, queueFeedbackRequests, type FeedbackMode } from '@/lib/feedback'
import { isAdminSession } from '@/lib/session'
import { persist } from '@/lib/persist'
import { allow } from '@/lib/ratelimit'
import { deliverEmails } from '@/lib/mail'

export async function submitFeedbackAction(slug: string, token: string, form: FormData) {
  const c = getCommunityBySlug(slug)
  const reg = getRegistrationByToken(token)
  if (!c || !reg || reg.community_id !== c.id) throw new Error('Not found')
  const ev = getEvent(c.id, reg.event_id)!
  const base = `/c/${slug}/r/${token}/feedback`
  if (!allow(`fb:${token}`, 20, 3600_000)) redirect(`${base}?err=${encodeURIComponent('Too many tries. Please wait a little.')}`)
  const r = saveFeedback(ev, reg, Object.fromEntries(form.entries()))
  if (!r.ok) redirect(`${base}?err=${encodeURIComponent(r.error)}`)
  await persist()
  redirect(`${base}?thanks=1`)
}

async function adminEvent(slug: string, eventId: number) {
  const c = getCommunityBySlug(slug)
  if (!c || !(await isAdminSession(slug))) throw new Error('Not authorised')
  const ev = getEvent(c.id, eventId)
  if (!ev) throw new Error('Not found')
  return { c, ev }
}
export async function feedbackModeAction(slug: string, eventId: number, mode: FeedbackMode) {
  const { ev } = await adminEvent(slug, eventId)
  if (!['auto', 'open', 'closed'].includes(mode)) throw new Error('Bad mode')
  setFeedbackMode(ev, mode, 'Admin')
  await persist()
  redirect(`/c/${slug}/admin/events/${eventId}/feedback?msg=${encodeURIComponent('Feedback is now ' + mode)}`)
}
export async function requestFeedbackAction(slug: string, eventId: number) {
  const { ev } = await adminEvent(slug, eventId)
  const n = queueFeedbackRequests(ev, slug, 'Admin')
  await persist()
  await deliverEmails()
  redirect(`/c/${slug}/admin/events/${eventId}/feedback?msg=${encodeURIComponent(n ? `${n} request emails queued` : 'Everyone with an email has answered, or no one has an email address')}`)
}
