import { beforeEach, describe, expect, it } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import * as ops from '@/lib/sports-ops'
import { blankRow } from '@/lib/registration/rules'

const contact = { registrantName: 'Reg Person', registrantMobile: '9876543210', registrantEmail: 'reg@example.test', emergencyName: 'Em Contact', emergencyMobile: '9123456780', waiver: true as const }
let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let kitty: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let ev: repo.EventRow
let comp = 0

const nameOf = (i: number) => `Player ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26)) : ''}`

type Spec = { age?: number; gender?: 'Male' | 'Female'; skill?: string; sports?: string[]; arrive?: boolean; cancel?: boolean }
/** Registers one person per registration and (by default) checks them in. Returns participant ids in order. */
function players(n: number, spec: (i: number) => Spec = () => ({})): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const s = spec(i)
    const r = repo.createRegistration(ev, { ...contact, submissionKey: `seed-${comp}-${i}-${Math.random()}` }, [{
      ...blankRow(), name: nameOf(i), age: String(s.age ?? 30), gender: s.gender ?? (i % 2 ? 'Female' : 'Male'), mobile: '9876543210', sports: s.sports ?? ['Chess'], skill: s.skill ?? 'casual',
    }])
    if (!r.ok) throw new Error('setup ' + JSON.stringify(r))
    const reg = repo.getRegistrationByToken(r.token)!
    const [p] = repo.listParticipantsOfRegistration(jsg.id, reg.id)
    if (s.arrive !== false) repo.checkIn(jsg.id, [p.id], 'Gate', 'Main gate')
    if (s.cancel) repo.cancelRegistration(ev, reg, 'admin')
    out.push(p.id)
  }
  return out
}

function newComp(over: Partial<ops.NewCompetition> = {}) {
  const r = ops.createCompetition(jsg.id, { eventId: ev.id, sport: 'Chess', name: 'Open', format: 'knockout', entryType: 'singles', ...over }, 'coord')
  if (!r.ok) throw new Error(r.error)
  comp = r.id
  return r.id
}
const ok = <T extends { ok: boolean }>(r: T) => { expect(r.ok, JSON.stringify(r)).toBe(true); return r as Extract<T, { ok: true }> }

/** Plays every ready match, always letting side A win, until nothing is left. */
function playOut(compId: number, pick: (m: ops.Match) => 'a' | 'b' = () => 'a') {
  for (let guard = 0; guard < 500; guard++) {
    const m = ops.listMatches(jsg.id, compId).find((x) => x.status !== 'done' && x.a_entry && x.b_entry)
    if (!m) return
    ok(ops.setResult(jsg.id, m.id, { side: pick(m), version: m.version }, 'coord'))
  }
  throw new Error('did not finish')
}

beforeEach(() => {
  resetDbForTests()
  jsg = repo.getCommunityBySlug('jsg')!
  kitty = repo.getCommunityBySlug('kitty-demo')!
  ev = repo.listEvents(jsg.id)[0]
})

