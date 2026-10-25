import { beforeEach, describe, expect, it } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import * as staff from '@/lib/staff'
import { makeTicket, parseTicket, ticketFromScan } from '@/lib/ticket'
import { blankRow, type ParticipantInput } from '@/lib/registration/rules'

const contact = { registrantName: 'Asha Shah', registrantMobile: '9876543210', registrantEmail: '', emergencyName: 'Raj', emergencyMobile: '9123456780', waiver: true as const }
const person = (o: Partial<ParticipantInput> = {}): ParticipantInput => ({ ...blankRow(), name: 'Asha Shah', age: '34', gender: 'Female', mobile: '9876543210', sports: ['Chess'], skill: 'casual', ...o })

let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let kitty: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let ev: repo.EventRow
const withSpot = (spot: object) => ({ ...ev, config: JSON.stringify({ spot }) })

function register(names: string[]) {
  const r = repo.createRegistration(ev, contact, names.map((n) => person({ name: n })))
  if (!r.ok) throw new Error('setup')
  return repo.getRegistrationByToken(r.token)!
}

beforeEach(() => {
  resetDbForTests()
  jsg = repo.getCommunityBySlug('jsg')!
  kitty = repo.getCommunityBySlug('kitty-demo')!
  ev = repo.listEvents(jsg.id)[0]
})

describe('tickets', () => {
  it('signs a ticket per registration and rejects tampering', () => {
    const t = makeTicket(7)
    expect(parseTicket(t)).toBe(7)
    expect(parseTicket(t.replace('t7', 't8'))).toBeNull()
    expect(parseTicket('t7.' + '0'.repeat(20))).toBeNull()
    expect(parseTicket('garbage')).toBeNull()
  })
  it('reads the ticket out of a scanned URL or a bare code', () => {
    const t = makeTicket(3)
    expect(ticketFromScan(`https://example.test/c/jsg/t/${t}`)).toBe(t)
    expect(ticketFromScan(` ${t} `)).toBe(t)
  })
})

describe('check-in without photos', () => {
  it('admits ticked people, never twice, and reports who is already in', () => {
    const reg = register(['Asha Shah', 'Raj Shah', 'Mira Shah'])
    const people = repo.listParticipantsOfRegistration(jsg.id, reg.id)
    const first = repo.checkIn(jsg.id, [people[0].id, people[1].id], 'Gate volunteer 1', 'Main gate')
    expect(first.admitted).toHaveLength(2)
    const again = repo.checkIn(jsg.id, people.map((p) => p.id), 'Gate volunteer 2', 'Side gate')
    expect(again.admitted).toEqual([people[2].id])
    expect(again.already.map((a) => a.by)).toEqual(['Gate volunteer 1', 'Gate volunteer 1'])
    const rows = repo.listRows(jsg.id, ev.id)
    expect(rows.find((r) => r.id === people[2].id)).toMatchObject({ checked_in_by: 'Gate volunteer 2', checked_in_gate: 'Side gate' })
    expect(repo.stats(rows).arrived).toBe(3)
  })
  it('can be undone, and everything is in the audit log', () => {
    const reg = register(['Asha Shah'])
    const [p] = repo.listParticipantsOfRegistration(jsg.id, reg.id)
    repo.checkIn(jsg.id, [p.id], 'V1', 'Main gate')
    expect(repo.undoCheckIn(jsg.id, p.id, 'V1')).toBe(true)
    expect(repo.undoCheckIn(jsg.id, p.id, 'V1')).toBe(false)
    expect(repo.listAudit(jsg.id).map((a) => a.action)).toEqual(expect.arrayContaining(['checkin', 'checkin.undone']))
  })
  it('finds a family by reference, name or mobile', () => {
    const reg = register(['Asha Shah', 'Raj Shah'])
    expect(repo.findRegistrations(jsg.id, ev.id, reg.ref)).toHaveLength(1)
    expect(repo.findRegistrations(jsg.id, ev.id, 'raj')).toHaveLength(1)
    expect(repo.findRegistrations(jsg.id, ev.id, '98765')).toHaveLength(1)
    expect(repo.findRegistrations(jsg.id, ev.id, 'zzzz')).toHaveLength(0)
    expect(repo.findRegistrations(jsg.id, ev.id, 'a')).toHaveLength(0) // too short to search
  })
  it('another community cannot admit or search this community\'s people', () => {
    const reg = register(['Asha Shah'])
    const [p] = repo.listParticipantsOfRegistration(jsg.id, reg.id)
    expect(repo.checkIn(kitty.id, [p.id], 'Intruder', 'x').admitted).toHaveLength(0)
    expect(repo.findRegistrations(kitty.id, ev.id, reg.ref)).toHaveLength(0)
    expect(repo.getRegistrationById(kitty.id, reg.id)).toBeUndefined()
    expect(repo.listRows(jsg.id, ev.id)[0].checked_in_at).toBeNull()
  })
})

