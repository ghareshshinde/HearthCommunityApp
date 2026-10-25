import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/lib/repo'
import { requireCommunity } from '@/lib/session'
import { feedbackMode, feedbackOpen, feedbackSummary, listFeedback } from '@/lib/feedback'
import { feedbackModeAction, requestFeedbackAction } from '@/app/feedback-actions'
import { formatIst } from '@/lib/time'

export default async function FeedbackReport({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { slug, id } = await params
  const q = await searchParams
  const c = await requireCommunity(slug, true)
  const ev = getEvent(c.id, Number(id))
  if (!ev) notFound()
  const s = feedbackSummary(c.id, ev.id)
  const list = listFeedback(c.id, ev.id)
  const mode = feedbackMode(ev)
  const max = Math.max(1, ...s.spread)
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back to dashboard</Link></p>
      <h1>Feedback: {ev.title}</h1>
      {q.msg && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}>{q.msg}</p>}
      <div className="card">
        <p><strong>Feedback is {feedbackOpen(ev) ? 'open' : 'closed'}</strong> <span className="muted">(setting: {mode === 'auto' ? 'opens when the event starts' : mode})</span></p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <form action={feedbackModeAction.bind(null, slug, ev.id, 'open')}><button className="btn">Open now</button></form>
          <form action={feedbackModeAction.bind(null, slug, ev.id, 'closed')}><button className="btn outline">Close</button></form>
          <form action={feedbackModeAction.bind(null, slug, ev.id, 'auto')}><button className="btn outline">Open automatically at start</button></form>
          <form action={requestFeedbackAction.bind(null, slug, ev.id)}><button className="btn gold">Email everyone who has not answered</button></form>
          <a className="btn outline" href={`/c/${slug}/admin/events/${ev.id}/feedback/export`}>Download Excel</a>
        </div>
        <p className="muted">Each registration has a feedback link on its own page. The email goes to registrants with an address; it needs email set up (see the audit and outbox page).</p>
      </div>
      <h2>Summary</h2>
      <table className="data">
        <tbody>
          <tr><th>Responses</th><td>{s.responses} of {s.registrations} registrations</td></tr>
          <tr><th>Overall</th><td>{s.responses ? `${s.overall} / 5` : '-'}</td></tr>
          <tr><th>Organisation</th><td>{s.responses ? `${s.organisation} / 5` : '-'}</td></tr>
          <tr><th>Games and matches</th><td>{s.responses ? `${s.sports} / 5` : '-'}</td></tr>
          <tr><th>Would come again</th><td>{Object.entries(s.wouldReturn).map(([k, n]) => `${k}: ${n}`).join(' · ') || '-'}</td></tr>
          <tr><th>Favourite games</th><td>{Object.entries(s.favourites).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') || '-'}</td></tr>
        </tbody>
      </table>
      <h3>Overall rating spread</h3>
      {[5, 4, 3, 2, 1].map((n) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: '.2rem 0' }}>
          <span style={{ width: '1.5rem' }}>{n}</span><span style={{ display: 'inline-block', height: 14, width: `${(s.spread[n - 1] / max) * 60}%`, minWidth: s.spread[n - 1] ? 6 : 0, background: 'var(--color-primary, #1e4a9e)', borderRadius: 4 }} /><span>{s.spread[n - 1]}</span>
        </div>
      ))}
      <h2>Comments</h2>
      <table className="data">
        <thead><tr><th>When</th><th>Ref</th><th>Overall</th><th>Went well</th><th>Improve</th></tr></thead>
        <tbody>
          {list.filter((f) => f.went_well || f.improve).map((f) => <tr key={f.id}><td>{formatIst(f.updated_at)}</td><td>{f.ref}</td><td>{f.overall}</td><td>{f.went_well}</td><td>{f.improve}</td></tr>)}
          {list.every((f) => !f.went_well && !f.improve) && <tr><td colSpan={5} className="muted">No comments yet.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
