import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import { getEvent, getRegistrationByToken } from '@/lib/repo'
import { feedbackOpen, getFeedback, RETURN_CHOICES } from '@/lib/feedback'
import { submitFeedbackAction } from '@/app/feedback-actions'
import Pic from '@/components/Pic'

const QUESTIONS = [
  ['overall', 'How was the event overall?'], ['organisation', 'How well was it organised (check-in, schedule, volunteers)?'], ['sports_rating', 'How were the games and matches?'],
] as const

export default async function Feedback({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ thanks?: string; err?: string }> }) {
  const { slug, token } = await params
  const q = await searchParams
  const c = await requireCommunity(slug)
  const reg = getRegistrationByToken(token)
  if (!reg || reg.community_id !== c.id) notFound()
  const ev = getEvent(c.id, reg.event_id)!
  const mine = getFeedback(c.id, reg.id)
  const open = feedbackOpen(ev) && reg.status !== 'cancelled'
  const sports = JSON.parse(ev.sports) as string[]
  return (
    <main>
      <p><Link href={`/c/${slug}/r/${token}`}>Back to my registration</Link></p>
      <h1>Feedback: {ev.title}</h1>
      {q.thanks && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}><Pic src="/img/celebrate.svg" size={40} /> <strong>Thank you!</strong> Your feedback is saved. You can change it below until the organisers close feedback.</p>}
      {q.err && <p className="card" role="alert" style={{ borderColor: 'var(--color-error)' }}>{q.err}</p>}
      {!open ? (
        <p className="card">{reg.status === 'cancelled' ? 'This registration was cancelled.' : 'Feedback opens when the event starts. Please come back then.'}</p>
      ) : (
        <form action={submitFeedbackAction.bind(null, slug, token)} className="card" style={{ display: 'grid', gap: '1rem', maxWidth: '40rem' }}>
          <p className="muted" style={{ margin: 0 }}>One answer for your whole family. Your name is not shown to other participants.</p>
          {QUESTIONS.map(([k, label]) => (
            <fieldset key={k} className="stars"><legend>{label}</legend>
              <div className="starrow">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="star"><input type="radio" name={k} value={n} defaultChecked={mine?.[k] === n} required />{n}<small>{['Poor', 'Fair', 'Good', 'Very good', 'Excellent'][n - 1]}</small></label>
                ))}
              </div>
            </fieldset>
          ))}
          <label>Your favourite game<select name="favourite" defaultValue={mine?.favourite ?? ''}><option value="">No favourite</option>{sports.map((s) => <option key={s}>{s}</option>)}</select></label>
          <fieldset><legend>Would you come again?</legend>
            {RETURN_CHOICES.map((r) => <label key={r} style={{ flexDirection: 'row', gap: '.5rem' }}><input type="radio" name="would_return" value={r} defaultChecked={mine?.would_return === r} />{r === 'yes' ? 'Yes, definitely' : r === 'maybe' ? 'Maybe' : 'No'}</label>)}
          </fieldset>
          <label>What went well?<textarea name="went_well" rows={3} maxLength={600} defaultValue={mine?.went_well ?? ''} /></label>
          <label>What should we improve?<textarea name="improve" rows={3} maxLength={600} defaultValue={mine?.improve ?? ''} /></label>
          <p><button className="btn">{mine ? 'Update my feedback' : 'Send feedback'}</button></p>
        </form>
      )}
    </main>
  )
}
