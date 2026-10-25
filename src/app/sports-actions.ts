'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import * as repo from '@/lib/repo'
import * as ops from '@/lib/sports-ops'
import { persist } from '@/lib/persist'
import { canSeeSport, getActor } from '@/lib/session'

type Flash = { msg?: string; err?: string; warn?: string }
const q = (f: Flash) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); const s = p.toString(); return s ? `?${s}` : '' }
const consoleUrl = (slug: string, sport: string, compId: number, f: Flash = {}) => `/c/${slug}/staff/sport/${encodeURIComponent(sport)}/categories/${compId}${q(f)}`
const listUrl = (slug: string, sport: string, f: Flash = {}) => `/c/${slug}/staff/sport/${encodeURIComponent(sport)}/categories${q(f)}`

/** Every action re-checks who is signed in and that they may touch this sport. Admins may touch all of them. */
async function authorise(slug: string, sport: string) {
  const c = repo.getCommunityBySlug(slug)
  const actor = await getActor(slug)
  if (!c || !canSeeSport(actor, sport)) throw new Error('Not authorised')
  return { c, actor: actor!, by: actor!.label }
}
async function forComp(slug: string, compId: number) {
  const c = repo.getCommunityBySlug(slug)
  const comp = c && ops.getCompetition(c.id, compId)
  if (!c || !comp) throw new Error('Not found')
  return { ...(await authorise(slug, comp.sport)), comp }
}
const done = async (slug: string, comp: ops.Competition, flash: Flash) => {
  await persist()
  revalidatePath(`/c/${slug}`, 'layout')
  redirect(consoleUrl(slug, comp.sport, comp.id, flash))
}
const num = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : null }

export async function createCompetitionAction(slug: string, eventId: number, sport: string, form: FormData) {
  const { c, by } = await authorise(slug, sport)
  const r = ops.createCompetition(c.id, {
    eventId, sport, name: String(form.get('name') ?? ''), format: String(form.get('format')) as ops.Format, entryType: String(form.get('entryType')) as ops.EntryType,
    teamSize: num(form.get('teamSize')) ?? undefined, gender: String(form.get('gender') ?? ''), minAge: num(form.get('minAge')), maxAge: num(form.get('maxAge')),
    thirdPlace: form.get('thirdPlace') === 'joint' ? 'joint' : 'match',
  }, by)
  await persist()
  revalidatePath(`/c/${slug}`, 'layout')
  redirect(r.ok ? consoleUrl(slug, sport, r.id, { msg: 'Category created. Add the players next.' }) : listUrl(slug, sport, { err: r.error }))
}

