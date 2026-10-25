import { getDb } from './db'
import { sportFormats } from './sports'
import { formatsOf, partnersOf, skillsOf } from './registration/rules'
import { audit, getEvent, listRows, type Row } from './repo'

// ---------- types ----------
export type Format = 'knockout' | 'roundrobin'
export type EntryType = 'singles' | 'doubles' | 'team'
export type Competition = {
  id: number; community_id: number; event_id: number; sport: string; name: string; format: Format; entry_type: EntryType; team_size: number
  gender: string; min_age: number | null; max_age: number | null; third_place: 'match' | 'joint'; drawn: number; published_rounds: number; locked: number
}
export type Entry = { id: number; community_id: number; competition_id: number; name: string; seed: number; withdrawn: number }
export type Player = { id: number; name: string; age: number; gender: string; skill: string }
export type EntryWithPlayers = Entry & { players: Player[] }
export type MatchRow = {
  id: number; community_id: number; competition_id: number; kind: 'main' | 'third' | 'rr'; round: number; slot: number
  a_entry: number | null; b_entry: number | null; bye: number; court: string; scheduled_at: string
  status: 'pending' | 'ready' | 'live' | 'done'; winner: number | null; score: string; outcome: string
  next_id: number | null; next_side: 'a' | 'b' | null; loser_next_id: number | null; loser_next_side: 'a' | 'b' | null
  version: number; updated_by: string | null; updated_at: string | null
}
export type Match = MatchRow & { aName: string; bName: string; winnerName: string }
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const db = () => getDb()
const all = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).all(...p) as unknown as T[]
const one = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).get(...p) as unknown as T | undefined
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const SKILL_SCORE: Record<string, number> = { competitive: 3, casual: 2, beginner: 1, '': 2 }

// ---------- competitions ----------
export const getCompetition = (cid: number, id: number) => one<Competition>('select * from competition where community_id = ? and id = ?', cid, id)
export const listCompetitions = (cid: number, eventId: number, sport?: string) =>
  all<Competition>(`select * from competition where community_id = ? and event_id = ? ${sport ? 'and sport = ?' : ''} order by sport, id`, ...(sport ? [cid, eventId, sport] : [cid, eventId]))

export type NewCompetition = { eventId: number; sport: string; name: string; format: Format; entryType: EntryType; teamSize?: number; gender?: string; minAge?: number | null; maxAge?: number | null; thirdPlace?: 'match' | 'joint' }
export function createCompetition(cid: number, c: NewCompetition, by: string): Result<{ id: number }> {
  const ev = getEvent(cid, c.eventId)
  if (!ev) return fail('Event not found')
  if (!(JSON.parse(ev.sports) as string[]).includes(c.sport)) return fail('That sport is not part of this event')
  const name = c.name.trim()
  if (!name || name.length > 60) return fail('Give the category a name (up to 60 characters)')
  if (!['knockout', 'roundrobin'].includes(c.format)) return fail('Choose a format')
  if (!['singles', 'doubles', 'team'].includes(c.entryType)) return fail('Choose singles, doubles or team')
  if (!sportFormats(c.sport).includes(c.entryType)) return fail(`${c.sport} is played as ${sportFormats(c.sport).join(' or ')} only`)
  const teamSize = c.entryType === 'singles' ? 1 : c.entryType === 'doubles' ? 2 : Math.min(15, Math.max(2, Math.floor(c.teamSize ?? 5)))
  const gender = c.gender === 'Male' || c.gender === 'Female' ? c.gender : ''
  const min = c.minAge && c.minAge > 0 ? Math.floor(c.minAge) : null
  const max = c.maxAge && c.maxAge > 0 ? Math.floor(c.maxAge) : null
  if (min && max && min > max) return fail('The minimum age is above the maximum age')
  const id = Number(db().prepare('insert into competition (community_id,event_id,sport,name,format,entry_type,team_size,gender,min_age,max_age,third_place) values (?,?,?,?,?,?,?,?,?,?,?)')
    .run(cid, c.eventId, c.sport, name, c.format, c.entryType, teamSize, gender, min, max, c.thirdPlace === 'joint' ? 'joint' : 'match').lastInsertRowid)
  audit(cid, by, 'competition.created', String(id), { sport: c.sport, name })
  return { ok: true, id }
}

