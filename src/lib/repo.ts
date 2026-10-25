import { getDb } from './db'
import { hashPassword, newRef, newToken } from './auth'
import { columnConfig, validateRow, contactSchema, type ParticipantInput } from './registration/rules'
import { resolveBranding } from './branding/resolve'

/** Every query below takes a community id and filters on it. Nothing else touches the tables. */
export type Community = { id: number; slug: string; name: string; type: string; city: string | null; about: string | null; branding: string; admin_hash: string }
export type EventRow = {
  id: number; community_id: number; title: string; description: string; starts_at: string | null; ends_at: string | null
  venue: string; map_url: string; sports: string; config: string; cutoff_at: string | null; status: 'draft' | 'published' | 'closed'
}
export type RegistrationRow = {
  id: number; community_id: number; event_id: number; ref: string; token: string; registrant_name: string; registrant_mobile: string
  registrant_email: string; emergency_name: string; emergency_mobile: string; waiver_at: string; status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string; updated_at: string
}
export type ParticipantRow = {
  id: number; community_id: number; event_id: number; registration_id: number; name: string; age: number; gender: 'Male' | 'Female'
  mobile: string; email: string; sports: string; skill: string; diet: string; tshirt: string; accessibility: string
  kind: 'member' | 'guest'; verified: number; registered_at: string
}

const db = () => getDb()
const all = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).all(...p) as unknown as T[]
const one = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).get(...p) as unknown as T | undefined

export function ensureBootstrap() {
  if (one<{ n: number }>('select count(*) n from community')!.n > 0) return
  const pw = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? null : 'change-me')
  if (!pw) throw new Error('Set ADMIN_PASSWORD to create the first community in production')
  const mk = db().prepare('insert into community (slug,name,type,city,about,admin_hash) values (?,?,?,?,?,?)')
  mk.run('jsg', 'JSG Hyderabad', 'trust', 'Hyderabad', 'Jain Social Groups International Federation. Demo tenant for the Sports Fiesta.', hashPassword(pw))
  // Colours taken from the JSG logo: royal blue and gold. Gold is a fill colour only (it fails contrast as text).
  db().prepare("update community set branding = ? where slug = 'jsg'").run(JSON.stringify({
    name: 'JSG Hyderabad', tagline: 'Grow more to Serve more',
    colors: { primary: '#1e4a9e', secondary: '#17387a', accent: '#f2b705', background: '#f5f8fd', surface: '#ffffff',
      textPrimary: '#0f172a', textSecondary: '#475569', border: '#cbd5e1', link: '#1e4a9e' },
    darkColors: null,
  }))
  mk.run('kitty-demo', 'Sunday Kitty Group (demo)', 'unregistered', 'Hyderabad', 'Dummy kitty party group.', hashPassword(pw))
  if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_EVENT === 'true') {
    const jsg = one<{ id: number }>("select id from community where slug = 'jsg'")!.id
    const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString()
    db().prepare("insert into event (community_id,title,description,starts_at,ends_at,venue,map_url,sports,cutoff_at,status) values (?,?,?,?,?,?,?,?,?,'published')")
      .run(jsg, 'Sports Fiesta (demo)', 'Demo event with fake details. Replace in the admin console.', inDays(30), inDays(30.4), 'Demo Stadium, Hyderabad', 'https://maps.google.com',
        JSON.stringify(['Chess', 'Carrom', 'Cricket', 'Badminton', 'Table Tennis', 'Pickleball']), inDays(25))
  }
}

export function getCommunityBySlug(slug: string) {
  ensureBootstrap()
  const c = one<Community>('select * from community where slug = ?', slug)
  return c ? { ...c, brand: resolveBranding(JSON.parse(c.branding)) } : undefined
}
export const listCommunities = () => (ensureBootstrap(), all<Community>('select * from community order by name'))
export function saveBranding(cid: number, branding: unknown) {
  db().prepare('update community set branding = ? where id = ?').run(JSON.stringify(branding), cid)
}

// ---------- events ----------
export const listEvents = (cid: number, publishedOnly = false) =>
  all<EventRow>(`select * from event where community_id = ? ${publishedOnly ? "and status = 'published'" : ''} order by starts_at desc, id desc`, cid)
export const getEvent = (cid: number, id: number) => one<EventRow>('select * from event where community_id = ? and id = ?', cid, id)