export async function addEntryAction(slug: string, compId: number, form: FormData) {
  const { c, by, comp } = await forComp(slug, compId)
  const ids = form.getAll('ids').map(Number).filter(Number.isInteger)
  if (comp.entry_type === 'singles') {
    let added = 0, err = ''
    for (const id of ids) { const r = ops.addEntry(c.id, compId, [id], by); if (r.ok) added++; else err = r.error }
    return done(slug, comp, err ? { err, msg: added ? `${added} added.` : '' } : { msg: `${added} added.` })
  }
  const r = ops.addEntry(c.id, compId, ids, by, String(form.get('teamName') ?? ''))
  return done(slug, comp, r.ok ? { msg: comp.entry_type === 'doubles' ? 'Pair created.' : 'Team created.' } : { err: r.error })
}
export async function addSuggestedPairAction(slug: string, compId: number, a: number, b: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.addEntry(c.id, compId, [a, b], by)
  return done(slug, comp, r.ok ? { msg: 'Pair created.' } : { err: r.error })
}
export async function addSuggestedTeamAction(slug: string, compId: number, name: string, form: FormData) {
  const { c, by, comp } = await forComp(slug, compId)
  const ids = form.getAll('ids').map(Number).filter((n) => Number.isInteger(n) && n > 0)
  const r = ops.addEntry(c.id, compId, ids, by, name)
  return done(slug, comp, r.ok ? { msg: `Team ${name} created.` } : { err: r.error })
}
export async function addAllSinglesAction(slug: string, compId: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.addAllSingles(c.id, compId, by)
  return done(slug, comp, r.ok ? { msg: `${r.added} players added.` } : { err: r.error })
}
export async function removeEntryAction(slug: string, compId: number, entryId: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.removeEntry(c.id, entryId, by)
  return done(slug, comp, r.ok ? { msg: 'Removed.' } : { err: r.error })
}
export async function seedAction(slug: string, compId: number, how: 'auto' | 'up' | 'down', entryId: number | null) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = how === 'auto' ? ops.autoSeed(c.id, compId, by) : ops.moveSeed(c.id, entryId!, how, by)
  return done(slug, comp, r.ok ? {} : { err: r.error })
}
export async function partnerRequestAction(slug: string, compId: number, form: FormData) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.addPartnerRequest(c.id, comp.event_id, comp.sport, Number(form.get('from')), Number(form.get('to')), String(form.get('note') ?? ''), by)
  return done(slug, comp, r.ok ? { msg: 'Request noted.' } : { err: r.error })
}
export async function removeRequestAction(slug: string, compId: number, requestId: number) {
  const { c, comp } = await forComp(slug, compId)
  ops.removePartnerRequest(c.id, requestId)
  return done(slug, comp, {})
}
export async function drawAction(slug: string, compId: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.generateDraw(c.id, compId, by)
  return done(slug, comp, r.ok ? { msg: `Draw made: ${r.matches} matches. Nothing is shown to players until you publish a round.` } : { err: r.error })
}
export async function scheduleAction(slug: string, matchId: number, form: FormData) {
  const c = repo.getCommunityBySlug(slug)
  const m = c && ops.getMatch(c.id, matchId)
  if (!c || !m) throw new Error('Not found')
  const { by, comp } = await forComp(slug, m.competition_id)
  const r = ops.setSchedule(c.id, matchId, String(form.get('court') ?? ''), String(form.get('time') ?? ''), by)
  return done(slug, comp, r.ok ? (r.clashes.length ? { warn: r.clashes.join(' · ') } : { msg: 'Saved.' }) : { err: r.error })
}
export async function startMatchAction(slug: string, matchId: number, live: boolean) {
  const c = repo.getCommunityBySlug(slug)
  const m = c && ops.getMatch(c.id, matchId)
  if (!c || !m) throw new Error('Not found')
  const { by, comp } = await forComp(slug, m.competition_id)
  const r = ops.setLive(c.id, matchId, live, by)
  return done(slug, comp, r.ok ? {} : { err: r.error })
}
/** The two-tap result: tap the winner's button. Score and "how it ended" are optional extras. */
export async function resultAction(slug: string, matchId: number, form: FormData) {
  const c = repo.getCommunityBySlug(slug)
  const m = c && ops.getMatch(c.id, matchId)
  if (!c || !m) throw new Error('Not found')
  const { by, comp } = await forComp(slug, m.competition_id)
  const side = String(form.get('side')) === 'b' ? 'b' : 'a'
  const r = ops.setResult(c.id, matchId, { side, score: String(form.get('score') ?? ''), outcome: String(form.get('outcome') ?? 'played'), version: Number(form.get('version')) }, by)
  return done(slug, comp, r.ok ? { msg: 'Result saved.' } : { err: r.error })
}
export async function clearResultAction(slug: string, matchId: number, form: FormData) {
  const c = repo.getCommunityBySlug(slug)
  const m = c && ops.getMatch(c.id, matchId)
  if (!c || !m) throw new Error('Not found')
  const { by, comp } = await forComp(slug, m.competition_id)
  const r = ops.clearResult(c.id, matchId, Number(form.get('version')), by)
  return done(slug, comp, r.ok ? { msg: 'Result cleared.' } : { err: r.error })
}
export async function withdrawAction(slug: string, compId: number, entryId: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.withdrawEntry(c.id, entryId, by)
  return done(slug, comp, r.ok ? { msg: 'Marked as withdrawn. Their opponents move on.' } : { err: r.error })
}
export async function publishAction(slug: string, compId: number, round: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.publishRound(c.id, compId, round, by)
  return done(slug, comp, r.ok ? { msg: round ? `Round ${round} is now visible to players and on the board.` : 'Hidden from players.' } : { err: r.error })
}
export async function deleteCompetitionAction(slug: string, compId: number) {
  const { c, by, comp } = await forComp(slug, compId)
  const r = ops.deleteCompetition(c.id, compId, by)
  await persist()
  revalidatePath(`/c/${slug}`, 'layout')
  redirect(r.ok ? listUrl(slug, comp.sport, { msg: 'Category deleted.' }) : consoleUrl(slug, comp.sport, comp.id, { err: r.error }))
}

/** Locking is for the event admin only: coordinators cannot reopen a result they entered. */
export async function lockAction(slug: string, compId: number, locked: boolean, back: 'console' | 'admin') {
  const c = repo.getCommunityBySlug(slug)
  const actor = await getActor(slug)
  const comp = c && ops.getCompetition(c.id, compId)
  if (!c || !comp || actor?.kind !== 'admin') throw new Error('Not authorised')
  ops.setLocked(c.id, compId, locked, 'admin')
  await persist()
  revalidatePath(`/c/${slug}`, 'layout')
  redirect(back === 'admin' ? `/c/${slug}/admin/events/${comp.event_id}/competitions` : consoleUrl(slug, comp.sport, compId, { msg: locked ? 'Results locked.' : 'Results reopened.' }))
}
