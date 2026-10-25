import { getDb } from './db'
import { hashPassword, newRef, newToken } from './auth'
import { columnConfig, eventSettings, validateRow, contactSchema, submissionShape, type ParticipantInput } from './registration/rules'
import { resolveBranding } from './branding/resolve'
import { makeTicket } from './ticket'

/** Every query below takes a community id and filters on it. Nothing else touches the tables. */
export type Community = { id: number; slug: string; name: string; type: string; city: string | null; about: string | null; branding: string; admin_hash: string }
export type EventRow = {
  id: number; community_id: number; title: string; description: string; starts_at: string | null; ends_at: string | null
  venue: string; map_url: string; sports: string; config: string; cutoff_at: string | null; status: 'draft' | 'published' | 'closed'
}
export type RegistrationRow = {
  id: number; community_id: number; event_id: number; ref: string; token: string; registrant_name: string; registrant_mobile: string
  registrant_email: string; emergency_name: string; emergency_mobile: string; waiver_at: string; status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string; updated_at: string; source: string
  rejected: number; decision_note: string; decided_by: string | null; decided_at: string | null
}
export type ParticipantRow = {
  id: number; community_id: number; event_id: number; registration_id: number; name: string; age: number; gender: 'Male' | 'Female'
  mobile: string; email: string; sports: string; skill: string; diet: string; tshirt: string; accessibility: string
  kind: 'member' | 'guest'; verified: number; registered_at: string; waitlist: string
  source: string; checked_in_at: string | null; checked_in_by: string | null; checked_in_gate: string | null
}

const db = () => getDb()
const all = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).all(...p) as unknown as T[]
const one = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).get(...p) as unknown as T | undefined

