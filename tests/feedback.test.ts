import { beforeEach, describe, expect, it } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import { blankRow } from '@/lib/registration/rules'
import { feedbackOpen, feedbackSummary, getFeedback, queueFeedbackRequests, saveFeedback, setFeedbackMode } from '@/lib/feedback'

const contact = { registrantName: 'Reg Person', registrantMobile: '9876543210', registrantEmail: 'reg@example.test', emergencyName: 'Em Contact', emergencyMobile: '9123456780', waiver: true as const }
let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let ev: repo.EventRow
const reg = (email = 'reg@example.test', key = Math.random().toString()) => {
  const r = repo.createRegistration(ev, { ...contact, registrantEmail: email, submissionKey: key + 'xxxxxxxx' }, [{ ...blankRow(), name: 'Asha Shah', age: '34', gender: 'Female', mobile: '9876543210', sports: ['Chess'], skill: 'casual' }])
  if (!r.ok) throw new Error(JSON.stringify(r))
  return repo.getRegistrationByToken(r.token)!
}
const good = { overall: 5, organisation: 4, sports_rating: 3, favourite: 'Chess', would_return: 'yes', went_well: 'Great games', improve: 'More shade' }

beforeEach(() => {
  resetDbForTests()
  jsg = repo.getCommunityBySlug('jsg')!
  ev = repo.currentEvent(jsg.id)!
})

describe('feedback', () => {
  it('opens by itself when the event starts, or when an admin forces it', () => {
    const before = new Date('2000-01-01'), after = new Date('2100-01-01')
    const e = { ...ev, starts_at: '2026-06-01T04:00:00Z', config: '{}' }
    expect(feedbackOpen(e, before)).toBe(false)
    expect(feedbackOpen(e, after)).toBe(true)
    expect(feedbackOpen({ ...e, config: '{"feedback":"open"}' }, before)).toBe(true)
    expect(feedbackOpen({ ...e, config: '{"feedback":"closed"}' }, after)).toBe(false)
  })
  it('needs all three ratings, keeps one answer per registration and lets it be changed', () => {
    setFeedbackMode(ev, 'open', 'Admin'); ev = repo.getEvent(jsg.id, ev.id)!
    const r = reg()
    expect(saveFeedback(ev, r, { ...good, organisation: 0 }).ok).toBe(false)
    expect(saveFeedback(ev, r, { ...good, overall: 6 }).ok).toBe(false)
    expect(saveFeedback(ev, r, good).ok).toBe(true)
    expect(saveFeedback(ev, r, { ...good, overall: 2, favourite: 'Golf', would_return: 'x' }).ok).toBe(true)
    const f = getFeedback(jsg.id, r.id)!
    expect(f).toMatchObject({ overall: 2, favourite: '', would_return: '' })
    expect(feedbackSummary(jsg.id, ev.id)).toMatchObject({ responses: 1, registrations: 1, overall: 2 })
  })
  it('refuses when closed, when cancelled, and for a registration from another community', () => {
    const r = reg()
    setFeedbackMode(ev, 'closed', 'Admin'); ev = repo.getEvent(jsg.id, ev.id)!
    expect(saveFeedback(ev, r, good).ok).toBe(false)
    setFeedbackMode(ev, 'open', 'Admin'); ev = repo.getEvent(jsg.id, ev.id)!
    repo.cancelRegistration(ev, r, 'user')
    expect(saveFeedback(ev, repo.getRegistrationByToken(r.token)!, good).ok).toBe(false)
    expect(saveFeedback(ev, { ...reg(), community_id: 999 }, good).ok).toBe(false) // never crosses communities
  })
  it('emails only people who have an address and have not answered yet', () => {
    setFeedbackMode(ev, 'open', 'Admin'); ev = repo.getEvent(jsg.id, ev.id)!
    const a = reg('a@example.test'), b = reg('b@example.test')
    expect(saveFeedback(ev, a, good).ok).toBe(true)
    const before = repo.listOutbox(jsg.id).length
    expect(queueFeedbackRequests(ev, 'jsg', 'Admin')).toBe(1)
    const sent = repo.listOutbox(jsg.id).slice(0, repo.listOutbox(jsg.id).length - before)
    expect(sent.map((m) => m.to_email)).toEqual(['b@example.test'])
    expect(sent[0].body).toContain(`/c/jsg/r/${b.token}/feedback`)
  })
})
