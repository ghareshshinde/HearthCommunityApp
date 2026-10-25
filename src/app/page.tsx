import Link from 'next/link'
import { listCommunities, listEvents, isOpen, type EventRow } from '@/lib/repo'
import { resolveBranding } from '@/lib/branding/resolve'
import { eventSettings } from '@/lib/registration/rules'
import { sportIcon } from '@/lib/sports'
import { formatIst } from '@/lib/time'
import Pic from '@/components/Pic'

export const dynamic = 'force-dynamic'

const HERO_SPORTS = ['Chess', 'Badminton', 'Cricket', 'Carrom', 'Table Tennis', 'Pickleball']
const day = (iso: string | null) => (iso ? formatIst(iso, { day: 'numeric', month: 'short' }) : '')
const when = (iso: string | null) => (iso ? formatIst(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Date to be announced')

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const needle = q?.toLowerCase().trim()
  const all = listCommunities().map((c) => {
    const brand = resolveBranding(JSON.parse(c.branding))
    const events = listEvents(c.id, true)
    return { c, brand, events, open: events.filter((e) => isOpen(e)) as EventRow[] }
  })
  const communities = all.filter(({ c }) => !needle || `${c.name} ${c.city ?? ''} ${c.about ?? ''}`.toLowerCase().includes(needle))
  const live = all.flatMap(({ c, brand, open }) => open.map((e) => ({ c, brand, e }))).slice(0, 6)
  const totalEvents = all.reduce((n, x) => n + x.events.length, 0)

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-brand"><Pic src="/img/trophy.svg" size={34} /><strong>Hearth</strong></Link>
        <nav aria-label="Main">
          <a href="#open-now">Open now</a>
          <a href="#communities">Communities</a>
          <a href="#how">How it works</a>
        </nav>
      </header>

      <section className="lp-hero">
        <Pic className="lp-hero-bg" src="/img/hero.svg" width={1200} height={460} />
        <div className="lp-hero-inner">
          <p className="lp-eyebrow">For families, clubs and social groups</p>
          <h1>Register the whole family in one go. Walk in with a QR code.</h1>
          <p className="lp-lead">Hearth runs your community&apos;s events end to end: one form for every family member, tickets on the phone, quick check-in at the gate, live scores and brackets, and feedback afterwards.</p>
          <form action="/" method="get" className="lp-search" role="search">
            <input name="q" defaultValue={q} placeholder="Find your community" aria-label="Find your community" />
            <button className="lp-btn">Search</button>
          </form>
          <div className="lp-icons" aria-hidden="true">{HERO_SPORTS.map((s) => <span key={s}><Pic src={sportIcon(s)} size={56} /></span>)}</div>
        </div>
      </section>

      <section className="lp-stats" aria-label="At a glance">
        <div><strong>{all.length}</strong><span>{all.length === 1 ? 'community' : 'communities'}</span></div>
        <div><strong>{live.length}</strong><span>{live.length === 1 ? 'event' : 'events'} open for registration</span></div>
        <div><strong>{totalEvents}</strong><span>{totalEvents === 1 ? 'event' : 'events'} run on Hearth</span></div>
      </section>

      <main className="lp-main">
        {live.length > 0 && !needle && (
          <section id="open-now" aria-labelledby="open-h">
            <h2 id="open-h">Open for registration now</h2>
            <div className="lp-live">
              {live.map(({ c, brand, e }) => {
                const sports = JSON.parse(e.sports) as string[]
                return (
                  <article key={e.id} className="lp-event" style={{ ['--b' as string]: brand.colors.primary, ['--a' as string]: brand.colors.accent }}>
                    <div className="lp-event-date"><strong>{day(e.starts_at) || 'Soon'}</strong><span>{e.starts_at ? formatIst(e.starts_at, { year: 'numeric' }) : ''}</span></div>
                    <div className="lp-event-body">
                      <small>{brand.name === 'Hearth' ? c.name : brand.name}</small>
                      <h3>{e.title}</h3>
                      <p>{when(e.starts_at)}{e.venue ? ` · ${e.venue}` : ''}</p>
                      <div className="lp-sports">{sports.slice(0, 6).map((s) => <Pic key={s} src={sportIcon(s)} size={30} alt={s} />)}</div>
                    </div>
                    <div className="lp-event-cta">
                      <Link className="lp-btn" href={`/c/${c.slug}/e/${e.id}/register`}>Register</Link>
                      <Link className="lp-link" href={`/c/${c.slug}/e/${e.id}`}>Details</Link>
                      {eventSettings(e.config).spot.open && <small>Walk-ins welcome</small>}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <section id="communities" aria-labelledby="com-h">
          <h2 id="com-h">{needle ? `Communities matching “${q}”` : 'Communities on Hearth'}</h2>
          {communities.length === 0 ? (
            <div className="lp-empty"><Pic src="/img/celebrate.svg" size={120} /><p>No community matches that search.</p><Link className="lp-link" href="/">Show all communities</Link></div>
          ) : (
            <div className="lp-cards">
              {communities.map(({ c, brand, events, open }) => (
                <article key={c.slug} className="lp-card" style={{ ['--b' as string]: brand.colors.primary, ['--a' as string]: brand.colors.accent, ['--b2' as string]: brand.colors.secondary }}>
                  <div className="lp-card-top">
                    {brand.logo ? <Pic className="lp-logo" src={brand.logo} size={72} /> : <span className="lp-logo lp-initial">{c.name[0]}</span>}
                    <div><h3>{brand.name === 'Hearth' ? c.name : brand.name}</h3><p>{c.city}{brand.tagline ? ` · ${brand.tagline}` : ''}</p></div>
                  </div>
                  <div className="lp-card-body">
                    <p>{c.about}</p>
                    <p className={open.length ? 'lp-pill on' : 'lp-pill'}>{open.length ? `${open.length} open for registration` : events.length ? 'No registration open right now' : 'No events yet'}</p>
                  </div>
                  <div className="lp-card-cta">
                    <Link className="lp-btn" href={`/c/${c.slug}`}>Open community</Link>
                    {open[0] && <Link className="lp-link" href={`/c/${c.slug}/e/${open[0].id}/register`}>Register now</Link>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="how" aria-labelledby="how-h">
          <h2 id="how-h">How it works</h2>
          <div className="lp-steps">
            <div><Pic src="/img/avatar-1.svg" size={84} /><h3>1. Add your family</h3><p>One table, one row per person. Paste from Excel or add people one by one, and pick their games.</p></div>
            <div><Pic src="/img/camera.svg" size={84} /><h3>2. Get your QR ticket</h3><p>Save the link, or search with your reference and mobile number. Tickets work offline at the gate.</p></div>
            <div><Pic src="/img/trophy.svg" size={84} /><h3>3. Play, follow, give feedback</h3><p>See your matches, live brackets and winners on your phone, then tell the organisers how it went.</p></div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span>Hearth · where communities gather</span>
        <span>Lost your ticket? Open your community and choose “Find my registration”.</span>
      </footer>
    </div>
  )
}