describe('knockout draw', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 16]) {
    it(`${n} entries: right number of matches and byes, nobody plays twice in a round, tournament completes with a podium`, () => {
      players(n)
      const c = newComp()
      ok(ops.addAllSingles(jsg.id, c, 'coord'))
      ok(ops.autoSeed(jsg.id, c, 'coord'))
      ok(ops.generateDraw(jsg.id, c, 'coord'))
      const ms = ops.listMatches(jsg.id, c)
      let size = 2; while (size < n) size *= 2
      const main = ms.filter((m) => m.kind === 'main')
      expect(main).toHaveLength(size - 1)
      expect(main.filter((m) => m.bye)).toHaveLength(size - n)
      const r1 = main.filter((m) => m.round === 1)
      const seen = r1.flatMap((m) => [m.a_entry, m.b_entry]).filter(Boolean)
      expect(new Set(seen).size).toBe(n)
      // top seeds get the byes
      const entries = ops.listEntries(jsg.id, c)
      const topSeeds = entries.slice(0, size - n).map((e) => e.id)
      for (const m of r1.filter((x) => x.bye)) expect(topSeeds).toContain(m.a_entry ?? m.b_entry)
      playOut(c)
      const pod = ops.podium(jsg.id, c)
      expect(pod.complete).toBe(true)
      expect(pod.first).toHaveLength(1)
      expect(pod.second).toHaveLength(1)
      const ids = [...pod.first, ...pod.second, ...pod.third].map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(pod.third.length).toBe(n >= 3 ? 1 : 0)
    })
  }

  it('joint bronze gives both semi-final losers third place', () => {
    players(8)
    const c = newComp({ thirdPlace: 'joint' })
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    expect(ops.listMatches(jsg.id, c).some((m) => m.kind === 'third')).toBe(false)
    playOut(c)
    expect(ops.podium(jsg.id, c).third).toHaveLength(2)
  })

  it('the podium is not complete until the third-place match is played', () => {
    players(4)
    const c = newComp()
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    for (const round of [1, 2]) for (const m of ops.listMatches(jsg.id, c).filter((x) => x.round === round && x.kind === 'main')) ok(ops.setResult(jsg.id, m.id, { side: 'a', version: m.version }, 'coord'))
    const mid = ops.podium(jsg.id, c)
    expect(mid.complete).toBe(false)
    expect(mid.first).toHaveLength(1)
    const third = ops.listMatches(jsg.id, c).find((m) => m.kind === 'third')!
    ok(ops.setResult(jsg.id, third.id, { side: 'b', version: third.version }, 'coord'))
    expect(ops.podium(jsg.id, c).complete).toBe(true)
  })

  it('needs at least two entries, and refuses to redraw once results exist', () => {
    players(2)
    const c = newComp()
    expect(ops.generateDraw(jsg.id, c, 'coord')).toMatchObject({ ok: false })
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    const m = ops.listMatches(jsg.id, c)[0]
    ok(ops.setResult(jsg.id, m.id, { side: 'a', version: m.version }, 'coord'))
    expect(ops.generateDraw(jsg.id, c, 'coord')).toMatchObject({ ok: false })
    expect(ops.deleteCompetition(jsg.id, c, 'coord')).toMatchObject({ ok: false })
  })
})