export function deleteCompetition(cid: number, id: number, by: string): Result {
  const comp = getCompetition(cid, id)
  if (!comp) return fail('Not found')
  if (comp.locked) return fail('Results are locked')
  if (hasResults(cid, id)) return fail('This category already has results. Clear them first.')
  const d = db()
  d.exec('begin')
  try {
    d.prepare('delete from match where community_id = ? and competition_id = ?').run(cid, id)
    d.prepare('delete from entry_member where community_id = ? and competition_id = ?').run(cid, id)
    d.prepare('delete from entry where community_id = ? and competition_id = ?').run(cid, id)
    d.prepare('delete from competition where community_id = ? and id = ?').run(cid, id)
    audit(cid, by, 'competition.deleted', String(id), { name: comp.name })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true }
}

function hasResults(cid: number, compId: number) {
  return (one<{ n: number }>("select count(*) n from match where community_id = ? and competition_id = ? and status = 'done' and bye = 0", cid, compId)?.n ?? 0) > 0
}

export function setLocked(cid: number, id: number, locked: boolean, by: string): Result {
  const comp = getCompetition(cid, id)
  if (!comp) return fail('Not found')
  db().prepare('update competition set locked = ? where community_id = ? and id = ?').run(locked ? 1 : 0, cid, id)
  audit(cid, by, locked ? 'competition.locked' : 'competition.reopened', String(id), { name: comp.name })
  return { ok: true }
}

// ---------- players and entries ----------
/** Only players who are physically here can be placed in a round (SP2). */
export function eligiblePlayers(cid: number, comp: Competition): Row[] {
  const taken = new Set(all<{ participant_id: number }>('select participant_id from entry_member where community_id = ? and competition_id = ?', cid, comp.id).map((r) => r.participant_id))
  return listRows(cid, comp.event_id).filter((r) =>
    r.sportList.includes(comp.sport) && !r.waitlistList.includes(comp.sport) && r.reg_status !== 'cancelled' && !!r.checked_in_at && !taken.has(r.id) &&
    (!comp.gender || r.gender === comp.gender) && (!comp.min_age || r.age >= comp.min_age) && (!comp.max_age || r.age <= comp.max_age))
    .filter((r) => (formatsOf(r)[comp.sport] ?? []).includes(comp.entry_type)) // only people who said they play this way
    .map((r) => ({ ...r, skill: skillsOf(r)[comp.sport] ?? '' })) // level in this sport, not overall
}

export function listEntries(cid: number, compId: number): EntryWithPlayers[] {
  const entries = all<Entry>('select * from entry where community_id = ? and competition_id = ? order by seed, id', cid, compId)
  const sport = getCompetition(cid, compId)?.sport ?? ''
  const members = all<Player & { entry_id: number; skills: string; sports: string }>(
    `select m.entry_id, p.id, p.name, p.age, p.gender, p.skill, p.skills, p.sports from entry_member m join participant p on p.id = m.participant_id and p.community_id = m.community_id
     where m.community_id = ? and m.competition_id = ? order by p.name`, cid, compId)
  return entries.map((e) => ({ ...e, players: members.filter((m) => m.entry_id === e.id).map(({ entry_id: _x, skills, sports, ...p }) => ({ ...p, skill: skillsOf({ skills, skill: p.skill, sports })[sport] ?? '' })) }))
}

export function addEntry(cid: number, compId: number, participantIds: number[], by: string, teamName = ''): Result<{ id: number }> {
  const comp = getCompetition(cid, compId)
  if (!comp) return fail('Category not found')
  if (comp.locked) return fail('Results are locked')
  if (comp.drawn) return fail('The draw is made. Reset it to change the entries.')
  const ids = [...new Set(participantIds)]
  if (comp.entry_type !== 'team' && ids.length !== comp.team_size) return fail(comp.entry_type === 'singles' ? 'Pick one player' : 'Pick exactly two players for a pair')
  if (comp.entry_type === 'team' && (ids.length < 2 || ids.length > comp.team_size)) return fail(`A team needs 2 to ${comp.team_size} players`)
  if (comp.entry_type === 'team' && !teamName.trim()) return fail('Give the team a name')
  const eligible = new Map(eligiblePlayers(cid, comp).map((p) => [p.id, p]))
  for (const id of ids) {
    if (!eligible.has(id)) {
      const p = one<{ name: string }>('select name from participant where community_id = ? and id = ?', cid, id)
      return fail(`${p?.name ?? 'That player'} cannot be added: not arrived, not in ${comp.sport}, outside this category, or already entered`)
    }
  }
  const people = ids.map((i) => eligible.get(i)!)
  const name = comp.entry_type === 'team' ? teamName.trim().slice(0, 40) : people.map((p) => p.name).join(' + ')
  const d = db()
  d.exec('begin')
  try {
    const seed = (one<{ m: number | null }>('select max(seed) m from entry where community_id = ? and competition_id = ?', cid, compId)?.m ?? 0) + 1
    const eid = Number(d.prepare('insert into entry (community_id, competition_id, name, seed) values (?,?,?,?)').run(cid, compId, name, seed).lastInsertRowid)
    for (const p of people) d.prepare('insert into entry_member (entry_id, community_id, competition_id, participant_id) values (?,?,?,?)').run(eid, cid, compId, p.id)
    audit(cid, by, 'entry.added', String(eid), { competition: compId, name })
    d.exec('commit')
    return { ok: true, id: eid }
  } catch (e) { d.exec('rollback'); throw e }
}

