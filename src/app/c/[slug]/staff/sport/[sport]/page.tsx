import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentEvent, sportRoster } from '@/lib/repo'
import { canSeeSport, requireActor } from '@/lib/session'
import { formatIst } from '@/lib/time'
import { sportIcon } from '@/lib/sports'
import AutoRefresh from '@/components/AutoRefresh'
import Pic from '@/components/Pic'

const band = (age: number) => (age < 12 ? 'Under 12' : age < 18 ? '12 to 17' : age < 40 ? '18 to 39' : '40 and over')

export default async function SportRoster({ params, searchParams }: { params: Promise<{ slug: string; sport: string }>; searchParams: Promise<{ all?: string; gender?: string }> }) {
  const { slug, sport: raw } = await params
  const sport = decodeURIComponent(raw)
  const q = await searchParams
  const { c, actor } = await requireActor(slug, (a) => canSeeSport(a, sport))
  const ev = currentEvent(c.id)
  if (!ev || !(JSON.parse(ev.sports) as string[]).includes(sport)) notFound()
  const all = sportRoster(c.id, ev.id, sport).filter((r) => !r.withdrawn)
  const arrivedOnly = q.all !== '1'
  let rows = arrivedOnly ? all.filter((r) => r.checkedInAt) : all
  if (q.gender) rows = rows.filter((r) => r.gender === q.gender)
  const arrived = all.filter((r) => r.checkedInAt).length
  const base = `/c/${slug}/staff/sport/${encodeURIComponent(sport)}`
  return (
    <main>
      <AutoRefresh seconds={5} />
      <p><Link href={`/c/${slug}/staff`}>{actor.kind === 'admin' || actor.staff.role === 'sports_all' ? 'All sports' : 'Home'}</Link></p>
      <p><strong>Players</strong> · <Link href={`${base}/categories`}>Categories and results</Link></p>
      <div className="person"><Pic src={sportIcon(sport)} size={56} /><div><h1 style={{ margin: 0 }}>{sport}</h1><span className="muted">{arrived} arrived of {all.length} registered · updates every 5 seconds</span></div></div>
      <p>
        <Link className={`tag ${arrivedOnly ? 'on' : ''}`} href={base}>Arrived only</Link>{' '}
        <Link className={`tag ${!arrivedOnly ? 'on' : ''}`} href={`${base}?all=1`}>Everyone registered</Link>{' '}
        {['Male', 'Female'].map((g) => <Link key={g} className="tag" href={`${base}?${arrivedOnly ? '' : 'all=1&'}gender=${g}`}>{g}</Link>)}
      </p>
      <table className="data">
        <thead><tr><th>Player</th><th>Age</th><th>Gender</th><th>Skill</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={!r.checkedInAt ? { opacity: 0.55 } : undefined}>
              <td>{r.name}{r.waitlisted && <small className="wl"> waitlist</small>}</td><td>{r.age} <small className="muted">{band(r.age)}</small></td><td>{r.gender}</td><td>{r.skill}</td><td>{r.kind}</td>
              <td>{r.checkedInAt ? <span className="tag" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Arrived {formatIst(r.checkedInAt, { timeStyle: 'short' })}</span> : <span className="tag">Not yet arrived</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">Nobody to show yet.</td></tr>}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: '.85rem' }}>Contact details are not shown to sport admins.</p>
    </main>
  )
}