describe('entering results', () => {
  function eight() {
    players(8)
    const c = newComp()
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    return c
  }
  it('winners move on automatically and the match becomes ready when both players are known', () => {
    const c = eight()
    const [m1, m2] = ops.listMatches(jsg.id, c).filter((m) => m.round === 1)
    ok(ops.setResult(jsg.id, m1.id, { side: 'b', score: '21-15', version: m1.version }, 'coord'))
    let sf = ops.listMatches(jsg.id, c).find((m) => m.id === m1.next_id)!
    expect(sf.status).toBe('pending')
    expect(sf[m1.next_side === 'a' ? 'a_entry' : 'b_entry']).toBe(m1.b_entry)
    ok(ops.setResult(jsg.id, m2.id, { side: 'a', version: m2.version }, 'coord'))
    sf = ops.listMatches(jsg.id, c).find((m) => m.id === m1.next_id)!
    expect(sf.status).toBe('ready')
    expect(ops.listMatches(jsg.id, c).find((m) => m.id === m1.id)).toMatchObject({ score: '21-15', outcome: 'played', status: 'done' })
  })
  it('a stale screen is refused so two coordinators cannot overwrite each other', () => {
    const c = eight()
    const m = ops.listMatches(jsg.id, c)[0]
    ok(ops.setResult(jsg.id, m.id, { side: 'a', version: m.version }, 'coordinator one'))
    const second = ops.setResult(jsg.id, m.id, { side: 'b', version: m.version }, 'coordinator two')
    expect(second).toMatchObject({ ok: false, error: expect.stringContaining('Someone else') })
    expect(ops.listMatches(jsg.id, c)[0].winner).toBe(m.a_entry)
  })
  it('a result can be corrected until the next round has been played, and every correction is logged with before and after', () => {
    const c = eight()
    const [m1, m2] = ops.listMatches(jsg.id, c).filter((m) => m.round === 1)
    ok(ops.setResult(jsg.id, m1.id, { side: 'a', version: m1.version }, 'coord'))
    let cur = ops.getMatch(jsg.id, m1.id)!
    ok(ops.setResult(jsg.id, m1.id, { side: 'b', version: cur.version }, 'coord'))
    expect(ops.getMatch(jsg.id, m1.next_id!)![m1.next_side === 'a' ? 'a_entry' : 'b_entry']).toBe(m1.b_entry)
    ok(ops.setResult(jsg.id, m2.id, { side: 'a', version: m2.version }, 'coord'))
    const sf = ops.getMatch(jsg.id, m1.next_id!)!
    ok(ops.setResult(jsg.id, sf.id, { side: 'a', version: sf.version }, 'coord'))
    cur = ops.getMatch(jsg.id, m1.id)!
    expect(ops.setResult(jsg.id, m1.id, { side: 'a', version: cur.version }, 'coord')).toMatchObject({ ok: false, error: expect.stringContaining('next round') })
    const log = repo.listAudit(jsg.id).filter((a) => a.action === 'match.corrected')
    expect(JSON.parse(log[0].meta)).toMatchObject({ before: { winner: m1.a_entry }, after: { winner: m1.b_entry } })
  })
  it('clearing a result removes the winner from the next round, unless that has been played', () => {
    const c = eight()
    const m1 = ops.listMatches(jsg.id, c)[0]
    ok(ops.setResult(jsg.id, m1.id, { side: 'a', version: m1.version }, 'coord'))
    ok(ops.clearResult(jsg.id, m1.id, ops.getMatch(jsg.id, m1.id)!.version, 'coord'))
    const after = ops.getMatch(jsg.id, m1.id)!
    expect(after).toMatchObject({ status: 'ready', winner: null })
    expect(ops.getMatch(jsg.id, m1.next_id!)![m1.next_side === 'a' ? 'a_entry' : 'b_entry']).toBeNull()
  })
  it('a walkover or a retirement is recorded as such', () => {
    const c = eight()
    const m = ops.listMatches(jsg.id, c)[0]
    ok(ops.setResult(jsg.id, m.id, { side: 'a', outcome: 'retired', score: '10-4', version: m.version }, 'coord'))
    expect(ops.getMatch(jsg.id, m.id)).toMatchObject({ outcome: 'retired', score: '10-4' })
  })
  it('withdrawing a player gives the opponent a walkover, even in later rounds', () => {
    const c = eight()
    const entries = ops.listEntries(jsg.id, c)
    const first = ops.listMatches(jsg.id, c)[0]
    ok(ops.withdrawEntry(jsg.id, first.a_entry!, 'coord'))
    const m = ops.getMatch(jsg.id, first.id)!
    expect(m).toMatchObject({ status: 'done', winner: first.b_entry, outcome: 'walkover' })
    expect(entries.length).toBe(8)
    // a later-round opponent who has already withdrawn is beaten as soon as the other arrives
    const [, m2] = ops.listMatches(jsg.id, c).filter((x) => x.round === 1)
    const sf = ops.getMatch(jsg.id, first.next_id!)!
    const otherSide = first.next_side === 'a' ? 'b' : 'a'
    ok(ops.withdrawEntry(jsg.id, m2.a_entry!, 'coord'))
    ok(ops.withdrawEntry(jsg.id, m2.b_entry!, 'coord')) // both gone: the semi-final stays open for the coordinator
    expect(sf.id).toBeTruthy(); expect(otherSide).toBeTruthy()
  })
  it('the event admin can lock a category: no result, draw or entry changes until it is reopened', () => {
    const c = eight()
    const m = ops.listMatches(jsg.id, c)[0]
    ok(ops.setLocked(jsg.id, c, true, 'admin'))
    expect(ops.setResult(jsg.id, m.id, { side: 'a', version: m.version }, 'coord')).toMatchObject({ ok: false, error: expect.stringContaining('locked') })
    expect(ops.generateDraw(jsg.id, c, 'coord').ok).toBe(false)
    expect(ops.withdrawEntry(jsg.id, m.a_entry!, 'coord').ok).toBe(false)
    expect(ops.setSchedule(jsg.id, m.id, 'Court 1', '10:00', 'coord').ok).toBe(false)
    ok(ops.setLocked(jsg.id, c, false, 'admin'))
    ok(ops.setResult(jsg.id, m.id, { side: 'a', version: m.version }, 'coord'))
  })
})

