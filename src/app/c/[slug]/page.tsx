import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { requireCommunity } from '@/lib/session'
import { listEvents } from '@/lib/repo'
import { formatIst } from '@/lib/time'
import { isOpen } from '@/lib/repo'

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug)
  const t = await getTranslations('community')
  const events = listEvents(c.id, true)
  return (
    <main>
      <h1>{c.brand.name === 'Hearth' ? c.name : c.brand.name}</h1>
      <p className="muted">{c.brand.tagline}</p>
      <p>{c.about}</p>
      <h2>{t('events')}</h2>
      {events.length === 0 && <p className="muted">{t('noEvents')}</p>}
      <div className="grid">
        {events.map((e) => (
          <div key={e.id} className="card">
            <h3>{e.title}</h3>
            <p className="muted">{formatIst(e.starts_at)} · {e.venue}</p>
            {isOpen(e) ? <Link className="btn" href={`/c/${slug}/e/${e.id}`}>{t('register')}</Link> : <p>{t('closed')}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
