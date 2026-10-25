'use server'
import { redirect } from 'next/navigation'
import { isAdminSession } from '@/lib/session'
import { getCommunityBySlug } from '@/lib/repo'
import { addDuty, removeDuty } from '@/lib/duties'
import { persist } from '@/lib/persist'

async function admin(slug: string) {
  const c = getCommunityBySlug(slug)
  if (!c || !(await isAdminSession(slug))) throw new Error('Not authorised')
  return c
}
export async function addDutyAction(slug: string, eventId: number, form: FormData) {
  const c = await admin(slug)
  const f = (k: string) => String(form.get(k) ?? '')
  const r = addDuty(c.id, eventId, { volunteer: f('volunteer'), mobile: f('mobile'), area: f('area'), starts: f('starts'), ends: f('ends'), notes: f('notes') }, 'Admin')
  if (r.ok) await persist()
  redirect(`/c/${slug}/admin/events/${eventId}/duties?${r.ok ? 'msg=Added' : `err=${encodeURIComponent(r.error)}`}`)
}
export async function removeDutyAction(slug: string, eventId: number, id: number) {
  const c = await admin(slug)
  removeDuty(c.id, id, 'Admin')
  await persist()
  redirect(`/c/${slug}/admin/events/${eventId}/duties?msg=Removed`)
}