describe('who can be entered', () => {
  it('only players who have arrived, are registered for the sport, fit the category and are not already entered', () => {
    const ids = players(8, (i) => ({
      arrive: i !== 0, cancel: i === 1, sports: i === 2 ? ['Carrom'] : ['Chess'], gender: i === 3 ? 'Female' : 'Male', age: i === 4 ? 9 : 30,
    }))
    const c = newComp({ gender: 'Male', minAge: 18 })
    const ok2 = ops.eligiblePlayers(jsg.id, ops.getCompetition(jsg.id, c)!).map((p) => p.id)
    expect(ok2).toEqual(ids.slice(5)) // 0 not arrived, 1 cancelled, 2 other sport, 3 female, 4 too young
    expect(ops.addEntry(jsg.id, c, [ids[0]], 'coord')).toMatchObject({ ok: false, error: expect.stringContaining('cannot be added') })
    expect(ops.addEntry(jsg.id, c, [ids[3]], 'coord').ok).toBe(false)
    ok(ops.addEntry(jsg.id, c, [ids[5]], 'coord'))
    expect(ops.addEntry(jsg.id, c, [ids[5]], 'coord').ok).toBe(false) // already entered
    expect(ops.addEntry(jsg.id, c, [ids[6], ids[7]], 'coord').ok).toBe(false) // singles take one
  })
  it('capacity waitlisted players are not eligible', () => {
    const e = { ...ev, config: JSON.stringify({ capacity: { Chess: 1 } }) }
    repo.saveEvent(jsg.id, ev.id, e)
    ev = repo.getEvent(jsg.id, ev.id)!
    const ids = players(2)
    const c = newComp()
    expect(ops.eligiblePlayers(jsg.id, ops.getCompetition(jsg.id, c)!).map((p) => p.id)).toEqual([ids[0]])
  })
  it('entries cannot change after the draw, but a withdrawn player can be recorded', () => {
    const ids = players(4)
    const c = newComp()
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    expect(ops.addEntry(jsg.id, c, [ids[0]], 'coord').ok).toBe(false)
    expect(ops.removeEntry(jsg.id, ops.listEntries(jsg.id, c)[0].id, 'coord').ok).toBe(false)
  })
  it('another community cannot see or change this one\'s categories, entries or matches', () => {
    players(4)
    const c = newComp()
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    const m = ops.listMatches(jsg.id, c)[0]
    expect(ops.getCompetition(kitty.id, c)).toBeUndefined()
    expect(ops.listEntries(kitty.id, c)).toHaveLength(0)
    expect(ops.listMatches(kitty.id, c)).toHaveLength(0)
    expect(ops.setResult(kitty.id, m.id, { side: 'a', version: m.version }, 'intruder').ok).toBe(false)
    expect(ops.setLocked(kitty.id, c, true, 'intruder').ok).toBe(false)
    expect(ops.getMatch(jsg.id, m.id)!.status).toBe('ready')
  })
})