describe('walk-ins', () => {
  const walk = (over: Partial<repo.WalkInInput> = {}) => repo.addWalkIn(withSpot({ open: true, cap: 0 }), { person: person({ name: 'Walk In' }), waiver: true, by: 'Desk 1', gate: 'Spot desk', contact: { name: 'Walk In', mobile: '9000000001', emergencyName: 'Em', emergencyMobile: '9000000002' }, ...over })
  it('adds a walk-in to an existing family and admits them at once', () => {
    const reg = register(['Asha Shah'])
    const r = walk({ registrationId: reg.id, contact: undefined })
    expect(r.ok).toBe(true)
    const people = repo.listParticipantsOfRegistration(jsg.id, reg.id)
    expect(people).toHaveLength(2)
    expect(people[1]).toMatchObject({ source: 'spot', checked_in_by: 'Desk 1', checked_in_gate: 'Spot desk' })
    expect(people[1].checked_in_at).toBeTruthy()
    expect(repo.stats(repo.listRows(jsg.id, ev.id)).walkIns).toBe(1)
  })
  it('creates a separate confirmed entry when they are not with a family', () => {
    const r = walk()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const reg = repo.getRegistrationById(jsg.id, r.registrationId)!
    expect(reg).toMatchObject({ source: 'spot', status: 'confirmed', registrant_mobile: '9000000001' })
    expect(repo.listRows(jsg.id, ev.id)[0].checked_in_at).toBeTruthy()
  })
  it('respects the desk switch, the walk-in limit, the waiver and validation', () => {
    expect(repo.addWalkIn(ev, { person: person(), waiver: true, by: 'D', gate: 'g', contact: { name: 'A', mobile: '9000000001', emergencyName: 'B', emergencyMobile: '9000000002' } })).toMatchObject({ ok: false, error: 'Spot registration is closed' })
    const capped = withSpot({ open: true, cap: 1 })
    const mk = (n: string) => repo.addWalkIn(capped, { person: person({ name: n }), waiver: true, by: 'D', gate: 'g', contact: { name: n, mobile: '9000000001', emergencyName: 'B', emergencyMobile: '9000000002' } })
    expect(mk('First Walker').ok).toBe(true)
    expect(mk('Second Walker')).toMatchObject({ ok: false })
    expect(walk({ waiver: false })).toMatchObject({ ok: false })
    expect(walk({ person: person({ name: '' }) })).toMatchObject({ ok: false, rowErrors: { name: 'Required' } })
    expect(walk({ contact: { name: '', mobile: '1', emergencyName: '', emergencyMobile: '' } })).toMatchObject({ ok: false })
  })
  it('refuses to add to a cancelled registration or one from another community', () => {
    const reg = register(['Asha Shah'])
    repo.cancelRegistration(ev, reg, 'admin')
    expect(walk({ registrationId: reg.id, contact: undefined })).toMatchObject({ ok: false })
    const otherEv = repo.listEvents(jsg.id)[0]
    expect(repo.addWalkIn({ ...otherEv, community_id: kitty.id, config: JSON.stringify({ spot: { open: true, cap: 0 } }) }, { person: person(), registrationId: reg.id, waiver: true, by: 'D', gate: 'g' }).ok).toBe(false)
  })
})

