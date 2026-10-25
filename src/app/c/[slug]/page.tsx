import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCommunity } from '@/lib/community'

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getCommunity((await params).slug)
  if (!c) notFound()
  const t = await getTranslations('community')
  return (
    <main>
      <h1>{c.brand.name === 'Hearth' ? c.name : c.brand.name}</h1>
      <p className="muted">{c.brand.tagline}</p>
      {c.status === 'pending' && <p className="card">{t('pending')}</p>}
      <p>{c.about}</p>
    </main>
  )
}