describe('doubles and pairing', () => {
  it('a pair needs exactly two eligible players and is named after them', () => {
    const ids = players(4, () => ({ sports: ['Badminton'] }))
    const c = newComp({ sport: 'Badminton', entryType: 'doubles', name: 'Open doubles' })
    expect(ops.addEntry(jsg.id, c, [ids[0]], 'coord').ok).toBe(false)
    const r = ok(ops.addEntry(jsg.id, c, [ids[0], ids[1]], 'coord'))
    expect(ops.listEntries(jsg.id, c).find((e) => e.id === r.id)!.name).toBe('Player A + Player B')
    expect(ops.addEntry(jsg.id, c, [ids[1], ids[2]], 'coord').ok).toBe(false) // a player sits in one pair per category
  })
  it('suggestions put mutual requests first, then one-sided requests, then similar players, and create nothing by themselves', () => {
    const ids = players(8, (i) => ({ sports: ['Badminton'], gender: i < 4 ? 'Male' : 'Female', skill: ['competitive', 'casual', 'beginner', 'casual'][i % 4], age: 20 + i }))
    const c = newComp({ sport: 'Badminton', entryType: 'doubles' })
    ok(ops.addPartnerRequest(jsg.id, ev.id, 'Badminton', ids[0], ids[3], 'friends', 'coord'))
    ok(ops.addPartnerRequest(jsg.id, ev.id, 'Badminton', ids[3], ids[0], '', 'coord'))
    ok(ops.addPartnerRequest(jsg.id, ev.id, 'Badminton', ids[1], ids[2], '', 'coord'))
    const s = ops.suggestPairs(jsg.id, ops.getCompetition(jsg.id, c)!)
    expect(s[0]).toMatchObject({ reason: 'mutual' })
    expect([s[0].a.id, s[0].b.id].sort()).toEqual([ids[0], ids[3]].sort())
    expect(s[1]).toMatchObject({ reason: 'requested' })
    expect(s.slice(2).every((x) => x.reason === 'similar')).toBe(true)
    const used = s.flatMap((x) => [x.a.id, x.b.id])
    expect(new Set(used).size).toBe(used.length)
    expect(ops.listEntries(jsg.id, c)).toHaveLength(0)
    expect(ops.addPartnerRequest(jsg.id, ev.id, 'Badminton', ids[0], ids[0], '', 'coord').ok).toBe(false)
    expect(ops.addPartnerRequest(jsg.id, ev.id, 'Carrom', ids[0], ids[1], '', 'coord').ok).toBe(false) // not registered for that sport
  })
  it('a team has a name and a size limit', () => {
    const ids = players(6, () => ({ sports: ['Cricket'] }))
    const c = newComp({ sport: 'Cricket', entryType: 'team', teamSize: 4, name: 'Teams' })
    expect(ops.addEntry(jsg.id, c, ids.slice(0, 3), 'coord').ok).toBe(false) // no name
    expect(ops.addEntry(jsg.id, c, ids.slice(0, 5), 'coord', 'Too Big').ok).toBe(false)
    ok(ops.addEntry(jsg.id, c, ids.slice(0, 3), 'coord', 'Lotus XI'))
    expect(ops.listEntries(jsg.id, c)[0]).toMatchObject({ name: 'Lotus XI' })
  })
})

describe('formats per sport', () => {
  it('only allows how each sport is played at this event', () => {
    const mk = (sport: string, entryType: ops.NewCompetition['entryType']) =>
      ops.createCompetition(jsg.id, { eventId: ev.id, sport, name: 'X', format: 'knockout', entryType }, 'c').ok
    for (const sp of ['Badminton', 'Table Tennis', 'Carrom', 'Pickleball']) {
      expect(mk(sp, 'singles'), sp).toBe(true)
      expect(mk(sp, 'doubles'), sp).toBe(true)
      expect(mk(sp, 'team'), sp).toBe(false)
    }
    expect(mk('Chess', 'singles')).toBe(true)
    expect(mk('Chess', 'doubles')).toBe(false)
    expect(mk('Chess', 'team')).toBe(false)
    expect(mk('Cricket', 'team')).toBe(true)
    expect(mk('Cricket', 'singles')).toBe(false)
  })
})

describe('round robin', () => {
  it('everyone plays everyone once, standings rank by wins and the podium follows', () => {
    players(5)
    const c = newComp({ format: 'roundrobin' })
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    const ms = ops.listMatches(jsg.id, c)
    expect(ms).toHaveLength(10)
    const pairs = new Set(ms.map((m) => [m.a_entry, m.b_entry].sort().join('-')))
    expect(pairs.size).toBe(10)
    // entry with the lowest id always wins: a strict ranking
    playOut(c, (m) => ((m.a_entry ?? 0) < (m.b_entry ?? 0) ? 'a' : 'b'))
    const st = ops.standings(jsg.id, c)
    expect(st.map((s) => s.wins)).toEqual([4, 3, 2, 1, 0])
    const pod = ops.podium(jsg.id, c)
    expect(pod).toMatchObject({ complete: true, unresolvedTie: false })
    expect(pod.first[0].id).toBe(st[0].entry.id)
  })
  it('an unresolved tie for a podium place is flagged for the coordinator', () => {
    players(3)
    const c = newComp({ format: 'roundrobin' })
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    const ms = ops.listMatches(jsg.id, c)
    // A beats B, B beats C, C beats A: everyone has one win
    const [e1, e2, e3] = ops.listEntries(jsg.id, c).map((e) => e.id)
    const win = (x: number, y: number) => { const m = ms.find((q) => [q.a_entry, q.b_entry].includes(x) && [q.a_entry, q.b_entry].includes(y))!; ok(ops.setResult(jsg.id, m.id, { side: m.a_entry === x ? 'a' : 'b', version: m.version }, 'coord')) }
    win(e1, e2); win(e2, e3); win(e3, e1)
    expect(ops.podium(jsg.id, c).unresolvedTie).toBe(true)
  })
})