export function addAllSingles(cid: number, compId: number, by: string): Result<{ added: number }> {
  const comp = getCompetition(cid, compId)
  if (!comp) return fail('Category not found')
  if (comp.entry_type !== 'singles') return fail('Only singles can be added in one go')
  let added = 0
  for (const p of eligiblePlayers(cid, comp)) { const r = addEntry(cid, compId, [p.id], by); if (r.ok) added++ }
  return { ok: true, added }
}

export function removeEntry(cid: number, entryId: number, by: string): Result {
  const e = one<Entry>('select * from entry where community_id = ? and id = ?', cid, entryId)
  const comp = e && getCompetition(cid, e.competition_id)
  if (!e || !comp) return fail('Not found')
  if (comp.locked) return fail('Results are locked')
  if (comp.drawn) return fail('The draw is made. Use "Withdraw" for someone who cannot play.')
  db().prepare('delete from entry_member where community_id = ? and entry_id = ?').run(cid, entryId)
  db().prepare('delete from entry where community_id = ? and id = ?').run(cid, entryId)
  audit(cid, by, 'entry.removed', String(entryId), { name: e.name })
  return { ok: true }
}

const strength = (e: EntryWithPlayers) => e.players.reduce((s, p) => s + (SKILL_SCORE[p.skill] ?? 2), 0)
/** Small reproducible shuffle so equal-strength entries are ordered the same way every time. */
const jitter = (n: number, salt: number) => Math.abs(Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453) % 1

export function autoSeed(cid: number, compId: number, by: string): Result {
  const comp = getCompetition(cid, compId)
  if (!comp) return fail('Category not found')
  if (comp.drawn) return fail('The draw is made. Reset it to change the seeds.')
  const entries = listEntries(cid, compId).sort((a, b) => strength(b) - strength(a) || jitter(a.id, compId) - jitter(b.id, compId))
  entries.forEach((e, i) => db().prepare('update entry set seed = ? where community_id = ? and id = ?').run(i + 1, cid, e.id))
  audit(cid, by, 'seeds.auto', String(compId))
  return { ok: true }
}

export function moveSeed(cid: number, entryId: number, dir: 'up' | 'down', by: string): Result {
  const e = one<Entry>('select * from entry where community_id = ? and id = ?', cid, entryId)
  const comp = e && getCompetition(cid, e.competition_id)
  if (!e || !comp) return fail('Not found')
  if (comp.drawn) return fail('The draw is made. Reset it to change the seeds.')
  const list = listEntries(cid, comp.id)
  const i = list.findIndex((x) => x.id === entryId)
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= list.length) return { ok: true }
  const order = list.map((x) => x.id);
  [order[i], order[j]] = [order[j], order[i]]
  order.forEach((id, k) => db().prepare('update entry set seed = ? where community_id = ? and id = ?').run(k + 1, cid, id))
  audit(cid, by, 'seeds.moved', String(entryId), { dir })
  return { ok: true }
}

// ---------- partner requests and pairing help (doubles, SP4 and SP5) ----------
export type PartnerRequest = { id: number; from_pid: number; to_pid: number; note: string; by: string | null }
export function addPartnerRequest(cid: number, eventId: number, sport: string, fromPid: number, toPid: number, note: string, by: string): Result {
  if (fromPid === toPid) return fail('A player cannot ask for themselves')
  const rows = listRows(cid, eventId).filter((r) => r.sportList.includes(sport))
  if (!rows.some((r) => r.id === fromPid) || !rows.some((r) => r.id === toPid)) return fail(`Both players must be registered for ${sport}`)
  db().prepare('insert into partner_request (community_id, event_id, sport, from_pid, to_pid, note, by) values (?,?,?,?,?,?,?) on conflict(event_id, sport, from_pid) do update set to_pid = excluded.to_pid, note = excluded.note, by = excluded.by')
    .run(cid, eventId, sport, fromPid, toPid, note.slice(0, 120), by)
  audit(cid, by, 'partner.request', `${fromPid}>${toPid}`, { sport })
  return { ok: true }
}
export const listPartnerRequests = (cid: number, eventId: number, sport: string) =>
  all<PartnerRequest>('select id, from_pid, to_pid, note, by from partner_request where community_id = ? and event_id = ? and sport = ? order by id', cid, eventId, sport)
