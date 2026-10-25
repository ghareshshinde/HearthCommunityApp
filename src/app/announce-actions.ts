'use server'
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/session'
import { getCommunityBySlug } from '@/lib/repo'
import { postAnnouncement, removeAnnouncement } from '@/lib/announcements'
import { persist } from '@/lib/persist'

/** Admins, common sports admins and sport admins may announce; gate staff may not. */
async function who(slug: string) {
  const c = getCommunityBySlug(slug)
  const a = await getActor(slug)
  if (!c || !a || (a.kind === 'staff' && a.staff.role === 'gate')) throw new Error('Not authorised')
  return { c, a }
}
const back = (slug: string, q: string) => redirect(`/c/${slug}/staff/announce?${q}`)

export async function postAnnouncementAction(slug: string, form: FormData) {
  const { c, a } = await who(slug)
  const r = postAnnouncement(c.id, a.label, String(form.get('message') ?? ''), String(form.get('level') ?? 'info'), Number(form.get('minutes')))
  if (r.ok) await persist()
  back(slug, r.ok ? 'msg=Announcement+is+live+on+every+page' : `err=${encodeURIComponent(r.error)}`)
}
export async function removeAnnouncementAction(slug: string, id: number) {
  const { c, a } = await who(slug)
  removeAnnouncement(c.id, id, a.label)
  await persist()
  back(slug, 'msg=Announcement+removed')
}
