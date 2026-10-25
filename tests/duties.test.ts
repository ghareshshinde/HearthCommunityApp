import { beforeEach, describe, expect, it } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import { addDuty, clashes, listDuties, removeDuty } from '@/lib/duties'

let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let ev: repo.EventRow
beforeEach(() => { resetDbForTests(); jsg = repo.getCommunityBySlug('jsg')!; ev = repo.currentEvent(jsg.id)! })

describe('volunteer duties', () => {
  it('validates, groups by place and flags a person booked in two places at once', () => {
    expect(addDuty(jsg.id, ev.id, { volunteer: '', area: 'Gate 1' }, 'A').ok).toBe(false)
    expect(addDuty(jsg.id, ev.id, { volunteer: 'Ravi', area: '' }, 'A').ok).toBe(false)
    expect(addDuty(jsg.id, ev.id, { volunteer: 'Ravi', area: 'Gate 1', mobile: '123' }, 'A').ok).toBe(false)
    expect(addDuty(jsg.id, ev.id, { volunteer: 'Ravi', area: 'Gate 1', starts: '10:00', ends: '09:00' }, 'A').ok).toBe(false)
    expect(addDuty(jsg.id, ev.id, { volunteer: 'Ravi', area: 'Gate 1', starts: '25:00' }, 'A').ok).toBe(false)
    expect(addDuty(jsg.id, 9999, { volunteer: 'Ravi', area: 'Gate 1' }, 'A').ok).toBe(false)
    addDuty(jsg.id, ev.id, { volunteer: 'Ravi', area: 'Gate 1', mobile: '+91 98765 43210', starts: '08:00', ends: '10:00' }, 'A')
    addDuty(jsg.id, ev.id, { volunteer: 'ravi', area: 'Court 2', starts: '09:00', ends: '11:00' }, 'A')
    addDuty(jsg.id, ev.id, { volunteer: 'Meera', area: 'Court 2', starts: '11:00', ends: '12:00' }, 'A')
    const list = listDuties(jsg.id, ev.id)
    expect(list.map((d) => d.area)).toEqual(['Court 2', 'Court 2', 'Gate 1'])
    expect(list.find((d) => d.volunteer === 'Ravi')!.mobile).toBe('9876543210')
    expect([...clashes(list)].length).toBe(2)
  })
  it('removes a duty only in its own community', () => {
    const r = addDuty(jsg.id, ev.id, { volunteer: 'Ravi', area: 'Gate 1' }, 'A')
    if (!r.ok) throw new Error('add')
    expect(removeDuty(jsg.id + 1, r.id, 'x')).toBe(false)
    expect(removeDuty(jsg.id, r.id, 'A')).toBe(true)
    expect(listDuties(jsg.id, ev.id)).toEqual([])
  })
})