export type EventInput = Omit<EventRow, 'id' | 'community_id'>
export function saveEvent(cid: number, id: number | null, e: EventInput): number {
  const vals = [e.title, e.description, e.starts_at, e.ends_at, e.venue, e.map_url, e.sports, e.config, e.cutoff_at, e.status] as const
  if (id) {
    const r = db().prepare('update event set title=?,description=?,starts_at=?,ends_at=?,venue=?,map_url=?,sports=?,config=?,cutoff_at=?,status=? where community_id=? and id=?').run(...vals, cid, id)
    if (!r.changes) throw new Error('Event not found')
    return id
  }
  return Number(db().prepare('insert into event (title,description,starts_at,ends_at,venue,map_url,sports,config,cutoff_at,status,community_id) values (?,?,?,?,?,?,?,?,?,?,?)').run(...vals, cid).lastInsertRowid)
}

// ---------- registrations ----------
export type Contact = { registrantName: string; registrantMobile: string; registrantEmail: string; emergencyName: string; emergencyMobile: string; waiver: boolean }
export type SubmitResult =
  | { ok: true; token: string; ref: string }
  | { ok: false; error?: string; contactErrors?: Record<string, string>; rowErrors?: Record<number, Record<string, string>> }

export function isOpen(ev: EventRow, now = new Date()) {
  return ev.status === 'published' && !(ev.cutoff_at && new Date(ev.cutoff_at) < now)
}

/** Validates everything again on the server (the browser check is a convenience, not a gate). */
export function validateSubmission(ev: EventRow, contact: Contact, rows: ParticipantInput[]) {
  const cols = columnConfig(ev.config)
  const sports = JSON.parse(ev.sports) as string[]
  const c = contactSchema.safeParse(contact)
  const contactErrors: Record<string, string> = {}
  if (!c.success) for (const i of c.error.issues) contactErrors[String(i.path[0])] = i.message
  const rowErrors: Record<number, Record<string, string>> = {}
  const clean = rows.map((r, i) => {
    const v = validateRow(r, sports, cols)
    if (!v.ok) rowErrors[i] = v.errors as Record<string, string>
    return v.value
  })
  if (!rows.length) return { ok: false as const, error: 'Add at least one participant' }
  if (rows.length > 60) return { ok: false as const, error: 'Too many participants in one registration' }
  if (Object.keys(contactErrors).length || Object.keys(rowErrors).length) return { ok: false as const, contactErrors, rowErrors }
  return { ok: true as const, contact: c.data!, rows: clean.filter((x): x is NonNullable<typeof x> => !!x) }
}

