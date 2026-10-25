import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { checkSession } from './auth'
import { getCommunityBySlug } from './repo'

export const cookieName = (slug: string) => `hearth_admin_${slug}`

/** Resolves the community for a page and, when `admin`, requires that community's admin session. */
export async function requireCommunity(slug: string, admin = false) {
  const c = getCommunityBySlug(slug)
  if (!c) notFound()
  if (admin && !checkSession((await cookies()).get(cookieName(slug))?.value, slug)) redirect(`/c/${slug}/admin/login`)
  return c
}
export const isAdminSession = async (slug: string) => checkSession((await cookies()).get(cookieName(slug))?.value, slug)
