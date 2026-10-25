import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ADMIN_ROLES, getCommunity, getMyRoles, getSessionUser, hasMfa } from '@/lib/community'

export default async function AdminHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await getCommunity(slug)
  if (!c) notFound()
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=/c/${slug}/admin`)
  const roles = await getMyRoles(c.id)
  if (!roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))) notFound()
  // Admin actions stay blocked until TOTP is set up and verified for this session (A2).
  if (!(await hasMfa())) redirect(`/mfa?next=/c/${slug}/admin`)
  const t = await getTranslations('admin')
  return <main><h1>{t('title')}</h1><p className="muted">{roles.join(', ')}</p></main>
}