export function removePartnerRequest(cid: number, id: number) {
  db().prepare('delete from partner_request where community_id = ? and id = ?').run(cid, id)
}

const normName = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()
export type Declared = { from: Row; text: string; to: Row | null; problem: string }
/** Partners people named when they registered (a name, or the other family's HR reference). Resolved against the players who can be entered now, across families. */
export function declaredPartners(cid: number, comp: Competition): Declared[] {
  const pool = eligiblePlayers(cid, comp)
  const out: Declared[] = []
  for (const from of pool) {
    const text = partnersOf(from)[comp.sport]
    if (!text) continue
    const others = pool.filter((p) => p.id !== from.id)
    const ref = /^HR-[0-9A-F]{8}$/i.test(text.trim()) ? others.filter((p) => p.reg_ref.toUpperCase() === text.trim().toUpperCase()) : null
    const exact = ref ?? others.filter((p) => normName(p.name) === normName(text))
    const found = exact.length ? exact : ref ? [] : others.filter((p) => normName(p.name).includes(normName(text)))
    out.push(found.length === 1
      ? { from, text, to: found[0], problem: '' }
      : { from, text, to: null, problem: found.length > 1 ? 'more than one player matches, use the exact name or the HR reference' : 'no arrived player of this category matches yet' })
  }
  return out
}

export type TeamGroup = { key: string; name: string; players: Row[]; tooMany: boolean }
/** Teams people asked for by name when registering, even across families. Proposals only. */
export function suggestTeams(cid: number, comp: Competition): TeamGroup[] {
  if (comp.entry_type !== 'team') return []
  const groups = new Map<string, TeamGroup>()
  for (const p of eligiblePlayers(cid, comp)) {
    const name = partnersOf(p)[comp.sport]
    if (!name) continue
    const key = normName(name)
    const g = groups.get(key) ?? { key, name, players: [], tooMany: false }
    g.players.push(p); groups.set(key, g)
  }
  return [...groups.values()].filter((g) => g.players.length >= 2).map((g) => ({ ...g, tooMany: g.players.length > comp.team_size }))
}

export type Suggestion = { a: Row; b: Row; reason: 'mutual' | 'requested' | 'similar' }
/** Proposals only: mutual requests first, then one-sided requests, then the closest in skill and age. Nothing is created until the coordinator confirms. */
export function suggestPairs(cid: number, comp: Competition): Suggestion[] {
  if (comp.entry_type !== 'doubles') return []
  const pool = eligiblePlayers(cid, comp)
  const byId = new Map(pool.map((p) => [p.id, p]))
  const typed = listPartnerRequests(cid, comp.event_id, comp.sport)
  const declared = declaredPartners(cid, comp).filter((d) => d.to).map((d) => ({ from_pid: d.from.id, to_pid: d.to!.id }))
  const reqs = [...typed, ...declared.filter((d) => !typed.some((t) => t.from_pid === d.from_pid && t.to_pid === d.to_pid))]
  const used = new Set<number>()
  const out: Suggestion[] = []
  const take = (a: Row, b: Row, reason: Suggestion['reason']) => { used.add(a.id); used.add(b.id); out.push({ a, b, reason }) }
  for (const r of reqs) {
    const a = byId.get(r.from_pid), b = byId.get(r.to_pid)
    if (!a || !b || used.has(a.id) || used.has(b.id)) continue
    if (reqs.some((x) => x.from_pid === r.to_pid && x.to_pid === r.from_pid)) take(a, b, 'mutual')
  }
  for (const r of reqs) {
    const a = byId.get(r.from_pid), b = byId.get(r.to_pid)
    if (a && b && !used.has(a.id) && !used.has(b.id)) take(a, b, 'requested')
  }
  const left = pool.filter((p) => !used.has(p.id)).sort((x, y) => x.gender.localeCompare(y.gender) || (SKILL_SCORE[y.skill] ?? 2) - (SKILL_SCORE[x.skill] ?? 2) || x.age - y.age)
  for (let i = 0; i + 1 < left.length; i += 2) take(left[i], left[i + 1], 'similar')
  return out
}

// ---------- draw ----------
function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) { const n = order.length * 2; order = order.flatMap((s) => [s, n + 1 - s]) }
  return order
}

