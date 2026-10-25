import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'
process.env.APP_URL = 'https://hearth.example.test'

const sent: { to: string; subject: string; text: string }[] = []
let failNext = 0
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string; subject: string; text: string }) => {
        if (failNext > 0) { failNext--; throw new Error('smtp down') }
        sent.push(m)
      },
    }),
  },
}))

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import { sendQueued } from '@/lib/mail'
import { allow } from '@/lib/ratelimit'
import { blankRow, normalizeMobile } from '@/lib/registration/rules'

const good = { ...blankRow(), name: 'Asha Shah', age: '34', gender: 'Female', mobile: '9876543210', sports: ['Chess'], skill: 'casual' }
const contact = { registrantName: 'Asha Shah', registrantMobile: '9876543210', registrantEmail: 'asha@example.test', emergencyName: 'Raj', emergencyMobile: '9123456780', waiver: true as const }

let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let ev: repo.EventRow
beforeEach(() => {
  resetDbForTests()
  sent.length = 0
  delete process.env.SMTP_URL
  delete process.env.NOTIFY_COPY_TO
  jsg = repo.getCommunityBySlug('jsg')!
  ev = repo.listEvents(jsg.id)[0]
})

describe('malformed requests never crash the server', () => {
  const bad: [string, unknown, unknown][] = [
    ['sports is a string', [{ ...good, sports: 'Chess' }], contact],
    ['sports missing key', [{ ...good, sports: undefined }], contact], // missing arrays default to empty and fail validation
    ['row is null', [null], contact],
    ['rows is not an array', 'abc', contact],
    ['rows is an object', { 0: good }, contact],
    ['name is a number', [{ ...good, name: 12345 }], contact],
    ['age is an object', [{ ...good, age: {} }], contact],
    ['contact is undefined', [good], undefined],
    ['contact is a string', [good], 'x'],
    ['contact has null fields', [good], { ...contact, registrantName: null }],
    ['nested junk', [{ ...good, sports: [{ a: 1 }] }], contact],
    ['200+ rows', Array.from({ length: 250 }, () => good), contact],
    ['huge strings', [{ ...good, accessibility: 'x'.repeat(200000) }], contact],
  ]
  for (const [name, rows, c] of bad) {
    it(name, () => {
      let r: ReturnType<typeof repo.createRegistration> | undefined
      expect(() => { r = repo.createRegistration(ev, c as never, rows as never) }).not.toThrow()
      expect(r!.ok).toBe(false)
      expect(repo.listRows(jsg.id, ev.id)).toHaveLength(0)
    })
  }
  it('an edit with malformed rows is also refused cleanly', () => {
    const ok = repo.createRegistration(ev, contact, [good])
    if (!ok.ok) throw new Error('setup')
    const reg = repo.getRegistrationByToken(ok.token)!
    expect(repo.updateRegistration(ev, reg, contact, [{ ...good, sports: 'Chess' }] as never).ok).toBe(false)
    expect(repo.listRows(jsg.id, ev.id)).toHaveLength(1)
  })
})

describe('registration integrity', () => {
  it('counts a repeated sport once, so capacity is not double used', () => {
    const e = { ...ev, config: JSON.stringify({ capacity: { Chess: 2 } }) }
    repo.createRegistration(e, contact, [{ ...good, sports: ['Chess', 'Chess', 'Chess'] }])
    expect(repo.listRows(jsg.id, ev.id)[0].sportList).toEqual(['Chess'])
    expect(repo.seatsLeft(e).Chess).toBe(1)
  })
  it('the same submission sent twice makes one registration', () => {
    const c = { ...contact, submissionKey: 'abcdef12-key-1' }
    const a = repo.createRegistration(ev, c, [good])
    const b = repo.createRegistration(ev, c, [good])
    expect(a.ok && b.ok && a.ref === b.ref && a.token === b.token).toBe(true)
    expect(repo.listRows(jsg.id, ev.id)).toHaveLength(1)
    // a different key is a different registration
    expect(repo.createRegistration(ev, { ...contact, submissionKey: 'abcdef12-key-2' }, [good]).ok).toBe(true)
    expect(repo.listRows(jsg.id, ev.id)).toHaveLength(2)
  })
  it('a failed attempt does not burn the key: the corrected retry is accepted', () => {
    const c = { ...contact, submissionKey: 'abcdef12-key-3' }
    expect(repo.createRegistration(ev, c, [{ ...good, name: '' }]).ok).toBe(false)
    expect(repo.createRegistration(ev, c, [good]).ok).toBe(true)
  })
  it('the same key in another community is independent', () => {
    const kitty = repo.getCommunityBySlug('kitty-demo')!
    const c = { ...contact, submissionKey: 'abcdef12-key-4' }
    expect(repo.createRegistration(ev, c, [good]).ok).toBe(true)
    expect(repo.listRows(kitty.id, ev.id)).toHaveLength(0)
  })
  it('finds a registration again by reference and mobile, and only then', () => {
    const r = repo.createRegistration(ev, contact, [good])
    if (!r.ok) throw new Error('setup')
    expect(repo.findTokenByRefAndMobile(jsg.id, r.ref.toLowerCase(), normalizeMobile('+91 98765 43210'))).toBe(r.token)
    expect(repo.findTokenByRefAndMobile(jsg.id, r.ref, '9000000000')).toBeNull()
    expect(repo.findTokenByRefAndMobile(jsg.id, 'HR-00000000', '9876543210')).toBeNull()
    const kitty = repo.getCommunityBySlug('kitty-demo')!
    expect(repo.findTokenByRefAndMobile(kitty.id, r.ref, '9876543210')).toBeNull()
  })
})

