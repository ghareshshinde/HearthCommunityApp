import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import { listEvents, listRows, stats } from '@/lib/repo'
import { adminLogout } from '@/app/actions'
import { formatIst } from '@/lib/time'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'

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
        <Link href={`/c/${slug}/admin/branding`}>Branding</Link> · <Link href={`/c/${slug}/admin/staff`}>Staff and check-in</Link> · <Link href={`/c/${slug}/admin/audit`}>Audit log and outbox</Link> · <Link href={`/c/${slug}/admin/password`}>Change password</Link> · <a href={`/c/${slug}/admin/backup`}>Download backup</a>{' '}
        <form action={adminLogout.bind(null, slug)} style={{ display: 'inline' }}><button>Sign out</button></form>
      </p>
      {events.map((e) => {
        const s = stats(listRows(c.id, e.id))
        return (
          <section key={e.id} className="card" style={{ marginBottom: '1rem' }}>
            <div className="hero" style={{ borderRadius: 'var(--radius)', margin: '-1rem -1rem 1rem' }}>
              <Pic className="bg" src="/img/hero.svg" width={1200} height={460} />
              <div className="inner" style={{ padding: '1.2rem 1.5rem', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <div><h2 style={{ margin: 0 }}>{e.title} <span className="tag" style={{ color: '#fff' }}>{e.status}</span></h2><div style={{ opacity: 0.85 }}>{formatIst(e.starts_at)} · {e.venue}</div></div>
                <Pic src="/img/trophy.svg" width={56} height={72} />
              </div>
            </div>
            <p><strong>{s.registrations}</strong> registrations ({s.pending} awaiting confirmation) · <strong>{s.participants}</strong> people · {s.members} members · {s.guests} guests · {s.verified} verified · {s.arrived} arrived{Object.keys(s.waitlisted).length > 0 && ` · waitlisted: ${Object.entries(s.waitlisted).map(([k, v]) => `${k} ${v}`).join(', ')}`}</p>
            <div className="grid">
              <Counts title="Sports" data={s.sports} icons /><Counts title="Diet" data={s.diets} /><Counts title="T-shirt" data={s.tshirts} /><Counts title="Gender" data={s.gender} />
            </div>
            <p>
              <Link className="btn" href={`/c/${slug}/admin/events/${e.id}/registrations`}>Registrations</Link>{' '}
              <Link className="btn gold" href={`/c/${slug}/admin/events/${e.id}/review`}>Approve ({s.pending})</Link>{' '}
              <Link href={`/c/${slug}/admin/events/${e.id}`}>Edit event</Link> · <Link href={`/c/${slug}/e/${e.id}`}>Public page</Link>
            </p>
          </section>
        )
      })}
    </main>
  )
}

function Counts({ title, data, icons }: { title: string; data: Record<string, number>; icons?: boolean }) {
  return (
    <div><strong>{title}</strong>
      <table className="data"><tbody>{Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td><span className="person">{icons && <Pic src={sportIcon(k)} size={28} />}{k}</span></td><td>{v}</td></tr>)}</tbody></table>
    </div>
  )
}