function insertMatch(cid: number, compId: number, m: { kind: 'main' | 'third' | 'rr'; round: number; slot: number; a?: number | null; b?: number | null; bye?: boolean }) {
  const both = m.a && m.b
  return Number(db().prepare('insert into match (community_id, competition_id, kind, round, slot, a_entry, b_entry, bye, status) values (?,?,?,?,?,?,?,?,?)')
    .run(cid, compId, m.kind, m.round, m.slot, m.a ?? null, m.b ?? null, m.bye ? 1 : 0, both ? 'ready' : 'pending').lastInsertRowid)
}

export function generateDraw(cid: number, compId: number, by: string): Result<{ matches: number }> {
  const comp = getCompetition(cid, compId)
  if (!comp) return fail('Category not found')
  if (comp.locked) return fail('Results are locked')
  if (hasResults(cid, compId)) return fail('Results are already entered. Clear them before drawing again.')
  const entries = listEntries(cid, compId).filter((e) => !e.withdrawn)
  if (entries.length < 2) return fail('Add at least two entries first')
  const d = db()
  d.exec('begin')
  try {
    d.prepare('delete from match where community_id = ? and competition_id = ?').run(cid, compId)
    if (comp.format === 'roundrobin') generateRoundRobin(cid, compId, entries)
    else generateKnockout(cid, comp, entries)
    d.prepare('update competition set drawn = 1, published_rounds = 0 where community_id = ? and id = ?').run(cid, compId)
    audit(cid, by, 'draw.generated', String(compId), { entries: entries.length })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true, matches: one<{ n: number }>('select count(*) n from match where community_id = ? and competition_id = ?', cid, compId)!.n }
}

function generateRoundRobin(cid: number, compId: number, entries: EntryWithPlayers[]) {
  const ids: (number | null)[] = entries.map((e) => e.id)
  if (ids.length % 2) ids.push(null)
  const n = ids.length
  for (let round = 1; round < n; round++) {
    let slot = 1
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i]
      if (a && b) insertMatch(cid, compId, { kind: 'rr', round, slot: slot++, a, b })
    }
    ids.splice(1, 0, ids.pop()!) // rotate everything except the first
  }
}

function generateKnockout(cid: number, comp: Competition, entries: EntryWithPlayers[]) {
  const n = entries.length
  let size = 2
  while (size < n) size *= 2
  const rounds = Math.log2(size)
  const bySeed = new Map(entries.map((e, i) => [i + 1, e.id]))
  const pos = seedOrder(size)
  const grid: number[][] = []
  for (let r = 1; r <= rounds; r++) {
    grid[r] = []
    for (let s = 1; s <= size / 2 ** r; s++) {
      if (r === 1) {
        const a = bySeed.get(pos[2 * s - 2]) ?? null, b = bySeed.get(pos[2 * s - 1]) ?? null
        grid[r][s] = insertMatch(cid, comp.id, { kind: 'main', round: 1, slot: s, a, b, bye: !(a && b) })
      } else grid[r][s] = insertMatch(cid, comp.id, { kind: 'main', round: r, slot: s })
    }
  }
  let thirdId: number | null = null
  // With only three entries one semi-final is a bye and has no loser, so there is nothing to play for third place: that loser takes bronze.
  const semiHasBye = rounds >= 2 && grid[rounds - 1].some((id) => id && getMatchById(id)?.bye)
  if (comp.third_place === 'match' && rounds >= 2 && !semiHasBye) thirdId = insertMatch(cid, comp.id, { kind: 'third', round: rounds, slot: 2 })
  const link = db().prepare('update match set next_id = ?, next_side = ?, loser_next_id = ?, loser_next_side = ? where id = ?')
  for (let r = 1; r < rounds; r++) {
    for (let s = 1; s <= size / 2 ** r; s++) {
      const next = grid[r + 1][Math.ceil(s / 2)]
      const side = s % 2 ? 'a' : 'b'
      const loserTo = r === rounds - 1 && thirdId ? thirdId : null
      link.run(next, side, loserTo, loserTo ? side : null, grid[r][s])
    }
  }
  // Byes: the lone entry moves straight on.
  for (let s = 1; s <= size / 2; s++) {
    const m = getMatchById(grid[1][s])!
    if (!m.bye) continue
    const winner = m.a_entry ?? m.b_entry
    if (winner) finishMatch(m, winner, 'bye', '', 'draw')
  }
}

// ---------- matches ----------
const getMatchById = (id: number) => one<MatchRow>('select * from match where id = ?', id)
export function getMatch(cid: number, id: number) { return one<MatchRow>('select * from match where community_id = ? and id = ?', cid, id) }

