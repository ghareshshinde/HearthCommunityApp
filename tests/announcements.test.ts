import { beforeEach, describe, expect, it } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { getDb, resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import { liveAnnouncements, postAnnouncement, removeAnnouncement } from '@/lib/announcements'

let jsg: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
let kitty: NonNullable<ReturnType<typeof repo.getCommunityBySlug>>
beforeEach(() => { resetDbForTests(); jsg = repo.getCommunityBySlug('jsg')!; kitty = repo.getCommunityBySlug('kitty-demo')! })

describe('announcements', () => {
  it('goes live at once, newest first, and expires', () => {
    const t0 = new Date('2026-12-01T05:00:00Z')
    expect(postAnnouncement(jsg.id, 'Admin', 'Gates open at 8', 'info', 30, t0).ok).toBe(true)
    expect(postAnnouncement(jsg.id, 'Admin', '  Court 2   moved ', 'urgent', 120, t0).ok).toBe(true)
    const live = liveAnnouncements(jsg.id, new Date('2026-12-01T05:10:00Z'))
    expect(live.map((a) => a.message)).toEqual(['Court 2 moved', 'Gates open at 8'])
    expect(live[0].level).toBe('urgent')
    expect(liveAnnouncements(jsg.id, new Date('2026-12-01T05:40:00Z')).map((a) => a.message)).toEqual(['Court 2 moved'])
    expect(liveAnnouncements(jsg.id, new Date('2026-12-01T08:00:00Z'))).toEqual([])
  })
  it('rejects empty and over-long messages and clamps the duration', () => {
    expect(postAnnouncement(jsg.id, 'A', '   ', 'info', 60).ok).toBe(false)
    expect(postAnnouncement(jsg.id, 'A', 'x'.repeat(201), 'info', 60).ok).toBe(false)
    const t0 = new Date('2026-12-01T05:00:00Z')
    const r = postAnnouncement(jsg.id, 'A', 'Hello', 'whatever', 99999, t0)
    expect(r.ok).toBe(true)
    const a = liveAnnouncements(jsg.id, t0)[0]
    expect(a.level).toBe('info')
    expect(new Date(a.expires_at).getTime() - t0.getTime()).toBe(1440 * 60_000)
  })
  it('can be removed, only within its own community, and is audited', () => {
    const r = postAnnouncement(jsg.id, 'Admin', 'Lunch is ready', 'info', 60)
    if (!r.ok) throw new Error('post')
    expect(liveAnnouncements(kitty.id)).toEqual([])
    expect(removeAnnouncement(kitty.id, r.id, 'x')).toBe(false)
    expect(liveAnnouncements(jsg.id)).toHaveLength(1)
    expect(removeAnnouncement(jsg.id, r.id, 'Admin')).toBe(true)
    expect(liveAnnouncements(jsg.id)).toEqual([])
    const acts = (getDb().prepare('select action from audit_log where community_id = ?').all(jsg.id) as { action: string }[]).map((x) => x.action)
    expect(acts)
      .toEqual(expect.arrayContaining(['announcement.posted', 'announcement.removed']))
  })
})
