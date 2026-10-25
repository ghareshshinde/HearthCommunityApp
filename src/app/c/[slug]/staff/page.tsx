import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentEvent } from '@/lib/repo'
import { requireActor } from '@/lib/session'
import { staffLogout } from '@/app/staff-actions'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'

export default async function StaffHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { c, actor } = await requireActor(slug)
  const ev = currentEvent(c.id)
  const sports: string[] = ev ? JSON.parse(ev.sports) : []
  const s = actor.staff
  if (s?.role === 'sport' && s.sport) redirect(`/c/${slug}/staff/sport/${encodeURIComponent(s.sport)}`)
  const showGate = actor.kind === 'admin' || s?.role === 'gate'
  const showSports = actor.kind === 'admin' || s?.role === 'sports_all'
  return (
    <main>
      <h1>{ev?.title ?? 'Staff'}</h1>
      <p className="muted">Signed in as {actor.label}{s ? ` (${s.role === 'gate' ? 'gate volunteer' : 'common sports admin'})` : ''}</p>
      {(actor.kind === 'admin' || s?.role === 'sports_all') && <p><Link className="btn outline" href={`/c/${slug}/staff/announce`}>Announcements</Link></p>}
      {showGate && <p><Link className="btn" href={`/c/${slug}/staff/gate`}>Open check-in</Link></p>}
      {showSports && (
        <>
          <h2>Sports</h2>
          <div className="tiles">
            {sports.map((sp) => (
              <Link key={sp} href={`/c/${slug}/staff/sport/${encodeURIComponent(sp)}`} className="tile"><Pic src={sportIcon(sp)} size={72} /><strong>{sp}</strong></Link>
            ))}
          </div>
        </>
      )}
      {s && <form action={staffLogout.bind(null, slug)} style={{ marginTop: '2rem' }}><button>Sign out</button></form>}
    </main>
  )
}