export function listMatches(cid: number, compId: number): Match[] {
  const names = new Map(all<{ id: number; name: string }>('select id, name from entry where community_id = ? and competition_id = ?', cid, compId).map((e) => [e.id, e.name]))
  return all<MatchRow>("select * from match where community_id = ? and competition_id = ? order by round, case kind when 'third' then 2 else 1 end, slot", cid, compId)
    .map((m) => ({ ...m, aName: m.a_entry ? names.get(m.a_entry) ?? '' : '', bName: m.b_entry ? names.get(m.b_entry) ?? '' : '', winnerName: m.winner ? names.get(m.winner) ?? '' : '' }))
}

const isWithdrawn = (id: number | null) => !!id && !!one<{ w: number }>('select withdrawn w from entry where id = ?', id)?.w

function refresh(id: number) {
  const m = getMatchById(id)
  if (!m || m.status === 'done') return
  const status = m.a_entry && m.b_entry ? (m.status === 'live' ? 'live' : 'ready') : 'pending'
  if (status !== m.status) db().prepare('update match set status = ? where id = ?').run(status, id)
}

function place(matchId: number | null, side: 'a' | 'b' | null, entryId: number | null) {
  if (!matchId || !side) return
  db().prepare(`update match set ${side}_entry = ? where id = ?`).run(entryId, matchId)
  refresh(matchId)
  autoResolve(matchId)
}

/** A match whose opponent has withdrawn is a walkover for the player who is here. */
function autoResolve(matchId: number) {
  const m = getMatchById(matchId)
  if (!m || m.status === 'done' || !m.a_entry || !m.b_entry) return
  const aw = isWithdrawn(m.a_entry), bw = isWithdrawn(m.b_entry)
  if (aw && !bw) finishMatch(m, m.b_entry, 'walkover', '', 'system')
  else if (bw && !aw) finishMatch(m, m.a_entry, 'walkover', '', 'system')
}

function finishMatch(m: MatchRow, winner: number, outcome: string, score: string, by: string) {
  const loser = m.a_entry === winner ? m.b_entry : m.a_entry
  db().prepare("update match set winner = ?, status = 'done', outcome = ?, score = ?, version = version + 1, updated_by = ?, updated_at = ? where id = ?")
    .run(winner, outcome, score, by, new Date().toISOString(), m.id)
  place(m.next_id, m.next_side, winner)
  if (m.loser_next_id) place(m.loser_next_id, m.loser_next_side, loser)
}

export type ResultInput = { side: 'a' | 'b'; score?: string; outcome?: string; version: number }
/** Two taps from the bracket: pick the winner, optionally add a score. A stale screen is refused so two coordinators never overwrite each other. */
export function setResult(cid: number, matchId: number, input: ResultInput, by: string): Result {
  const m = getMatch(cid, matchId)
  const comp = m && getCompetition(cid, m.competition_id)
  if (!m || !comp) return fail('Match not found')
  if (comp.locked) return fail('Results are locked by the event admin')
  if (!m.a_entry || !m.b_entry) return fail('Both players must be known before a result can be entered')
  if (m.version !== input.version) return fail('Someone else just changed this match. The screen has been refreshed; check it and try again.')
  const winner = input.side === 'a' ? m.a_entry : m.b_entry
  const outcome = ['played', 'walkover', 'retired'].includes(input.outcome ?? '') ? input.outcome! : 'played'
  const score = (input.score ?? '').trim().slice(0, 40)
  const before = m.status === 'done' ? { winner: m.winner, score: m.score, outcome: m.outcome } : null
  if (before && before.winner === winner && before.score === score && before.outcome === outcome) return { ok: true }
  if (before && before.winner !== winner) {
    const blocked = [m.next_id, m.loser_next_id].some((nid) => nid && getMatchById(nid)?.status === 'done')
    if (blocked) return fail('The next round match already has a result. Clear that result first.')
  }
  const d = db()
  d.exec('begin')
  try {
    finishMatch(m, winner, outcome, score, by)
    audit(cid, by, before ? 'match.corrected' : 'match.result', String(matchId), { before, after: { winner, score, outcome } })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true }
}

export function clearResult(cid: number, matchId: number, version: number, by: string): Result {
  const m = getMatch(cid, matchId)
  const comp = m && getCompetition(cid, m.competition_id)
  if (!m || !comp) return fail('Match not found')
  if (comp.locked) return fail('Results are locked by the event admin')
  if (m.bye) return fail('A bye cannot be cleared')
  if (m.status !== 'done') return { ok: true }
  if (m.version !== version) return fail('Someone else just changed this match. The screen has been refreshed.')
  if ([m.next_id, m.loser_next_id].some((nid) => nid && getMatchById(nid)?.status === 'done')) return fail('The next round match already has a result. Clear that result first.')
  const d = db()
  d.exec('begin')
  try {
    d.prepare("update match set winner = null, status = 'ready', outcome = '', score = '', version = version + 1, updated_by = ?, updated_at = ? where id = ?").run(by, new Date().toISOString(), matchId)
    place(m.next_id, m.next_side, null)
    if (m.loser_next_id) place(m.loser_next_id, m.loser_next_side, null)
    audit(cid, by, 'match.cleared', String(matchId), { before: { winner: m.winner, score: m.score, outcome: m.outcome } })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true }
}

