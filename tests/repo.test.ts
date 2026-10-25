import { beforeEach, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import { blankRow, type ParticipantInput } from '@/lib/registration/rules'
import { buildWorkbook } from '@/lib/export'
import { checkSession, makeSession, verifyPassword, hashPassword } from '@/lib/auth'

const contact = { registrantName: 'Asha Shah', registrantMobile: '9876543210', registrantEmail: 'asha@example.test', emergencyName: 'Raj', emergencyMobile: '9123456780', waiver: true as const }
const person = (o: Partial<ParticipantInput> = {}): ParticipantInput => ({ ...blankRow(), name: 'Asha Shah', age: '34', gender: 'Female', mobile: '9876543210', sports: ['Chess'], skill: 'casual', ...o })

let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let kitty: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let ev: repo.EventRow

beforeEach(() => {
  resetDbForTests()
  jsg = repo.getCommunityBySlug('jsg')!
  kitty = repo.getCommunityBySlug('kitty-demo')!
  ev = repo.listEvents(jsg.id)[0]
})

describe('registration lifecycle', () => {
  it('registers a family of 4 plus 2 guests, marked member or guest, with per-person timestamps', () => {
    const rows = [person(), person({ name: 'Raj', gender: 'Male' }), person({ name: 'Kid', age: '9', mobile: '', sports: ['Carrom'] }), person({ name: 'Kid2', age: '7', mobile: '' }),
      person({ name: 'Guest A', kind: 'guest' }), person({ name: 'Guest B', kind: 'guest', sports: ['Cricket', 'Badminton'] })]
    const r = repo.createRegistration(ev, contact, rows)
    expect(r.ok).toBe(true)
    const s = repo.stats(repo.listRows(jsg.id, ev.id))
    expect(s).toMatchObject({ registrations: 1, participants: 6, members: 4, guests: 2 })
    expect(repo.listRows(jsg.id, ev.id).every((p) => p.registered_at)).toBe(true)
  })
  it('rejects invalid rows with per-row errors and stores nothing', () => {
    const r = repo.createRegistration(ev, contact, [person(), person({ name: '', sports: [] })])
    expect(r).toMatchObject({ ok: false, rowErrors: { 1: { name: 'Required', sports: 'Pick at least one sport' } } })
    expect(repo.listRows(jsg.id, ev.id)).toHaveLength(0)
  })
  it('requires the waiver and emergency contact', () => {
    const r = repo.createRegistration(ev, { ...contact, waiver: false as unknown as true, emergencyName: '' }, [person()])
    expect(r.ok).toBe(false)
  })
  it('blocks registration after the cut-off and for drafts', () => {
    const past = new Date(Date.now() + 40 * 86400_000)
    expect(repo.createRegistration(ev, contact, [person()], past)).toMatchObject({ ok: false })
    expect(repo.createRegistration({ ...ev, status: 'draft' }, contact, [person()])).toMatchObject({ ok: false })
  })
  it('edits replace rows until cut-off, and cancel keeps the audit trail', () => {
    const r = repo.createRegistration(ev, contact, [person(), person({ name: 'Raj', gender: 'Male' })])
    if (!r.ok) throw new Error('setup')
    const reg = repo.getRegistrationByToken(r.token)!
    expect(repo.updateRegistration(ev, reg, contact, [person({ name: 'Only One' })]).ok).toBe(true)
    expect(repo.listRows(jsg.id, ev.id).map((p) => p.name)).toEqual(['Only One'])
    expect(repo.cancelRegistration(ev, reg, 'public')).toBe(true)
    expect(repo.stats(repo.listRows(jsg.id, ev.id)).participants).toBe(0)
    expect(repo.listAudit(jsg.id).map((a) => a.action)).toEqual(expect.arrayContaining(['registration.created', 'registration.edited', 'registration.cancelled']))
  })
})

describe('admin workspace', () => {
  it('filters combine, and inline edits are validated and audited with before and after', () => {
    repo.createRegistration(ev, contact, [person(), person({ name: 'Guest', kind: 'guest', gender: 'Male', diet: 'Jain', sports: ['Cricket'] })])
    const rows = repo.listRows(jsg.id, ev.id)
    expect(repo.filterRows(rows, { kind: 'guest', sport: 'Cricket' })).toHaveLength(1)
    expect(repo.filterRows(rows, { kind: 'guest', sport: 'Chess' })).toHaveLength(0)
    expect(repo.filterRows(rows, { q: 'asha' })).toHaveLength(2) // matches the registrant too
    expect(repo.filterRows(rows, { q: 'guest' })).toHaveLength(1)
    const guest = rows.find((r) => r.name === 'Guest')!
    expect(repo.adminEditParticipant(jsg.id, guest.id, 'age', '500', 'admin')).toMatchObject({ ok: false })
    expect(repo.adminEditParticipant(jsg.id, guest.id, 'age', '41', 'admin')).toMatchObject({ ok: true })
    const entry = repo.listAudit(jsg.id).find((a) => a.action === 'participant.edited')!
    expect(JSON.parse(entry.meta)).toMatchObject({ field: 'age', before: '34', after: '41' })
  })
  it('bulk verify and confirm', () => {
    repo.createRegistration(ev, contact, [person(), person({ name: 'B' })])
    const ids = repo.listRows(jsg.id, ev.id).map((r) => r.id)
    repo.bulkAction(jsg.id, ids, 'verify', 'admin')
    repo.bulkAction(jsg.id, ids, 'confirm', 'admin')
    const s = repo.stats(repo.listRows(jsg.id, ev.id))
    expect(s.verified).toBe(2)
    expect(s.pending).toBe(0)
  })
  it('exports Excel with one tab per sport and Hindi/Gujarati names intact', async () => {
    repo.createRegistration(ev, contact, [person({ name: 'આશા શાહ', sports: ['Chess', 'Carrom'] }), person({ name: 'राज शर्मा', gender: 'Male', sports: ['Cricket'] })])
    const buf = await buildWorkbook(repo.listRows(jsg.id, ev.id), JSON.parse(ev.sports))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['All participants', ...JSON.parse(ev.sports)])
    expect(wb.getWorksheet('Chess')!.getRow(2).getCell(6).value).toBe('આશા શાહ')
    expect(wb.getWorksheet('Cricket')!.getRow(2).getCell(6).value).toBe('राज शर्मा')
    expect(wb.getWorksheet('All participants')!.rowCount).toBe(3)
  })
})