function insertParticipants(cid: number, eid: number, rid: number, rows: NonNullable<ReturnType<typeof validateRow>['value']>[]) {
  const st = db().prepare('insert into participant (community_id,event_id,registration_id,name,age,gender,mobile,email,sports,skill,diet,tshirt,accessibility,kind) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const p of rows) st.run(cid, eid, rid, p.name, p.age, p.gender, p.mobile, p.email, JSON.stringify(p.sports), p.skill, p.diet, p.tshirt, p.accessibility, p.kind)
}

export function createRegistration(ev: EventRow, contact: Contact, rows: ParticipantInput[], now = new Date()): SubmitResult {
  if (!isOpen(ev, now)) return { ok: false, error: 'Registration is closed for this event' }
  const v = validateSubmission(ev, contact, rows)
  if (!v.ok) return v
  const token = newToken()
  const ref = newRef()
  const d = db()
  d.exec('begin')
  try {
    const rid = Number(d.prepare('insert into registration (community_id,event_id,ref,token,registrant_name,registrant_mobile,registrant_email,emergency_name,emergency_mobile,waiver_at) values (?,?,?,?,?,?,?,?,?,?)')
      .run(ev.community_id, ev.id, ref, token, v.contact.registrantName, v.contact.registrantMobile, v.contact.registrantEmail, v.contact.emergencyName, v.contact.emergencyMobile, now.toISOString()).lastInsertRowid)
    insertParticipants(ev.community_id, ev.id, rid, v.rows)
    audit(ev.community_id, 'public', 'registration.created', ref, { participants: v.rows.length })
    if (v.contact.registrantEmail) queueEmail(ev.community_id, v.contact.registrantEmail, `Registration received: ${ev.title}`, `Reference ${ref}. Organisers will verify your registration. Edit link: /r/${token}`)
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true, token, ref }
}

export const getRegistrationByToken = (token: string) => {
  const r = one<RegistrationRow>('select * from registration where token = ?', token)
  return r
}
export const listParticipantsOfRegistration = (cid: number, rid: number) =>
  all<ParticipantRow>('select * from participant where community_id = ? and registration_id = ? order by id', cid, rid)

/** Registrant edit: replaces all rows. Admin verification is reset for changed people, so re-check is needed. */
export function updateRegistration(ev: EventRow, reg: RegistrationRow, contact: Contact, rows: ParticipantInput[], now = new Date()): SubmitResult {
  if (reg.status === 'cancelled') return { ok: false, error: 'This registration was cancelled' }
  if (!isOpen(ev, now)) return { ok: false, error: 'The edit window has closed. Contact the organisers.' }
  const v = validateSubmission(ev, contact, rows)
  if (!v.ok) return v
  const d = db()
  d.exec('begin')
  try {
    d.prepare('update registration set registrant_name=?,registrant_mobile=?,registrant_email=?,emergency_name=?,emergency_mobile=?,updated_at=? where community_id=? and id=?')
      .run(v.contact.registrantName, v.contact.registrantMobile, v.contact.registrantEmail, v.contact.emergencyName, v.contact.emergencyMobile, now.toISOString(), reg.community_id, reg.id)
    d.prepare('delete from participant where community_id=? and registration_id=?').run(reg.community_id, reg.id)
    insertParticipants(reg.community_id, reg.event_id, reg.id, v.rows)
    audit(reg.community_id, 'public', 'registration.edited', reg.ref, { participants: v.rows.length })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true, token: reg.token, ref: reg.ref }
}

export function cancelRegistration(ev: EventRow, reg: RegistrationRow, actor: string, now = new Date()) {
  if (actor === 'public' && !isOpen(ev, now)) return false
  db().prepare("update registration set status='cancelled', updated_at=? where community_id=? and id=?").run(now.toISOString(), reg.community_id, reg.id)
  audit(reg.community_id, actor, 'registration.cancelled', reg.ref)
  return true
}

// ---------- admin workspace ----------
export type Row = ParticipantRow & { reg_ref: string; reg_status: RegistrationRow['status']; registrant_name: string; registrant_mobile: string; emergency_name: string; emergency_mobile: string; waiver_at: string; reg_created: string; sportList: string[] }

export function listRows(cid: number, eventId: number): Row[] {
  return all<Omit<Row, 'sportList'>>(
    `select p.*, r.ref reg_ref, r.status reg_status, r.registrant_name, r.registrant_mobile, r.emergency_name, r.emergency_mobile, r.waiver_at, r.created_at reg_created
     from participant p join registration r on r.id = p.registration_id and r.community_id = p.community_id
     where p.community_id = ? and p.event_id = ? order by p.registered_at, p.id`, cid, eventId,
  ).map((r) => ({ ...r, sportList: JSON.parse(r.sports) as string[] }))
}

export type Filters = { q?: string; sport?: string; gender?: string; kind?: string; diet?: string; status?: string; verified?: string; minAge?: string; maxAge?: string; sort?: string; dir?: string }
export function filterRows(rows: Row[], f: Filters): Row[] {
  const q = f.q?.trim().toLowerCase()
  let out = rows.filter((r) =>
    (!q || [r.name, r.mobile, r.reg_ref, r.registrant_name, r.email].some((x) => x.toLowerCase().includes(q))) &&
    (!f.sport || r.sportList.includes(f.sport)) && (!f.gender || r.gender === f.gender) && (!f.kind || r.kind === f.kind) &&
    (!f.diet || r.diet === f.diet) && (!f.status || r.reg_status === f.status) &&
    (!f.verified || String(r.verified) === (f.verified === 'yes' ? '1' : '0')) &&
    (!f.minAge || r.age >= Number(f.minAge)) && (!f.maxAge || r.age <= Number(f.maxAge)),
  )
  const key = (f.sort ?? 'registered_at') as keyof Row
  const dir = f.dir === 'desc' ? -1 : 1
  out = [...out].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir)
  return out
}