export function setLive(cid: number, matchId: number, live: boolean, by: string): Result {
  const m = getMatch(cid, matchId)
  const comp = m && getCompetition(cid, m.competition_id)
  if (!m || !comp) return fail('Match not found')
  if (comp.locked) return fail('Results are locked by the event admin')
  if (m.status === 'done' || !m.a_entry || !m.b_entry) return fail('This match cannot be started')
  db().prepare('update match set status = ?, version = version + 1, updated_by = ?, updated_at = ? where id = ?').run(live ? 'live' : 'ready', by, new Date().toISOString(), matchId)
  return { ok: true }
}

export function withdrawEntry(cid: number, entryId: number, by: string): Result {
  const e = one<Entry>('select * from entry where community_id = ? and id = ?', cid, entryId)
  const comp = e && getCompetition(cid, e.competition_id)
  if (!e || !comp) return fail('Not found')
  if (comp.locked) return fail('Results are locked by the event admin')
  const d = db()
  d.exec('begin')
  try {
    d.prepare('update entry set withdrawn = 1 where community_id = ? and id = ?').run(cid, entryId)
    for (const m of all<MatchRow>("select * from match where community_id = ? and competition_id = ? and status != 'done' and (a_entry = ? or b_entry = ?)", cid, comp.id, entryId, entryId)) autoResolve(m.id)
    audit(cid, by, 'entry.withdrawn', String(entryId), { name: e.name })
    d.exec('commit')
  } catch (err) { d.exec('rollback'); throw err }
  return { ok: true }
}

// ---------- schedule and publishing ----------
/** Court and time for a match. A clash (someone already due elsewhere at that time) is returned as a warning, not a block. */
export function setSchedule(cid: number, matchId: number, court: string, time: string, by: string): Result<{ clashes: string[] }> {
  const m = getMatch(cid, matchId)
  const comp = m && getCompetition(cid, m.competition_id)
  if (!m || !comp) return fail('Match not found')
  if (comp.locked) return fail('Results are locked by the event admin')
  const c = court.trim().slice(0, 30), t = time.trim().slice(0, 20)
  db().prepare('update match set court = ?, scheduled_at = ?, version = version + 1, updated_by = ?, updated_at = ? where id = ?').run(c, t, by, new Date().toISOString(), matchId)
  const clashes: string[] = []
  if (t) {
    const mine = playersOfMatch(cid, m)
    for (const o of all<MatchRow & { cname: string }>(
      `select m.*, c.name cname from match m join competition c on c.id = m.competition_id where m.community_id = ? and lower(m.scheduled_at) = lower(?) and m.id != ? and m.status != 'done'`, cid, t, matchId)) {
      const theirs = playersOfMatch(cid, o)
      for (const p of mine) if (theirs.some((q) => q.id === p.id)) clashes.push(`${p.name} is also in ${o.cname} at ${t}`)
    }
    if (c) {
      const same = one<{ n: number }>("select count(*) n from match where community_id = ? and lower(scheduled_at) = lower(?) and lower(court) = lower(?) and id != ? and status != 'done'", cid, t, c, matchId)!.n
      if (same) clashes.push(`${c} is already in use at ${t}`)
    }
  }
  return { ok: true, clashes }
}

function playersOfMatch(cid: number, m: MatchRow): { id: number; name: string }[] {
  const ids = [m.a_entry, m.b_entry].filter(Boolean) as number[]
  if (!ids.length) return []
  return all<{ id: number; name: string }>(`select p.id, p.name from entry_member em join participant p on p.id = em.participant_id where em.community_id = ? and em.entry_id in (${ids.map(() => '?').join(',')})`, cid, ...ids)
}

/** Players and the board only see a round once the coordinator confirms it (SP5). A round can be published only when its players are all known. */
export function publishRound(cid: number, compId: number, round: number, by: string): Result {
  const comp = getCompetition(cid, compId)
  if (!comp) return fail('Category not found')
  if (comp.locked) return fail('Results are locked by the event admin')
  if (!comp.drawn) return fail('Make the draw first')
  const rounds = all<{ round: number }>('select distinct round from match where community_id = ? and competition_id = ?', cid, compId).map((r) => r.round)
  const max = Math.max(...rounds)
  if (round < 0 || round > max) return fail('There is no such round')
  for (const m of all<MatchRow>('select * from match where community_id = ? and competition_id = ? and round <= ?', cid, compId, round)) {
    if (!m.bye && (!m.a_entry || !m.b_entry) && m.status !== 'done') return fail(`Round ${m.round} is not ready: some players are still unknown`)
  }
  db().prepare('update competition set published_rounds = ? where community_id = ? and id = ?').run(round, cid, compId)
  audit(cid, by, 'round.published', String(compId), { round })
  return { ok: true }
}