export function ensureBootstrap() {
  if (one<{ n: number }>('select count(*) n from community')!.n > 0) return maybeResetAdminPassword()
  const pw = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? null : 'change-me')
  if (!pw) throw new Error('Set ADMIN_PASSWORD to create the first community in production')
  const mk = db().prepare('insert into community (slug,name,type,city,about,admin_hash) values (?,?,?,?,?,?)')
  mk.run('jsg', 'JSG Hyderabad', 'trust', 'Hyderabad', 'Jain Social Groups International Federation. Demo tenant for the Sports Fiesta.', hashPassword(pw))
  // Colours taken from the JSG logo: royal blue and gold. Gold is a fill colour only (it fails contrast as text).
  db().prepare("update community set branding = ? where slug = 'jsg'").run(JSON.stringify({
    name: 'JSG Hyderabad', tagline: 'Grow more to Serve more', logo: '/img/jsg-logo.jpg',
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

export function setAdminPassword(cid: number, hash: string) {
  db().prepare('update community set admin_hash = ? where id = ?').run(hash, cid)
}

let resetDone = false
/** Recovery for a forgotten password: start once with RESET_ADMIN_PASSWORD=true and ADMIN_PASSWORD set, then unset it. */
function maybeResetAdminPassword() {
  if (resetDone || process.env.RESET_ADMIN_PASSWORD !== 'true' || !process.env.ADMIN_PASSWORD) return
  resetDone = true
  db().prepare('update community set admin_hash = ?').run(hashPassword(process.env.ADMIN_PASSWORD))
  audit(null, 'system', 'admin.password_reset_from_env')
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
/** The event staff work on today: the newest one that is published or closed, else the newest. */
export function currentEvent(cid: number): EventRow | undefined {
  const all = listEvents(cid)
  return all.find((e) => e.status !== 'draft') ?? all[0]
}
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
export type Contact = { website?: string; submissionKey?: string; registrantName: string; registrantMobile: string; registrantEmail: string; emergencyName: string; emergencyMobile: string; waiver: boolean }
export type SubmitResult =
  | { ok: true; token: string; ref: string }
  | { ok: false; error?: string; contactErrors?: Record<string, string>; rowErrors?: Record<number, Record<string, string>> }

export function isOpen(ev: EventRow, now = new Date()) {
  return ev.status === 'published' && !(ev.cutoff_at && new Date(ev.cutoff_at) < now)
}

/** Validates everything again on the server (the browser check is a convenience, not a gate). */
export function validateSubmission(ev: EventRow, rawContact: unknown, rawRows: unknown) {
  const shaped = submissionShape.safeParse({ rows: rawRows, contact: rawContact })
  if (!shaped.success) return { ok: false as const, error: 'The form data was not valid. Please reload the page and try again.' }
  const contact = shaped.data.contact
  const rows = shaped.data.rows as ParticipantInput[]
  const cols = columnConfig(ev.config)
  const ages = eventSettings(ev.config).ages
  const sports = JSON.parse(ev.sports) as string[]
  const c = contactSchema.safeParse(contact)
  const contactErrors: Record<string, string> = {}
  if (!c.success) for (const i of c.error.issues) contactErrors[String(i.path[0])] = i.message
  const rowErrors: Record<number, Record<string, string>> = {}
  const clean = rows.map((r, i) => {
    const v = validateRow(r, sports, cols, ages)
    if (!v.ok) rowErrors[i] = v.errors as Record<string, string>
    return v.value
  })
  if (!rows.length) return { ok: false as const, error: 'Add at least one participant' }
  if (rows.length > 60) return { ok: false as const, error: 'Too many participants in one registration' }
  if (Object.keys(contactErrors).length || Object.keys(rowErrors).length) return { ok: false as const, contactErrors, rowErrors }
  return { ok: true as const, contact: c.data!, rows: clean.filter((x): x is NonNullable<typeof x> => !!x) }
}

/** Sports already taken per sport by live registrations, optionally ignoring one registration (an edit). */
function sportUsage(cid: number, eid: number, exceptRegistration?: number) {
  const used: Record<string, number> = {}
  const rows = all<{ sports: string; waitlist: string }>(
    `select p.sports, p.waitlist from participant p join registration r on r.id = p.registration_id and r.community_id = p.community_id
     where p.community_id = ? and p.event_id = ? and r.status != 'cancelled' and r.id != ?`, cid, eid, exceptRegistration ?? 0)
  for (const r of rows) {
    const wl = new Set(JSON.parse(r.waitlist) as string[])
    for (const sp of JSON.parse(r.sports) as string[]) if (!wl.has(sp)) used[sp] = (used[sp] ?? 0) + 1
  }
  return used
}

/** Seats left per sport (null = unlimited), for showing "waitlist" on the form before someone submits. */
export function seatsLeft(ev: EventRow): Record<string, number | null> {
  const cap = eventSettings(ev.config).capacity
  const used = sportUsage(ev.community_id, ev.id)
  return Object.fromEntries((JSON.parse(ev.sports) as string[]).map((sp) => [sp, cap[sp] ? Math.max(0, cap[sp] - (used[sp] ?? 0)) : null]))
}

/** First come, first served per sport; anyone past a sport's capacity is waitlisted for it, never refused (X4). */
type InsertOpts = { source?: string; checkedInBy?: string; gate?: string; now?: string }
function insertParticipants(ev: EventRow, rid: number, rows: NonNullable<ReturnType<typeof validateRow>['value']>[], opts: InsertOpts = {}): { id: number; waitlist: string[] }[] {
  const cap = eventSettings(ev.config).capacity
  const used = sportUsage(ev.community_id, ev.id, rid)
  const st = db().prepare('insert into participant (community_id,event_id,registration_id,name,age,gender,mobile,email,sports,waitlist,skill,diet,tshirt,accessibility,kind,source,checked_in_at,checked_in_by,checked_in_gate) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const made: { id: number; waitlist: string[] }[] = []
  for (const p of rows) {
    const waitlist: string[] = []
    for (const sp of p.sports) {
      if (cap[sp] && (used[sp] ?? 0) >= cap[sp]) waitlist.push(sp)
      else used[sp] = (used[sp] ?? 0) + 1
    }
    const r = st.run(ev.community_id, ev.id, rid, p.name, p.age, p.gender, p.mobile, p.email, JSON.stringify(p.sports), JSON.stringify(waitlist), p.skill, p.diet, p.tshirt, p.accessibility, p.kind,
      opts.source ?? 'online', opts.checkedInBy ? (opts.now ?? new Date().toISOString()) : null, opts.checkedInBy ?? null, opts.checkedInBy ? (opts.gate ?? '') : null)
    made.push({ id: Number(r.lastInsertRowid), waitlist })
  }
  return made
}

export function createRegistration(ev: EventRow, contact: Contact, rows: ParticipantInput[], now = new Date()): SubmitResult {
  // A repeat of the same submission (double tap, retry after a dropped connection) returns the registration it already made.
  const key = typeof contact?.submissionKey === 'string' && contact.submissionKey.length >= 8 ? contact.submissionKey.slice(0, 80) : null
  if (key) {
    const prior = one<RegistrationRow>('select * from registration where community_id = ? and event_id = ? and submission_key = ?', ev.community_id, ev.id, key)
    if (prior) return { ok: true, token: prior.token, ref: prior.ref }
  }
  if (contact?.website) return { ok: false, error: 'Could not save this registration' } // honeypot field filled in by a bot
  if (!isOpen(ev, now)) return { ok: false, error: 'Registration is closed for this event' }
  const v = validateSubmission(ev, contact, rows)
  if (!v.ok) return v
  const token = newToken()
  const ref = newRef()
  const d = db()
  d.exec('begin')
  try {
    const rid = Number(d.prepare('insert into registration (community_id,event_id,ref,token,registrant_name,registrant_mobile,registrant_email,emergency_name,emergency_mobile,waiver_at,submission_key) values (?,?,?,?,?,?,?,?,?,?,?)')
      .run(ev.community_id, ev.id, ref, token, v.contact.registrantName, v.contact.registrantMobile, v.contact.registrantEmail, v.contact.emergencyName, v.contact.emergencyMobile, now.toISOString(), key).lastInsertRowid)
    insertParticipants(ev, rid, v.rows)
    audit(ev.community_id, 'public', 'registration.created', ref, { participants: v.rows.length })
    queueConfirmation(ev, ref, token, v.contact.registrantEmail, v.contact.registrantName, v.rows.length)
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true, token, ref }
}

/** Public address of this deployment, for links in emails. Set APP_URL (for example https://hearth-xyz.a.run.app). */
export const publicUrl = (path: string) => `${(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')}${path}`

function queueConfirmation(ev: EventRow, ref: string, token: string, email: string, name: string, count: number) {
  const slug = one<{ slug: string }>('select slug from community where id = ?', ev.community_id)!.slug
  const body = [
    `Hello ${name},`, '',
    `Your registration for ${ev.title} is saved (${count} ${count === 1 ? 'person' : 'people'}). Reference: ${ref}`,
    'The organisers will check your registration and may contact you.', '',
    `View, edit or cancel until the cut-off: ${publicUrl(`/c/${slug}/r/${token}`)}`,
    'Keep this email: the link above is the only way to change your registration.',
  ].join('\n')
  // One row for the registrant (when they gave an email) and one copy for the community's own address.
  if (email) queueEmail(ev.community_id, email, `Registration received: ${ev.title} (${ref})`, body)
  const copy = process.env.NOTIFY_COPY_TO
  if (copy) for (const to of copy.split(',').map((x) => x.trim()).filter(Boolean)) queueEmail(ev.community_id, to, `[Copy] New registration ${ref}: ${name}, ${count} ${count === 1 ? 'person' : 'people'}`, body)
}

/** Emails every registration made with this address its links. Returns how many were found; callers must not reveal that to the visitor. */
export function queueLinksEmail(cid: number, email: string): number {
  const addr = email.trim().toLowerCase()
  const regs = all<RegistrationRow & { title: string }>(
    `select r.*, e.title from registration r join event e on e.id = r.event_id and e.community_id = r.community_id
     where r.community_id = ? and lower(r.registrant_email) = ? and r.status != 'cancelled' order by r.created_at desc limit 10`, cid, addr)
  if (!regs.length) return 0
  const slug = slugOf(cid)
  const body = ['Hello,', '', 'Here are your registration links:', '',
    ...regs.flatMap((r) => [`${r.title} (${r.ref})`, `  View or change: ${publicUrl(`/c/${slug}/r/${r.token}`)}`, `  QR ticket: ${publicUrl(`/c/${slug}/t/${makeTicket(r.id)}`)}`, '']),
    'Anyone with these links can change the registration, so please do not forward this email.'].join('\n')
  queueEmail(cid, addr, 'Your registration links', body)
  return regs.length
}

export function findTokenByRefAndMobile(cid: number, ref: string, mobile: string): string | null {
  const r = one<{ token: string }>('select token from registration where community_id = ? and ref = ? and registrant_mobile = ?', cid, ref.trim().toUpperCase(), mobile)
  return r?.token ?? null
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
    insertParticipants(ev, reg.id, v.rows)
    audit(reg.community_id, 'public', 'registration.edited', reg.ref, { participants: v.rows.length })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return { ok: true, token: reg.token, ref: reg.ref }
}

export function cancelRegistration(ev: EventRow, reg: RegistrationRow, actor: string, now = new Date()) {
  if (actor === 'public' && !isOpen(ev, now)) return false
  db().prepare("update registration set status='cancelled', rejected=0, decided_by=?, decided_at=?, updated_at=? where community_id=? and id=?").run(actor, now.toISOString(), now.toISOString(), reg.community_id, reg.id)
  audit(reg.community_id, actor, 'registration.cancelled', reg.ref)
  return true
}

// ---------- approval and ticket validity ----------
export type RegState = 'pending' | 'approved' | 'rejected' | 'cancelled'
export const regState = (r: { status: string; rejected: number }): RegState =>
  r.status === 'confirmed' ? 'approved' : r.status === 'cancelled' ? (r.rejected ? 'rejected' : 'cancelled') : 'pending'

export type TicketStatus = { valid: boolean; state: RegState; reason: string }
/** A QR ticket works only while its registration is live. Rejected and cancelled tickets are dead; pending ones too when the event requires approval. */
export function ticketStatus(reg: Pick<RegistrationRow, 'status' | 'rejected' | 'decision_note' | 'decided_by'>, approvalRequired: boolean): TicketStatus {
  const state = regState(reg)
  if (state === 'rejected') return { valid: false, state, reason: `Rejected by the organisers${reg.decision_note ? `: ${reg.decision_note}` : ''}` }
  if (state === 'cancelled') return { valid: false, state, reason: reg.decided_by && reg.decided_by !== 'public' ? 'Cancelled by the organisers' : 'Cancelled by the registrant' }
  if (state === 'pending' && approvalRequired) return { valid: false, state, reason: 'Waiting for approval by the organisers' }
  return { valid: true, state, reason: '' }
}

const slugOf = (cid: number) => one<{ slug: string }>('select slug from community where id = ?', cid)?.slug ?? ''
function queueDecisionEmail(reg: RegistrationRow, subject: string, body: string) {
  if (reg.registrant_email) queueEmail(reg.community_id, reg.registrant_email, subject, body)
}

/** Approve (or reinstate) a registration. Its QR ticket becomes valid again at once. */
export function approveRegistration(cid: number, id: number, by: string, note = '', now = new Date()): boolean {
  const reg = getRegistrationById(cid, id)
  if (!reg) return false
  const was = regState(reg)
  db().prepare("update registration set status='confirmed', rejected=0, decision_note=?, decided_by=?, decided_at=?, updated_at=? where community_id=? and id=?").run(note, by, now.toISOString(), now.toISOString(), cid, id)
  audit(cid, by, was === 'rejected' || was === 'cancelled' ? 'registration.reinstated' : 'registration.approved', reg.ref, { note })
  queueDecisionEmail(reg, 'Your registration is approved', `Reference ${reg.ref} is approved. Your QR ticket is ready on your registration page: ${publicUrl(`/c/${slugOf(reg.community_id)}/r/${reg.token}`)}`)
  return true
}

/** Reject a registration. The QR stops working, its seats are freed, and the registrant sees the reason. */
export function rejectRegistration(cid: number, id: number, by: string, reason: string, now = new Date()): boolean {
  const reg = getRegistrationById(cid, id)
  if (!reg) return false
  db().prepare("update registration set status='cancelled', rejected=1, decision_note=?, decided_by=?, decided_at=?, updated_at=? where community_id=? and id=?").run(reason.slice(0, 300), by, now.toISOString(), now.toISOString(), cid, id)
  audit(cid, by, 'registration.rejected', reg.ref, { reason })
  queueDecisionEmail(reg, 'Your registration was not approved', `Reference ${reg.ref} was not approved.${reason ? ` Reason: ${reason}.` : ''} Please contact the organisers if you think this is a mistake.`)
  return true
}

/** Registrations waiting for a decision, with their people, for the review queue. */
export function pendingRegistrations(cid: number, eventId: number) {
  return all<RegistrationRow>("select * from registration where community_id = ? and event_id = ? and status = 'pending' order by created_at", cid, eventId)
    .map((r) => ({ reg: r, people: listParticipantsOfRegistration(cid, r.id) }))
}

// ---------- tickets, check-in and walk-ins ----------
export const getRegistrationById = (cid: number, id: number) =>
  one<RegistrationRow>('select * from registration where community_id = ? and id = ?', cid, id)

/** Find a registration at the gate by reference, anyone's name or anyone's mobile number. */
export function findRegistrations(cid: number, eventId: number, q: string): RegistrationRow[] {
  const like = `%${q.trim().replace(/[%_]/g, '')}%`
  if (q.trim().length < 2) return []
  return all<RegistrationRow>(
    `select distinct r.* from registration r left join participant p on p.registration_id = r.id and p.community_id = r.community_id
     where r.community_id = ? and r.event_id = ?
       and (r.ref like ? or r.registrant_name like ? or r.registrant_mobile like ? or p.name like ? or p.mobile like ?)
     order by r.created_at desc limit 20`, cid, eventId, like, like, like, like, like)
}

export type CheckInResult = { admitted: number[]; already: { id: number; at: string; by: string }[]; blocked: { id: number; reason: string }[] }
/** Idempotent: a second scan never re-admits anyone, it reports who is already in (C1, C2 without photos). */
export function checkIn(cid: number, ids: number[], by: string, gate: string, now = new Date()): CheckInResult {
  const out: CheckInResult = { admitted: [], already: [], blocked: [] }
  const d = db()
  d.exec('begin')
  try {
    for (const id of ids) {
      const info = one<RegistrationRow & { config: string }>(
        `select r.*, e.config from participant p join registration r on r.id = p.registration_id and r.community_id = p.community_id
         join event e on e.id = p.event_id where p.community_id = ? and p.id = ?`, cid, id)
      if (!info) continue
      const ts = ticketStatus(info, eventSettings(info.config).approvalRequired)
      if (!ts.valid) { out.blocked.push({ id, reason: ts.reason }); continue }
      const r = d.prepare("update participant set checked_in_at = ?, checked_in_by = ?, checked_in_gate = ? where community_id = ? and id = ? and checked_in_at is null")
        .run(now.toISOString(), by, gate, cid, id)
      if (r.changes) out.admitted.push(id)
      else {
        const p = one<ParticipantRow>('select * from participant where community_id = ? and id = ?', cid, id)
        if (p?.checked_in_at) out.already.push({ id, at: p.checked_in_at, by: p.checked_in_by ?? '' })
      }
    }
    if (out.admitted.length) audit(cid, by, 'checkin', gate, { participants: out.admitted })
    d.exec('commit')
  } catch (e) { d.exec('rollback'); throw e }
  return out
}

export function undoCheckIn(cid: number, id: number, by: string) {
  const r = db().prepare('update participant set checked_in_at = null, checked_in_by = null, checked_in_gate = null where community_id = ? and id = ? and checked_in_at is not null').run(cid, id)
  if (r.changes) audit(cid, by, 'checkin.undone', String(id))
  return r.changes > 0
}

export type WalkInInput = {
  person: ParticipantInput
  /** Add to this existing registration (same family)... */
  registrationId?: number
  /** ...or create a separate entry with its own contact. */
  contact?: { name: string; mobile: string; emergencyName: string; emergencyMobile: string }
  waiver: boolean
  by: string
  gate: string
}
export type WalkInResult =
  | { ok: true; registrationId: number; ref: string; participantId: number; waitlisted: string[] }
  | { ok: false; error?: string; rowErrors?: Record<string, string>; contactErrors?: Record<string, string> }

/** Spot registration (S1, S4, S5, S6): registers and admits in one step, either into a family or as its own entry. */
export function addWalkIn(ev: EventRow, input: WalkInInput, now = new Date()): WalkInResult {
  const cid = ev.community_id
  const settings = eventSettings(ev.config)
  if (ev.status === 'draft') return { ok: false, error: 'This event is not published' }
  if (!settings.spot.open) return { ok: false, error: 'Spot registration is closed' }
  if (settings.spot.cap > 0) {
    const used = one<{ n: number }>("select count(*) n from participant p join registration r on r.id = p.registration_id where p.community_id = ? and p.event_id = ? and p.source = 'spot' and r.status != 'cancelled'", cid, ev.id)!.n
    if (used >= settings.spot.cap) return { ok: false, error: `The walk-in limit of ${settings.spot.cap} has been reached` }
  }
  if (!input.waiver) return { ok: false, error: 'Waiver must be accepted at the desk' }
  const v = validateRow(input.person, JSON.parse(ev.sports), columnConfig(ev.config), settings.ages)
  if (!v.ok || !v.value) return { ok: false, rowErrors: v.errors as Record<string, string> }
  const d = db()
  d.exec('begin')
  try {
    let rid: number, ref: string
    if (input.registrationId) {
      const reg = getRegistrationById(cid, input.registrationId)
      if (!reg || reg.event_id !== ev.id || reg.status === 'cancelled') { d.exec('rollback'); return { ok: false, error: 'That registration was not found' } }
      rid = reg.id; ref = reg.ref
    } else {
      const c = input.contact
      const errs: Record<string, string> = {}
      const clean = contactSchema.safeParse({ registrantName: c?.name ?? '', registrantMobile: c?.mobile ?? '', registrantEmail: '', emergencyName: c?.emergencyName ?? '', emergencyMobile: c?.emergencyMobile ?? '', waiver: true })
      if (!clean.success) { for (const i of clean.error.issues) errs[String(i.path[0])] = i.message; d.exec('rollback'); return { ok: false, contactErrors: errs } }
      ref = newRef()
      rid = Number(d.prepare("insert into registration (community_id,event_id,ref,token,registrant_name,registrant_mobile,registrant_email,emergency_name,emergency_mobile,waiver_at,status,source) values (?,?,?,?,?,?,?,?,?,?,'confirmed','spot')")
        .run(cid, ev.id, ref, newToken(), clean.data.registrantName, clean.data.registrantMobile, '', clean.data.emergencyName, clean.data.emergencyMobile, now.toISOString()).lastInsertRowid)
    }
    const [made] = insertParticipants(ev, rid, [v.value], { source: 'spot', checkedInBy: input.by, gate: input.gate, now: now.toISOString() })
    audit(cid, input.by, 'walkin', ref, { participant: made.id, family: !!input.registrationId, gate: input.gate })
    d.exec('commit')
    return { ok: true, registrationId: rid, ref, participantId: made.id, waitlisted: made.waitlist }
  } catch (e) { d.exec('rollback'); throw e }
}

/** What a sport admin may see: names, ages and arrival, never contact details (SP1, SP2). */
export type RosterEntry = { id: number; name: string; age: number; gender: string; skill: string; kind: string; checkedInAt: string | null; waitlisted: boolean; withdrawn: boolean }
export function sportRoster(cid: number, eventId: number, sport: string): RosterEntry[] {
  return listRows(cid, eventId)
    .filter((r) => r.sportList.includes(sport))
    .map((r) => ({ id: r.id, name: r.name, age: r.age, gender: r.gender, skill: r.skill, kind: r.kind, checkedInAt: r.checked_in_at, waitlisted: r.waitlistList.includes(sport), withdrawn: r.reg_status === 'cancelled' }))
}

// ---------- admin workspace ----------
export type Row = ParticipantRow & { reg_state: RegState; reg_rejected: number; reg_note: string; reg_ref: string; reg_status: RegistrationRow['status']; registrant_name: string; registrant_mobile: string; emergency_name: string; emergency_mobile: string; waiver_at: string; reg_created: string; sportList: string[]; waitlistList: string[] }

export function listRows(cid: number, eventId: number): Row[] {
  return all<Omit<Row, 'sportList' | 'waitlistList' | 'reg_state'>>(
    `select p.*, r.ref reg_ref, r.status reg_status, r.rejected reg_rejected, r.decision_note reg_note, r.registrant_name, r.registrant_mobile, r.emergency_name, r.emergency_mobile, r.waiver_at, r.created_at reg_created
     from participant p join registration r on r.id = p.registration_id and r.community_id = p.community_id
     where p.community_id = ? and p.event_id = ? order by p.registered_at, p.id`, cid, eventId,
  ).map((r) => ({ ...r, reg_state: regState({ status: r.reg_status, rejected: r.reg_rejected }), sportList: JSON.parse(r.sports) as string[], waitlistList: JSON.parse(r.waitlist) as string[] }))
}

export type Filters = { arrived?: string; source?: string; q?: string; sport?: string; gender?: string; kind?: string; diet?: string; status?: string; verified?: string; minAge?: string; maxAge?: string; sort?: string; dir?: string }
export function filterRows(rows: Row[], f: Filters): Row[] {
  const q = f.q?.trim().toLowerCase()
  let out = rows.filter((r) =>
    (!q || [r.name, r.mobile, r.reg_ref, r.registrant_name, r.email].some((x) => x.toLowerCase().includes(q))) &&
    (!f.sport || r.sportList.includes(f.sport)) && (!f.gender || r.gender === f.gender) && (!f.kind || r.kind === f.kind) &&
    (!f.diet || r.diet === f.diet) && (!f.status || r.reg_state === f.status) &&
    (!f.verified || String(r.verified) === (f.verified === 'yes' ? '1' : '0')) &&
    (!f.arrived || (f.arrived === 'yes') === !!r.checked_in_at) && (!f.source || r.source === f.source) &&
    (!f.minAge || r.age >= Number(f.minAge)) && (!f.maxAge || r.age <= Number(f.maxAge)),
  )
  const key = (f.sort ?? 'registered_at') as keyof Row
  const dir = f.dir === 'desc' ? -1 : 1
  const val = (r: Row) => (r[key] ?? '') as string | number | string[]
  out = [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir)
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
  const v = validateRow(row, JSON.parse(ev.sports), columnConfig('{}'), eventSettings(ev.config).ages)
  if (!v.ok && v.errors[field]) return { ok: false as const, error: v.errors[field] }
  const stored = field === 'sports' ? JSON.stringify(row.sports) : field === 'age' ? Number(value) : field === 'mobile' && v.value ? v.value.mobile : value
  db().prepare(`update participant set ${field} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') where community_id = ? and id = ?`).run(stored, cid, id)
  audit(cid, actor, 'participant.edited', String(id), { field, before, after: String(stored) })
  return { ok: true as const }
}

export type BulkAction = 'verify' | 'unverify' | 'confirm' | 'reject' | 'cancel' | 'member' | 'guest' | 'promote'
export function bulkAction(cid: number, ids: number[], action: BulkAction, actor: string, note = '') {
  if (!ids.length) return 0
  const d = db()
  const ph = ids.map(() => '?').join(',')
  d.exec('begin')
  try {
    if (action === 'verify' || action === 'unverify')
      d.prepare(`update participant set verified = ? where community_id = ? and id in (${ph})`).run(action === 'verify' ? 1 : 0, cid, ...ids)
    else if (action === 'promote')
      d.prepare(`update participant set waitlist = '[]' where community_id = ? and id in (${ph})`).run(cid, ...ids)
    else if (action === 'member' || action === 'guest')
      d.prepare(`update participant set kind = ? where community_id = ? and id in (${ph})`).run(action, cid, ...ids)
    else {
      const regs = all<{ registration_id: number }>(`select distinct registration_id from participant where community_id = ? and id in (${ph})`, cid, ...ids)
      for (const { registration_id } of regs) {
        if (action === 'confirm') approveRegistration(cid, registration_id, actor, note)
        else if (action === 'reject') rejectRegistration(cid, registration_id, actor, note)
        else {
          const reg = getRegistrationById(cid, registration_id)
          if (reg) { d.prepare("update registration set status='cancelled', rejected=0, decided_by=?, decided_at=? where community_id=? and id=?").run(actor, new Date().toISOString(), cid, registration_id); audit(cid, actor, 'registration.cancelled', reg.ref) }
        }
      }
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
    arrived: live.filter((r) => r.checked_in_at).length,
    walkIns: live.filter((r) => r.source === 'spot').length,
    pending: new Set(live.filter((r) => r.reg_status === 'pending').map((r) => r.registration_id)).size,
    sports: count((r) => r.sportList.filter((x) => !r.waitlistList.includes(x))), waitlisted: count((r) => r.waitlistList), diets: count((r) => [r.diet]), tshirts: count((r) => (r.tshirt ? [r.tshirt] : [])),
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
export const listOutbox = (cid: number) => all<{ id: number; to_email: string; subject: string; body: string; at: string; sent: number; attempts: number; error: string | null }>('select * from outbox where community_id = ? order by id desc limit 100', cid)