export const EDITABLE = ['name', 'age', 'gender', 'mobile', 'email', 'skill', 'diet', 'tshirt', 'accessibility', 'kind', 'sports'] as const
export type EditableField = (typeof EDITABLE)[number]

/** Admin inline edit with a before/after audit entry (RW3). Validates the whole row after the change. */
export function adminEditParticipant(cid: number, id: number, field: EditableField, value: string, actor: string) {
  const p = one<ParticipantRow>('select * from participant where community_id = ? and id = ?', cid, id)
  if (!p) return { ok: false as const, error: 'Not found' }
  const ev = getEvent(cid, p.event_id)!
  const row: ParticipantInput = { ...p, age: p.age, sports: JSON.parse(p.sports) }
  const before = field === 'sports' ? p.sports : String(p[field])
  if (field === 'sports') row.sports = value.split(',').map((s) => s.trim()).filter(Boolean)
  else (row as Record<string, unknown>)[field] = value
  const v = validateRow(row, JSON.parse(ev.sports), columnConfig('{}'))
  if (!v.ok && v.errors[field]) return { ok: false as const, error: v.errors[field] }
  const stored = field === 'sports' ? JSON.stringify(row.sports) : field === 'age' ? Number(value) : field === 'mobile' && v.value ? v.value.mobile : value
  db().prepare(`update participant set ${field} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') where community_id = ? and id = ?`).run(stored, cid, id)
  audit(cid, actor, 'participant.edited', String(id), { field, before, after: String(stored) })
  return { ok: true as const }
}

export type BulkAction = 'verify' | 'unverify' | 'confirm' | 'cancel' | 'member' | 'guest'
export function bulkAction(cid: number, ids: number[], action: BulkAction, actor: string) {
  if (!ids.length) return 0
  const d = db()
  const ph = ids.map(() => '?').join(',')
  d.exec('begin')
  try {
    if (action === 'verify' || action === 'unverify')
      d.prepare(`update participant set verified = ? where community_id = ? and id in (${ph})`).run(action === 'verify' ? 1 : 0, cid, ...ids)
    else if (action === 'member' || action === 'guest')
      d.prepare(`update participant set kind = ? where community_id = ? and id in (${ph})`).run(action, cid, ...ids)
    else {
      const status = action === 'confirm' ? 'confirmed' : 'cancelled'
      d.prepare(`update registration set status = ? where community_id = ? and id in (select registration_id from participant where community_id = ? and id in (${ph}))`).run(status, cid, cid, ...ids)
    }
    audit(cid, actor, `bulk.${action}`, null, { ids })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return ids.length
}

export function stats(rows: Row[]) {
  const live = rows.filter((r) => r.reg_status !== 'cancelled')
  const count = (f: (r: Row) => string[]) => {
    const m: Record<string, number> = {}
    for (const r of live) for (const k of f(r)) m[k] = (m[k] ?? 0) + 1
    return m
  }
  return {
    registrations: new Set(live.map((r) => r.registration_id)).size,
    participants: live.length,
    members: live.filter((r) => r.kind === 'member').length,
    guests: live.filter((r) => r.kind === 'guest').length,
    verified: live.filter((r) => r.verified).length,
    pending: new Set(live.filter((r) => r.reg_status === 'pending').map((r) => r.registration_id)).size,
    sports: count((r) => r.sportList), diets: count((r) => [r.diet]), tshirts: count((r) => (r.tshirt ? [r.tshirt] : [])),
    gender: count((r) => [r.gender]),
  }
}

// ---------- audit + outbox ----------
export function audit(cid: number | null, actor: string, action: string, target: string | null = null, meta: Record<string, unknown> = {}) {
  db().prepare('insert into audit_log (community_id,actor,action,target,meta) values (?,?,?,?,?)').run(cid, actor, action, target, JSON.stringify(meta))
}
export const listAudit = (cid: number, limit = 100) =>
  all<{ id: number; actor: string; action: string; target: string | null; meta: string; at: string }>('select * from audit_log where community_id = ? order by id desc limit ?', cid, limit)
export function queueEmail(cid: number, to: string, subject: string, body: string) {
  db().prepare('insert into outbox (community_id,to_email,subject,body) values (?,?,?,?)').run(cid, to, subject, body)
}
export const listOutbox = (cid: number) => all<{ id: number; to_email: string; subject: string; body: string; at: string }>('select * from outbox where community_id = ? order by id desc limit 100', cid)