describe('email', () => {
  it('queues a confirmation with an absolute link plus a copy for the community address, and sends them', async () => {
    process.env.NOTIFY_COPY_TO = 'jsghyd@example.test'
    const r = repo.createRegistration(ev, contact, [good])
    if (!r.ok) throw new Error('setup')
    expect(repo.listOutbox(jsg.id).map((m) => m.to_email).sort()).toEqual(['asha@example.test', 'jsghyd@example.test'])
    expect(await sendQueued()).toEqual({ sent: 0, failed: 0 }) // no SMTP_URL: stays queued
    process.env.SMTP_URL = 'smtp://user:pass@smtp.example.test:587'
    expect(await sendQueued()).toEqual({ sent: 2, failed: 0 })
    const mine = sent.find((m) => m.to === 'asha@example.test')!
    expect(mine.text).toContain(`https://hearth.example.test/c/jsg/r/${r.token}`)
    expect(mine.subject).toContain(r.ref)
    expect(repo.listOutbox(jsg.id).every((m) => m.sent === 1)).toBe(true)
    expect(await sendQueued()).toEqual({ sent: 0, failed: 0 }) // never sent twice
  })
  it('a failing mail server leaves the email queued and does not touch the registration', async () => {
    process.env.SMTP_URL = 'smtp://x'
    repo.createRegistration(ev, contact, [good])
    failNext = 1
    expect(await sendQueued()).toEqual({ sent: 0, failed: 1 })
    const [m] = repo.listOutbox(jsg.id)
    expect(m).toMatchObject({ sent: 0, attempts: 1, error: 'smtp down' })
    expect(await sendQueued()).toEqual({ sent: 1, failed: 0 })
    expect(repo.listRows(jsg.id, ev.id)).toHaveLength(1)
  })
  it('registrants without an email get no mail, but the community copy still goes out', () => {
    process.env.NOTIFY_COPY_TO = 'a@x.test, b@x.test'
    repo.createRegistration(ev, { ...contact, registrantEmail: '' }, [good])
    expect(repo.listOutbox(jsg.id).map((m) => m.to_email).sort()).toEqual(['a@x.test', 'b@x.test'])
  })
})

describe('rate limiting', () => {
  it('allows a burst up to the limit, then refuses until the window passes', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) expect(allow('k', 3, 1000, t + i)).toBe(true)
    expect(allow('k', 3, 1000, t + 10)).toBe(false)
    expect(allow('other', 3, 1000, t + 10)).toBe(true)
    expect(allow('k', 3, 1000, t + 2000)).toBe(true)
  })
})

describe('email me my links', () => {
  it('sends every live registration made with that address its edit and ticket links, and nothing for an unknown address', async () => {
    const a = repo.createRegistration(ev, contact, [good])
    const b = repo.createRegistration(ev, { ...contact, registrantName: 'Second Time', submissionKey: 'second-key-1' }, [{ ...good, name: 'Second Time' }])
    const cancelled = repo.createRegistration(ev, { ...contact, submissionKey: 'second-key-2' }, [good])
    if (!a.ok || !b.ok || !cancelled.ok) throw new Error('setup')
    repo.cancelRegistration(ev, repo.getRegistrationByToken(cancelled.token)!, 'public')
    repo.listOutbox(jsg.id) // confirmations queued so far
    const before = repo.listOutbox(jsg.id).length
    expect(repo.queueLinksEmail(jsg.id, 'ASHA@Example.test ')).toBe(2)
    expect(repo.queueLinksEmail(jsg.id, 'nobody@example.test')).toBe(0)
    const rows = repo.listOutbox(jsg.id)
    expect(rows.length).toBe(before + 1)
    process.env.SMTP_URL = 'smtp://x'
    await sendQueued(50)
    const mail = sent.find((m) => m.subject === 'Your registration links')!
    expect(mail.to).toBe('asha@example.test')
    expect(mail.text).toContain(`/c/jsg/r/${a.token}`)
    expect(mail.text).toContain(`/c/jsg/r/${b.token}`)
    expect(mail.text).toMatch(/\/c\/jsg\/t\/t\d+\.[0-9a-f]{20}/)
    expect(mail.text).not.toContain(cancelled.token)
  })
  it('never mixes communities', () => {
    repo.createRegistration(ev, contact, [good])
    const kitty = repo.getCommunityBySlug('kitty-demo')!
    expect(repo.queueLinksEmail(kitty.id, 'asha@example.test')).toBe(0)
  })
})