describe('staff logins', () => {
  const expiry = () => staff.inviteExpiry(null)
  it('creates a sport admin with a password and an expiring invite link', () => {
    const c = staff.createStaff(jsg.id, { name: 'Chess admin', role: 'sport', sport: 'Chess' }, expiry())
    expect(c.username).toBe('chess-1')
    expect(staff.verifyStaffLogin(jsg.id, 'chess-1', c.password)?.id).toBe(c.staff.id)
    expect(staff.verifyStaffLogin(jsg.id, 'chess-1', 'wrong')).toBeNull()
    expect(staff.staffByInvite(jsg.id, c.inviteToken)?.id).toBe(c.staff.id)
    expect(staff.staffByInvite(kitty.id, c.inviteToken)).toBeNull() // another community's invite is useless here
    expect(staff.verifyStaffLogin(kitty.id, 'chess-1', c.password)).toBeNull()
    expect(staff.createStaff(jsg.id, { name: 'Chess admin 2', role: 'sport', sport: 'Chess' }, expiry()).username).toBe('chess-2')
  })
  it('expires invites, and revoking or resetting stops old access immediately', () => {
    const c = staff.createStaff(jsg.id, { name: 'G', role: 'gate' }, new Date(Date.now() + 3600_000).toISOString())
    expect(staff.staffByInvite(jsg.id, c.inviteToken, new Date(Date.now() + 2 * 3600_000))).toBeNull()
    const reset = staff.resetStaffCredentials(jsg.id, c.staff.id, expiry())!
    expect(staff.verifyStaffLogin(jsg.id, c.username, c.password)).toBeNull()
    expect(staff.staffByInvite(jsg.id, c.inviteToken)).toBeNull()
    expect(staff.verifyStaffLogin(jsg.id, c.username, reset.password)).not.toBeNull()
    staff.setStaffActive(jsg.id, c.staff.id, false)
    expect(staff.verifyStaffLogin(jsg.id, c.username, reset.password)).toBeNull()
    expect(staff.staffByInvite(jsg.id, reset.inviteToken)).toBeNull()
  })
  it('standard set gives two admins per sport, two common admins and two gate logins, and tops up only what is missing', () => {
    const sports = JSON.parse(ev.sports) as string[]
    staff.createStaff(jsg.id, { name: 'Chess admin', role: 'sport', sport: 'Chess' }, expiry())
    const made = staff.seedStandardStaff(jsg.id, sports, expiry())
    expect(made).toHaveLength(sports.length * 2 - 1 + 2 + 2)
    const cov = staff.coverage(jsg.id, sports)
    expect(Object.values(cov.perSport).every((n) => n === 2)).toBe(true)
    expect(cov.common).toBe(2)
    expect(cov.gate).toBe(2)
    expect(staff.seedStandardStaff(jsg.id, sports, expiry())).toHaveLength(0)
  })
  it('session cookies are tied to one community, one person and an expiry', () => {
    const s = staff.makeStaffSession('jsg', 5)
    expect(staff.readStaffSession(s, 'jsg')).toBe(5)
    expect(staff.readStaffSession(s, 'kitty-demo')).toBeNull()
    expect(staff.readStaffSession(s.replace('.5.', '.6.'), 'jsg')).toBeNull()
    expect(staff.readStaffSession(staff.makeStaffSession('jsg', 5, 1, Date.now() - 2 * 3600_000), 'jsg')).toBeNull()
  })
})

describe('sport roster', () => {
  it('shows names, ages and arrival for one sport and never contact details', () => {
    register(['Asha Shah', 'Raj Shah'])
    const rows = repo.listRows(jsg.id, ev.id)
    repo.checkIn(jsg.id, [rows[0].id], 'V', 'g')
    const roster = repo.sportRoster(jsg.id, ev.id, 'Chess')
    expect(roster).toHaveLength(2)
    expect(roster.find((r) => r.id === rows[0].id)?.checkedInAt).toBeTruthy()
    expect(JSON.stringify(roster)).not.toMatch(/9876543210|mobile|email|emergency/i)
    expect(repo.sportRoster(jsg.id, ev.id, 'Cricket')).toHaveLength(0)
    expect(repo.sportRoster(kitty.id, ev.id, 'Chess')).toHaveLength(0)
  })
})