describe('community isolation', () => {
  it('another community cannot see, edit or bulk-change this community\'s data', () => {
    const r = repo.createRegistration(ev, contact, [person()])
    if (!r.ok) throw new Error('setup')
    const p = repo.listRows(jsg.id, ev.id)[0]
    expect(repo.listRows(kitty.id, ev.id)).toHaveLength(0)
    expect(repo.getEvent(kitty.id, ev.id)).toBeUndefined()
    expect(repo.adminEditParticipant(kitty.id, p.id, 'name', 'Hacked', 'admin')).toMatchObject({ ok: false })
    expect(repo.bulkAction(kitty.id, [p.id], 'cancel', 'admin')).toBe(1) // runs, but matches no rows
    expect(repo.listRows(jsg.id, ev.id)[0]).toMatchObject({ name: 'Asha Shah', reg_status: 'pending' })
    expect(repo.listAudit(kitty.id).some((a) => a.action === 'participant.edited')).toBe(false)
    expect(repo.listOutbox(kitty.id)).toHaveLength(0)
  })
})

describe('admin auth', () => {
  it('verifies passwords and scopes sessions to one community', () => {
    expect(verifyPassword('pw-for-tests', jsg.admin_hash)).toBe(true)
    expect(verifyPassword('nope', jsg.admin_hash)).toBe(false)
    expect(verifyPassword('x', hashPassword('x'))).toBe(true)
    const s = makeSession('jsg')
    expect(checkSession(s, 'jsg')).toBe(true)
    expect(checkSession(s, 'kitty-demo')).toBe(false)
    expect(checkSession(s + 'x', 'jsg')).toBe(false)
    expect(checkSession(makeSession('jsg', 1, Date.now() - 2 * 3600_000), 'jsg')).toBe(false)
    expect(checkSession(undefined, 'jsg')).toBe(false)
  })
})
