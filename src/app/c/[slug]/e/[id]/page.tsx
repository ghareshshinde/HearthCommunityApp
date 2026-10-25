import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getCommunityBySlug, getEvent, isOpen, seatsLeft } from '@/lib/repo'
import { formatIst } from '@/lib/time'
import { googleCalendarUrl } from '@/lib/calendar'
import { sportIcon } from '@/lib/sports'
import { eventSettings } from '@/lib/registration/rules'
import ShareButton from '@/components/ShareButton'
import Pic from '@/components/Pic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = getCommunityBySlug(slug)
  const ev = c && getEvent(c.id, Number(id))
  if (!c || !ev || ev.status === 'draft') return {}
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return {
    metadataBase: new URL(base),
    title: ev.title,
    description: `${ev.venue ? `${ev.venue}. ` : ''}Register your family for ${ev.title}.`,
    openGraph: { title: ev.title, description: `Register your family for ${ev.title}.`, images: c.brand.logo ? [c.brand.logo] : [] },
  }
}

export default async function EventPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug)
  const ev = getEvent(c.id, Number(id))
  if (!ev || ev.status === 'draft') notFound()
  const sports = JSON.parse(ev.sports) as string[]
  const left = seatsLeft(ev)
  const settings = eventSettings(ev.config)
  const open = isOpen(ev)
  return (
    <>
      <section className="hero">
        <Pic className="bg" src="/img/hero.svg" width={1200} height={460} />
        <div className="inner">
          <div style={{ flex: '3 1 22rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <span className="badge" style={{ alignSelf: 'flex-start' }}>{open ? 'Registration open' : 'Registration closed'}</span>
            <h1>{ev.title}</h1>
            {c.brand.tagline && <p style={{ margin: 0, fontSize: '1.2rem' }}>{c.brand.tagline}</p>}
            <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
              {open && <Link className="btn gold" href={`/c/${slug}/e/${id}/register`}>Register your family</Link>}
              <a className="btn ghost" href={`/c/${slug}/e/${id}/calendar.ics`}>Add to calendar</a>
              <ShareButton title={ev.title} className="btn ghost" />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {sports.map((s) => <Pic key={s} src={sportIcon(s)} size={52} alt={s} />)}
            </div>
          </div>
          <div style={{ flex: '1 1 10rem', display: 'flex', justifyContent: 'center' }}><Pic src="/img/trophy.svg" width={150} height={192} /></div>
        </div>
      </section>
      <main>
        <div className="facts">
          <div className="fact"><small>When</small><strong>{formatIst(ev.starts_at)}</strong></div>
          <div className="fact"><small>Where</small><strong>{ev.venue}</strong> {ev.map_url && <a href={ev.map_url} target="_blank" rel="noreferrer">Map</a>}</div>
          {ev.cutoff_at && <div className="fact"><small>Register and edit until</small><strong>{formatIst(ev.cutoff_at)}</strong></div>}
        </div>
        {ev.description && <p style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</p>}

        <h2>Pick your games</h2>
        <div className="tiles">
          {sports.map((s) => {
            const age = settings.ages[s]
            return (
              <div key={s} className="tile">
                <Pic src={sportIcon(s)} size={96} />
                <strong>{s}</strong>
                {age && <small className="muted">Ages {age.min ?? 1} to {age.max ?? 99}</small>}
                {left[s] === 0 && <small className="wl">Full: waitlist</small>}
              </div>
            )
          })}
        </div>

        <p className="muted">Already registered? <Link href={`/c/${slug}/my`}>Find my registration and QR ticket</Link></p>

        <h2>Three steps</h2>
        <div className="steps">
          <div className="step"><div className="pic avatars">{['avatar-1', 'avatar-2', 'avatar-3'].map((a) => <Pic key={a} src={`/img/${a}.svg`} size={84} />)}</div><div className="txt"><strong>1. Add your family</strong><p className="muted" style={{ margin: '.25rem 0 0' }}>One row per person, then pick their games.</p></div></div>
          <div className="step"><div className="pic"><Pic src="/img/camera.svg" size={110} /></div><div className="txt"><strong>2. Mark Member or Guest</strong><p className="muted" style={{ margin: '.25rem 0 0' }}>Organisers verify your choice.</p></div></div>
          <div className="step"><div className="pic" style={{ padding: 0 }}><Pic src="/img/celebrate.svg" width={360} height={200} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div><div className="txt"><strong>3. Save your link</strong><p className="muted" style={{ margin: '.25rem 0 0' }}>Edit or cancel any time before the cut-off.</p></div></div>
        </div>
      </main>
    </>
  )
}
