import { getDb } from './db'
import { audit, getEvent } from './repo'
import { normalizeMobile } from './registration/rules'

const db = () => getDb()
export type Duty = { id: number; community_id: number; event_id: number; volunteer: string; mobile: string; area: string; starts: string; ends: string; notes: string }
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function addDuty(cid: number, eventId: number, d: { volunteer: string; mobile?: string; area: string; starts?: string; ends?: string; notes?: string }, by: string): { ok: true; id: number } | { ok: false; error: string } {
  if (!getEvent(cid, eventId)) return { ok: false, error: 'Event not found' }
  const volunteer = d.volunteer.trim().slice(0, 80), area = d.area.trim().slice(0, 60)
  if (!volunteer) return { ok: false, error: 'Enter the volunteer name' }
  if (!area) return { ok: false, error: 'Enter where they will be, for example Gate 1 or Court 2' }
  const mobile = d.mobile?.trim() ? normalizeMobile(d.mobile) : ''
  if (mobile && !/^\d{10}$/.test(mobile)) return { ok: false, error: 'Mobile must be 10 digits' }
  const starts = d.starts?.trim() ?? '', ends = d.ends?.trim() ?? ''
  if ((starts && !TIME.test(starts)) || (ends && !TIME.test(ends))) return { ok: false, error: 'Use times like 09:00' }
  if (starts && ends && ends <= starts) return { ok: false, error: 'The end time must be after the start time' }
  const id = Number(db().prepare('insert into duty (community_id,event_id,volunteer,mobile,area,starts,ends,notes) values (?,?,?,?,?,?,?,?)')
    .run(cid, eventId, volunteer, mobile, area, starts, ends, (d.notes ?? '').trim().slice(0, 200)).lastInsertRowid)
  audit(cid, by, 'duty.added', String(id), { volunteer, area })
  return { ok: true, id }
}
export const listDuties = (cid: number, eventId: number) =>
  db().prepare('select * from duty where community_id = ? and event_id = ? order by area collate nocase, starts, id').all(cid, eventId) as unknown as Duty[]
export function removeDuty(cid: number, id: number, by: string) {
  const r = db().prepare('delete from duty where community_id = ? and id = ?').run(cid, id)
  if (Number(r.changes)) audit(cid, by, 'duty.removed', String(id))
  return !!Number(r.changes)
}
/** Two shifts for the same person that overlap on the clock, so the organiser sees the clash. */
export function clashes(duties: Duty[]): Set<number> {
  const out = new Set<number>()
  for (const a of duties) for (const b of duties) {
    if (a.id >= b.id || a.volunteer.toLowerCase() !== b.volunteer.toLowerCase() || !a.starts || !a.ends || !b.starts || !b.ends) continue
    if (a.starts < b.ends && b.starts < a.ends) { out.add(a.id); out.add(b.id) }
  }
  return out
}
