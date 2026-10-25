import Link from 'next/link'
import { currentEvent } from '@/lib/repo'
import { requireActor } from '@/lib/session'
import { listDuties } from '@/lib/duties'

/** Read-only roster for everyone signed in as staff. */
export default async function StaffDuties({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { c, actor } = await requireActor(slug)
  const ev = currentEvent(c.id)
  const duties = ev ? listDuties(c.id, ev.id) : []
  return (
    <main>
      <p><Link href={actor.kind === 'admin' ? `/c/${slug}/admin` : `/c/${slug}/staff`}>Back</Link></p>
      <h1>Who is where</h1>
      <table className="data">
        <thead><tr><th>Where</th><th>Volunteer</th><th>Mobile</th><th>Time</th></tr></thead>
        <tbody>
          {duties.map((d) => <tr key={d.id}><td>{d.area}</td><td>{d.volunteer}{d.notes && <small className="muted"> · {d.notes}</small>}</td><td>{d.mobile ? <a href={`tel:${d.mobile}`}>{d.mobile}</a> : ''}</td><td>{d.starts && d.ends ? `${d.starts} to ${d.ends}` : 'All day'}</td></tr>)}
          {duties.length === 0 && <tr><td colSpan={4} className="muted">No duties have been set yet.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
