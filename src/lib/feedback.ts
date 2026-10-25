import { getDb } from './db'
import { audit, publicUrl, queueEmail, type EventRow, type RegistrationRow } from './repo'

const db = () => getDb()
export type FeedbackMode = 'auto' | 'open' | 'closed'
export type FeedbackRow = {
  id: number; community_id: number; event_id: number; registration_id: number; overall: number; organisation: number; sports_rating: number
  favourite: string; would_return: string; went_well: string; improve: string; created_at: string; updated_at: string
}
export const RETURN_CHOICES = ['yes', 'maybe', 'no'] as const

export function feedbackMode(ev: EventRow): FeedbackMode {
  try { const m = JSON.parse(ev.config || '{}').feedback; return m === 'open' || m === 'closed' ? m : 'auto' } catch { return 'auto' }
}
/** Auto means: opens when the event starts. An admin can force it open or closed. */
export function feedbackOpen(ev: EventRow, now = new Date()): boolean {
  const m = feedbackMode(ev)
  if (m !== 'auto') return m === 'open'
  return !!ev.starts_at && new Date(ev.starts_at) <= now
}
export function setFeedbackMode(ev: EventRow, mode: FeedbackMode, by: string) {
  const cfg = JSON.parse(ev.config || '{}')
  db().prepare('update event set config = ? where community_id = ? and id = ?').run(JSON.stringify({ ...cfg, feedback: mode }), ev.community_id, ev.id)
  audit(ev.community_id, by, 'feedback.mode', String(ev.id), { mode })
}

export const getFeedback = (cid: number, regId: number) =>
  db().prepare('select * from feedback where community_id = ? and registration_id = ?').get(cid, regId) as FeedbackRow | undefined

export type FeedbackInput = { overall: number; organisation: number; sports_rating: number; favourite: string; would_return: string; went_well: string; improve: string }
const star = (n: unknown) => { const v = Number(n); return Number.isInteger(v) && v >= 1 && v <= 5 ? v : 0 }

/** One answer per registration; sending again replaces it, so a family can correct what it said. */
export function saveFeedback(ev: EventRow, reg: RegistrationRow, raw: Partial<Record<keyof FeedbackInput, unknown>>, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (reg.community_id !== ev.community_id || reg.event_id !== ev.id) return { ok: false, error: 'Not found' }
  if (reg.status === 'cancelled') return { ok: false, error: 'This registration was cancelled' }
  if (!feedbackOpen(ev, now)) return { ok: false, error: 'Feedback is not open yet' }
  const overall = star(raw.overall), organisation = star(raw.organisation), sports_rating = star(raw.sports_rating)
  if (!overall || !organisation || !sports_rating) return { ok: false, error: 'Please give all three star ratings' }
  const sports = JSON.parse(ev.sports) as string[]
  const fav = String(raw.favourite ?? '')
  const favourite = sports.includes(fav) ? fav : ''
  const ret = String(raw.would_return ?? '')
  const would_return = (RETURN_CHOICES as readonly string[]).includes(ret) ? ret : ''
  const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
  const iso = now.toISOString()
  db().prepare(`insert into feedback (community_id,event_id,registration_id,overall,organisation,sports_rating,favourite,would_return,went_well,improve,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?)
    on conflict (event_id, registration_id) do update set overall=excluded.overall, organisation=excluded.organisation, sports_rating=excluded.sports_rating,
      favourite=excluded.favourite, would_return=excluded.would_return, went_well=excluded.went_well, improve=excluded.improve, updated_at=excluded.updated_at`)
    .run(ev.community_id, ev.id, reg.id, overall, organisation, sports_rating, favourite, would_return, clean(raw.went_well), clean(raw.improve), iso, iso)
  return { ok: true }
}

export type FeedbackSummary = {
  responses: number; registrations: number; overall: number; organisation: number; sports: number
  spread: number[]; favourites: Record<string, number>; wouldReturn: Record<string, number>
}
export function feedbackSummary(cid: number, eventId: number): FeedbackSummary {
  const rows = db().prepare('select * from feedback where community_id = ? and event_id = ?').all(cid, eventId) as unknown as FeedbackRow[]
  const regs = (db().prepare("select count(*) n from registration where community_id = ? and event_id = ? and status != 'cancelled' and rejected = 0").get(cid, eventId) as { n: number }).n
  const avg = (f: (r: FeedbackRow) => number) => (rows.length ? Math.round((rows.reduce((s, r) => s + f(r), 0) / rows.length) * 10) / 10 : 0)
  const count = (f: (r: FeedbackRow) => string) => rows.reduce<Record<string, number>>((m, r) => { const k = f(r); if (k) m[k] = (m[k] ?? 0) + 1; return m }, {})
  return {
    responses: rows.length, registrations: regs, overall: avg((r) => r.overall), organisation: avg((r) => r.organisation), sports: avg((r) => r.sports_rating),
    spread: [1, 2, 3, 4, 5].map((n) => rows.filter((r) => r.overall === n).length), favourites: count((r) => r.favourite), wouldReturn: count((r) => r.would_return),
  }
}
export type FeedbackListed = FeedbackRow & { ref: string }
export const listFeedback = (cid: number, eventId: number) =>
  db().prepare('select f.*, r.ref from feedback f join registration r on r.id = f.registration_id where f.community_id = ? and f.event_id = ? order by f.id desc').all(cid, eventId) as unknown as FeedbackListed[]

/** Queues one email per registrant who has an address and has not answered yet. Safe to run again: only the people still missing get it. */
export function queueFeedbackRequests(ev: EventRow, slug: string, by: string): number {
  const regs = db().prepare(`select r.* from registration r where r.community_id = ? and r.event_id = ? and r.status != 'cancelled' and r.rejected = 0 and r.registrant_email != ''
    and not exists (select 1 from feedback f where f.registration_id = r.id)`).all(ev.community_id, ev.id) as unknown as RegistrationRow[]
  for (const r of regs) {
    queueEmail(ev.community_id, r.registrant_email, `How was ${ev.title}? Two minutes of feedback`, [
      `Hello ${r.registrant_name},`, '', `Thank you for joining ${ev.title}. Please tell us how it went. It takes about two minutes:`, '',
      publicUrl(`/c/${slug}/r/${r.token}/feedback`), '', 'Your answers help us plan the next event.'].join('\n'))
  }
  audit(ev.community_id, by, 'feedback.requested', String(ev.id), { emails: regs.length })
  return regs.length
}
