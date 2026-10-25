import { getDb } from './db'
import { audit } from './repo'

export type Level = 'info' | 'urgent'
export type Announcement = { id: number; message: string; level: Level; created_by: string; created_at: string; expires_at: string; removed_at: string | null }
const db = () => getDb()
export const MAX_LENGTH = 200
export const DURATIONS: Record<string, { label: string; minutes: number }> = {
  '30': { label: '30 minutes', minutes: 30 }, '120': { label: '2 hours', minutes: 120 }, '480': { label: '8 hours', minutes: 480 }, '1440': { label: '24 hours', minutes: 1440 },
}

/** Posts a message that every page of the community shows until it expires or is removed. */
export function postAnnouncement(cid: number, by: string, message: string, level: string, minutes: number, now = new Date()): { ok: true; id: number } | { ok: false; error: string } {
  const text = message.replace(/\s+/g, ' ').trim()
  if (!text) return { ok: false, error: 'Write the message first' }
  if (text.length > MAX_LENGTH) return { ok: false, error: `Keep it under ${MAX_LENGTH} characters so it fits the ticker` }
  const mins = Math.min(1440, Math.max(5, Math.floor(minutes) || 120))
  const expires = new Date(now.getTime() + mins * 60_000).toISOString()
  const id = Number(db().prepare('insert into announcement (community_id, message, level, created_by, created_at, expires_at) values (?,?,?,?,?,?)')
    .run(cid, text, level === 'urgent' ? 'urgent' : 'info', by, now.toISOString(), expires).lastInsertRowid)
  audit(cid, by, 'announcement.posted', String(id), { level, message: text })
  return { ok: true, id }
}

/** Live messages, newest first. */
export function liveAnnouncements(cid: number, now = new Date()): Announcement[] {
  return db().prepare('select * from announcement where community_id = ? and removed_at is null and expires_at > ? order by id desc limit 10')
    .all(cid, now.toISOString()) as unknown as Announcement[]
}
export function recentAnnouncements(cid: number): Announcement[] {
  return db().prepare('select * from announcement where community_id = ? order by id desc limit 30').all(cid) as unknown as Announcement[]
}
export function removeAnnouncement(cid: number, id: number, by: string): boolean {
  const r = db().prepare("update announcement set removed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'), removed_by = ? where community_id = ? and id = ? and removed_at is null").run(by, cid, id)
  if (Number(r.changes)) audit(cid, by, 'announcement.removed', String(id))
  return !!Number(r.changes)
}