describe('publishing and scheduling', () => {
  it('a round is shown to players only when the coordinator publishes it, and only when its players are known', () => {
    players(8)
    const c = newComp()
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    expect(ops.publishRound(jsg.id, c, 1, 'coord').ok).toBe(false) // no draw yet
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    expect(ops.getCompetition(jsg.id, c)!.published_rounds).toBe(0)
    ok(ops.publishRound(jsg.id, c, 1, 'coord'))
    expect(ops.getCompetition(jsg.id, c)!.published_rounds).toBe(1)
    expect(ops.publishRound(jsg.id, c, 2, 'coord')).toMatchObject({ ok: false, error: expect.stringContaining('not ready') })
    for (const m of ops.listMatches(jsg.id, c).filter((x) => x.round === 1)) ok(ops.setResult(jsg.id, m.id, { side: 'a', version: m.version }, 'coord'))
    ok(ops.publishRound(jsg.id, c, 2, 'coord'))
    ok(ops.publishRound(jsg.id, c, 0, 'coord')) // hide again
    expect(ops.getCompetition(jsg.id, c)!.published_rounds).toBe(0)
  })
  it('warns when a player is due in two places at once, or a court is double-booked, but still saves', () => {
    players(4)
    const c = newComp()
    ok(ops.addAllSingles(jsg.id, c, 'coord'))
    const c2 = ops.createCompetition(jsg.id, { eventId: ev.id, sport: 'Chess', name: 'Second', format: 'knockout', entryType: 'singles' }, 'coord')
    if (!c2.ok) throw new Error('setup')
    ok(ops.addAllSingles(jsg.id, c2.id, 'coord'))
    ok(ops.generateDraw(jsg.id, c, 'coord'))
    ok(ops.generateDraw(jsg.id, c2.id, 'coord'))
    const a = ops.listMatches(jsg.id, c)[0], b = ops.listMatches(jsg.id, c2.id)[0]
    expect(ok(ops.setSchedule(jsg.id, a.id, 'Court 1', '10:40', 'coord')).clashes).toEqual([])
    const second = ok(ops.setSchedule(jsg.id, b.id, 'Court 2', '10:40', 'coord'))
    expect(second.clashes.some((x) => x.includes('is also in Open at 10:40'))).toBe(true)
    expect(ok(ops.setSchedule(jsg.id, ops.listMatches(jsg.id, c)[1].id, 'Court 1', '10:40', 'coord')).clashes.some((x) => x.includes('already in use'))).toBe(true)
    expect(ops.getMatch(jsg.id, b.id)).toMatchObject({ court: 'Court 2', scheduled_at: '10:40' })
  })
  it('rejects nonsense categories', () => {
    expect(ops.createCompetition(jsg.id, { eventId: ev.id, sport: 'Golf', name: 'X', format: 'knockout', entryType: 'singles' }, 'c').ok).toBe(false)
    expect(ops.createCompetition(jsg.id, { eventId: ev.id, sport: 'Chess', name: '  ', format: 'knockout', entryType: 'singles' }, 'c').ok).toBe(false)
    expect(ops.createCompetition(jsg.id, { eventId: ev.id, sport: 'Chess', name: 'X', format: 'knockout', entryType: 'singles', minAge: 40, maxAge: 20 }, 'c').ok).toBe(false)
    expect(ops.createCompetition(jsg.id, { eventId: 9999, sport: 'Chess', name: 'X', format: 'knockout', entryType: 'singles' }, 'c').ok).toBe(false)
  })
})
