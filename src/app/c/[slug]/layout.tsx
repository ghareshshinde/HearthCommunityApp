import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { brandingToCss } from '@/lib/branding/css'
import { getCommunity, getSessionUser } from '@/lib/community'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCommunity((await params).slug)
  return c ? { title: c.brand.name === 'Hearth' ? c.name : c.brand.name, description: c.brand.tagline } : {}
}

export default async function CommunityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await getCommunity(slug)
  if (!c) notFound()
  const t = await getTranslations('common')
  const user = await getSessionUser()
  const name = c.brand.name === 'Hearth' ? c.name : c.brand.name
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandingToCss(c.brand) }} />
      <header className="site">
        <Link href={`/c/${slug}`}><strong>{name}</strong></Link>
        {user ? <span className="muted">{user.email}</span>
          : <Link className="btn" href={`/login?next=/c/${slug}`}>{t('signIn')}</Link>}
      </header>
      {children}
    </>
  )
}
