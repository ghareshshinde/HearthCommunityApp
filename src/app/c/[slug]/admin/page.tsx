import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import { listEvents, listRows, stats } from '@/lib/repo'
import { adminLogout } from '@/app/actions'
import { formatIst } from '@/lib/time'

export default async function AdminHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug, true)
  const events = listEvents(c.id)
  return (
    <main>
      <meta httpEquiv="refresh" content="60" />
      <h1>Admin console</h1>
      <p>
        <Link className="btn" href={`/c/${slug}/admin/events/new`}>New event</Link>{' '}
        <Link href={`/c/${slug}/admin/branding`}>Branding</Link> · <Link href={`/c/${slug}/admin/audit`}>Audit log and outbox</Link>{' '}
        <form action={adminLogout.bind(null, slug)} style={{ display: 'inline' }}><button>Sign out</button></form>
      </p>
      {events.map((e) => {
        const s = stats(listRows(c.id, e.id))
        return (
          <section key={e.id} className="card" style={{ marginBottom: '1rem' }}>
            <h2>{e.title} <span className="tag">{e.status}</span></h2>
            <p className="muted">{formatIst(e.starts_at)} · {e.venue}</p>
            <p><strong>{s.registrations}</strong> registrations ({s.pending} awaiting confirmation) · <strong>{s.participants}</strong> people · {s.members} members · {s.guests} guests · {s.verified} verified</p>
            <div className="grid">
              <Counts title="Sports" data={s.sports} /><Counts title="Diet" data={s.diets} /><Counts title="T-shirt" data={s.tshirts} /><Counts title="Gender" data={s.gender} />
            </div>
            <p>
              <Link className="btn" href={`/c/${slug}/admin/events/${e.id}/registrations`}>Registrations</Link>{' '}
              <Link href={`/c/${slug}/admin/events/${e.id}`}>Edit event</Link> · <Link href={`/c/${slug}/e/${e.id}`}>Public page</Link>
            </p>
          </section>
        )
      })}
    </main>
  )
}

function Counts({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div><strong>{title}</strong>
      <table className="data"><tbody>{Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
    </div>
  )
}
