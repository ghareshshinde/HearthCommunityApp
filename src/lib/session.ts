import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { checkSession } from './auth'
import { getCommunityBySlug } from './repo'
import { getStaff, readStaffSession, type StaffRow } from './staff'

export const cookieName = (slug: string) => `hearth_admin_${slug}`

/** Resolves the community for a page and, when `admin`, requires that community's admin session. */
export async function requireCommunity(slug: string, admin = false) {
  const c = getCommunityBySlug(slug)
  if (!c) notFound()
  if (admin && !checkSession((await cookies()).get(cookieName(slug))?.value, slug)) redirect(`/c/${slug}/admin/login`)
  return c
}
export const isAdminSession = async (slug: string) => checkSession((await cookies()).get(cookieName(slug))?.value, slug)

export const staffCookieName = (slug: string) => `hearth_staff_${slug}`
export const gateCookieName = (slug: string) => `hearth_gate_${slug}`

export type Actor = { kind: 'admin'; label: string; staff?: undefined } | { kind: 'staff'; label: string; staff: StaffRow }

/** Who is signed in for this community: the admin, or an active staff member. Staff are re-checked against the database on every request, so revoking them takes effect at once. */
export async function getActor(slug: string): Promise<Actor | null> {
  const c = getCommunityBySlug(slug)
  if (!c) return null
  const jar = await cookies()
  if (checkSession(jar.get(cookieName(slug))?.value, slug)) return { kind: 'admin', label: 'Admin' }
  const id = readStaffSession(jar.get(staffCookieName(slug))?.value, slug)
  const s = id ? getStaff(c.id, id) : undefined
  return s && s.active ? { kind: 'staff', label: s.name, staff: s } : null
}

export const canCheckIn = (a: Actor | null) => !!a && (a.kind === 'admin' || a.staff.role === 'gate')
export const canSeeSport = (a: Actor | null, sport: string) =>
  !!a && (a.kind === 'admin' || a.staff.role === 'sports_all' || (a.staff.role === 'sport' && a.staff.sport === sport))

export async function requireActor(slug: string, allow: (a: Actor | null) => boolean = (a) => !!a) {
  const c = getCommunityBySlug(slug)
  if (!c) notFound()
  const actor = await getActor(slug)
  if (!allow(actor)) redirect(actor ? `/c/${slug}/staff` : `/c/${slug}/staff/login`)
  return { c, actor: actor! }
}
