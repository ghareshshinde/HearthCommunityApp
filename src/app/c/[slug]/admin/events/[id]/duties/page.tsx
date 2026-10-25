import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/lib/repo'
import { requireCommunity } from '@/lib/session'
import { clashes, listDuties } from '@/lib/duties'
import { addDutyAction, removeDutyAction } from '@/app/duty-actions'

export default async function Duties({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { slug, id } = await params
  const q = await searchParams
  const c = await requireCommunity(slug, true)
  const ev = getEvent(c.id, Number(id))
  if (!ev) notFound()
  const duties = listDuties(c.id, ev.id)
  const clash = clashes(duties)
  const areas = [...new Set(duties.map((d) => d.area))]
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back to dashboard</Link></p>
      <h1>Volunteer duties: {ev.title}</h1>
      <p className="muted">Who is where and when. Every staff login can see this list at <Link href={`/c/${slug}/staff/duties`}>/staff/duties</Link>, so a volunteer who is stuck can find the next person.</p>
      {q.msg && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}>{q.msg}</p>}
      {q.err && <p className="card" role="alert" style={{ borderColor: 'var(--color-error)' }}>{q.err}</p>}
      <form action={addDutyAction.bind(null, slug, ev.id)} className="card fields" style={{ alignItems: 'end' }}>
        <label>Volunteer<input name="volunteer" required maxLength={80} /></label>
        <label>Mobile (optional)<input name="mobile" inputMode="tel" /></label>
        <label>Where<input name="area" required maxLength={60} placeholder="Gate 1, Court 2, Food counter" list="areas" /></label>
        <datalist id="areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
        <label>From<input name="starts" type="time" /></label>
        <label>To<input name="ends" type="time" /></label>
        <label>Note<input name="notes" maxLength={200} /></label>
        <p><button className="btn">Add duty</button></p>
      </form>
      <table className="data">
        <thead><tr><th>Where</th><th>Volunteer</th><th>Mobile</th><th>Time</th><th>Note</th><th /></tr></thead>
        <tbody>
          {duties.map((d) => (
            <tr key={d.id}>
              <td>{d.area}</td><td>{d.volunteer}{clash.has(d.id) && <small className="wl"> overlaps another duty</small>}</td><td>{d.mobile}</td><td>{d.starts && d.ends ? `${d.starts} to ${d.ends}` : d.starts || d.ends || 'All day'}</td><td>{d.notes}</td>
              <td><form action={removeDutyAction.bind(null, slug, ev.id, d.id)}><button>Remove</button></form></td>
            </tr>
          ))}
          {duties.length === 0 && <tr><td colSpan={6} className="muted">No duties yet.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
