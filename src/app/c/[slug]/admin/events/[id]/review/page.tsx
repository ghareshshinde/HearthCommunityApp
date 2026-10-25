import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, pendingRegistrations } from '@/lib/repo'
import { decideRegistrationAction } from '@/app/actions'
import { formatIst } from '@/lib/time'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'

export default async function Review({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug, true)
  const ev = getEvent(c.id, Number(id))
  if (!ev) notFound()
  const queue = pendingRegistrations(c.id, ev.id)
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back</Link> · <Link href={`/c/${slug}/admin/events/${ev.id}/registrations`}>All registrations</Link></p>
      <h1>Approve registrations: {ev.title}</h1>
      <p className="muted">{queue.length} waiting. Approving turns the QR ticket on (if this event needs approval) and tells the registrant by email when they gave one. Rejecting turns the QR off, frees the seats and shows your reason on their page.</p>
      {queue.length === 0 && <p className="card" role="status">Nothing waiting for a decision.</p>}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {queue.map(({ reg, people }) => (
          <section key={reg.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>{reg.registrant_name} <span className="tag">{reg.ref}</span> {reg.source === 'spot' && <span className="tag">walk-in</span>}</h2>
                <p className="muted" style={{ margin: '.25rem 0' }}>{reg.registrant_mobile}{reg.registrant_email ? ` · ${reg.registrant_email}` : ''} · emergency {reg.emergency_name} {reg.emergency_mobile} · registered {formatIst(reg.created_at)}</p>
              </div>
              <div>{people.filter((p) => p.kind === 'member').length} members · {people.filter((p) => p.kind === 'guest').length} guests</div>
            </div>
            <table className="data">
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{p.age}</td><td>{p.gender}</td><td><span className={`tag ${p.kind === 'guest' ? 'on' : ''}`}>{p.kind}</span></td>
                    <td><span className="person">{(JSON.parse(p.sports) as string[]).map((s) => <Pic key={s} src={sportIcon(s)} size={22} alt={s} />)} {(JSON.parse(p.sports) as string[]).join(', ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.75rem', alignItems: 'center' }}>
              <input name="note" placeholder="Note or reason (shown to the registrant if you reject)" aria-label={`Note for ${reg.ref}`} style={{ flexGrow: 1, minWidth: '14rem' }} />
              <button className="btn" formAction={decideRegistrationAction.bind(null, slug, ev.id, reg.id, 'approve')}>Approve</button>
              <button className="btn outline" formAction={decideRegistrationAction.bind(null, slug, ev.id, reg.id, 'reject')}>Reject</button>
            </form>
          </section>
        ))}
      </div>
    </main>
  )
}
