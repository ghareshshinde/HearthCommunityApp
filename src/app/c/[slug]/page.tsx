import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { requireCommunity } from '@/lib/session'
import { isOpen, listEvents } from '@/lib/repo'
import { formatIst } from '@/lib/time'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug)
  const t = await getTranslations('community')
  const events = listEvents(c.id, true)
  const name = c.brand.name === 'Hearth' ? c.name : c.brand.name
  return (
    <>
      <section className="hero">
        <Pic className="bg" src="/img/hero.svg" width={1200} height={460} />
        <div className="inner">
          {c.brand.logo && <Pic src={c.brand.logo} size={96} alt="" style={{ borderRadius: '50%', boxShadow: '0 0 0 5px var(--color-accent)', margin: 6 }} />}
          <div>
            <h1>{name}</h1>
            <p style={{ fontSize: '1.2rem', margin: 0 }}>{c.brand.tagline}</p>
          </div>
        </div>
      </section>
      <main>
        <p>{c.about}</p>
        <h2>{t('events')}</h2>
        {events.length === 0 && <p className="muted">{t('noEvents')}</p>}
        <div className="grid">
          {events.map((e) => (
            <div key={e.id} className="card">
              <div className="avatars" style={{ marginBottom: '.5rem' }}>
                {(JSON.parse(e.sports) as string[]).slice(0, 6).map((s) => <Pic key={s} src={sportIcon(s)} size={36} style={{ marginLeft: 0 }} />)}
              </div>
              <h3 style={{ margin: '.25rem 0' }}>{e.title}</h3>
              <p className="muted">{formatIst(e.starts_at)} · {e.venue}</p>
              <Link className="btn" href={`/c/${slug}/e/${e.id}`}>{isOpen(e) ? t('register') : t('closed')}</Link>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
