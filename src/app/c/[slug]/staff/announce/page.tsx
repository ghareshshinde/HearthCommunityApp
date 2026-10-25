import Link from 'next/link'
import { requireActor } from '@/lib/session'
import { DURATIONS, MAX_LENGTH, liveAnnouncements, recentAnnouncements } from '@/lib/announcements'
import { postAnnouncementAction, removeAnnouncementAction } from '@/app/announce-actions'
import { formatIst } from '@/lib/time'

export default async function Announce({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { slug } = await params
  const q = await searchParams
  const { c, actor } = await requireActor(slug, (a) => !!a && (a.kind === 'admin' || a.staff.role !== 'gate'))
  const live = new Set(liveAnnouncements(c.id).map((a) => a.id))
  const recent = recentAnnouncements(c.id)
  return (
    <main>
      <p><Link href={actor.kind === 'admin' ? `/c/${slug}/admin` : `/c/${slug}/staff`}>Back</Link></p>
      <h1>Announcements</h1>
      <p className="muted">Shown at once in a scrolling bar at the bottom of every page, and as a phone notification for people who turned alerts on. Everyone can read it, so keep it short and never include phone numbers.</p>
      {q.msg && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}>{q.msg}</p>}
      {q.err && <p className="card" role="alert" style={{ borderColor: 'var(--color-error)' }}>{q.err}</p>}
      <form action={postAnnouncementAction.bind(null, slug)} className="card" style={{ display: 'grid', gap: '.75rem', maxWidth: '38rem' }}>
        <label>Message<textarea name="message" rows={2} maxLength={MAX_LENGTH} required placeholder="Badminton semi-finals moved to Court 2 at 11:30" /></label>
        <div className="fields">
          <label>Type<select name="level" defaultValue="info"><option value="info">Normal</option><option value="urgent">Urgent (flashes red)</option></select></label>
          <label>Keep it up for<select name="minutes" defaultValue="120">{Object.entries(DURATIONS).map(([m, d]) => <option key={m} value={m}>{d.label}</option>)}</select></label>
        </div>
        <p><button className="btn">Announce now</button></p>
      </form>
      <h2>Recent</h2>
      <table className="data">
        <thead><tr><th>Message</th><th>By</th><th>Posted</th><th>Status</th><th /></tr></thead>
        <tbody>
          {recent.map((a) => (
            <tr key={a.id}>
              <td>{a.level === 'urgent' && <strong className="wl">Urgent </strong>}{a.message}</td><td>{a.created_by}</td><td>{formatIst(a.created_at)}</td>
              <td>{a.removed_at ? 'removed' : live.has(a.id) ? 'live' : 'expired'}</td>
              <td>{live.has(a.id) && <form action={removeAnnouncementAction.bind(null, slug, a.id)}><button>Remove</button></form>}</td>
            </tr>
          ))}
          {recent.length === 0 && <tr><td colSpan={5} className="muted">Nothing announced yet.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
