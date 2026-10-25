import Link from 'next/link'
import { brandingToCss } from '@/lib/branding/css'
import { requireCommunity } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = await requireCommunity((await params).slug)
  return { title: c.brand.name === 'Hearth' ? c.name : c.brand.name, description: c.brand.tagline }
}

export default async function CommunityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug)
  const name = c.brand.name === 'Hearth' ? c.name : c.brand.name
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandingToCss(c.brand) }} />
      <header className="site"><Link href={`/c/${slug}`}><strong>{name}</strong></Link></header>
      {children}
    </>
  )
}