// ---------- standings and podium ----------
export type Standing = { entry: Entry; played: number; wins: number; losses: number; rank: number; tied: boolean }
export function standings(cid: number, compId: number): Standing[] {
  const entries = all<Entry>('select * from entry where community_id = ? and competition_id = ? and withdrawn = 0', cid, compId)
  const matches = all<MatchRow>("select * from match where community_id = ? and competition_id = ? and kind = 'rr' and status = 'done'", cid, compId)
  const rows = entries.map((entry) => {
    const mine = matches.filter((m) => m.a_entry === entry.id || m.b_entry === entry.id)
    const wins = mine.filter((m) => m.winner === entry.id).length
    return { entry, played: mine.length, wins, losses: mine.length - wins, rank: 0, tied: false }
  })
  const h2h = (a: Entry, b: Entry) => {
    const m = matches.find((x) => (x.a_entry === a.id && x.b_entry === b.id) || (x.a_entry === b.id && x.b_entry === a.id))
    return m ? (m.winner === a.id ? -1 : 1) : 0
  }
  rows.sort((x, y) => y.wins - x.wins || (x.wins === y.wins ? h2h(x.entry, y.entry) : 0) || x.entry.name.localeCompare(y.entry.name))
  rows.forEach((r, i) => {
    r.rank = i + 1
    const sameWins = rows.filter((o) => o.wins === r.wins)
    r.tied = sameWins.length > 2 || (sameWins.length === 2 && h2h(sameWins[0].entry, sameWins[1].entry) === 0)
  })
  return rows
}

export type Podium = { complete: boolean; first: EntryWithPlayers[]; second: EntryWithPlayers[]; third: EntryWithPlayers[]; unresolvedTie: boolean }
export function podium(cid: number, compId: number): Podium {
  const comp = getCompetition(cid, compId)
  const empty: Podium = { complete: false, first: [], second: [], third: [], unresolvedTie: false }
  if (!comp || !comp.drawn) return empty
  const entries = new Map(listEntries(cid, compId).map((e) => [e.id, e]))
  const pick = (id: number | null) => (id && entries.get(id) ? [entries.get(id)!] : [])
  const matches = all<MatchRow>('select * from match where community_id = ? and competition_id = ?', cid, compId)
  if (comp.format === 'roundrobin') {
    const complete = matches.length > 0 && matches.every((m) => m.status === 'done')
    if (!complete) return empty
    const st = standings(cid, compId)
    const tied = st.slice(0, 3).some((s) => s.tied)
    return { complete, first: pick(st[0]?.entry.id ?? null), second: pick(st[1]?.entry.id ?? null), third: pick(st[2]?.entry.id ?? null), unresolvedTie: tied }
  }
  const rounds = Math.max(...matches.map((m) => m.round))
  const final = matches.find((m) => m.kind === 'main' && m.round === rounds)
  if (!final || final.status !== 'done' || !final.winner) return empty
  const loser = final.a_entry === final.winner ? final.b_entry : final.a_entry
  let third: EntryWithPlayers[] = []
  if (rounds >= 2) {
    const t = matches.find((m) => m.kind === 'third')
    if (comp.third_place === 'match' && t) {
      if (t.status === 'done') third = pick(t.winner)
      else return { complete: false, first: pick(final.winner), second: pick(loser), third: [], unresolvedTie: false }
    } else {
      const semis = matches.filter((m) => m.kind === 'main' && m.round === rounds - 1)
      if (semis.some((s) => s.status !== 'done')) return { complete: false, first: pick(final.winner), second: pick(loser), third: [], unresolvedTie: false }
      third = semis.flatMap((s) => pick(s.a_entry === s.winner ? s.b_entry : s.a_entry))
    }
  }
  return { complete: true, first: pick(final.winner), second: pick(loser), third, unresolvedTie: false }
}

export const roundName = (round: number, rounds: number, kind: string) =>
  kind === 'third' ? 'Third place' : kind === 'rr' ? `Round ${round}` : round === rounds ? 'Final' : round === rounds - 1 ? 'Semi-final' : round === rounds - 2 ? 'Quarter-final' : `Round ${round}`
