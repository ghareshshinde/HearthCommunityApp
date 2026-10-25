import { z } from 'zod'
import { sportFormats } from '../sports'

export const GENDERS = ['Male', 'Female'] as const
export const KINDS = ['member', 'guest'] as const
export const SKILLS = ['beginner', 'casual', 'competitive'] as const
/** Suggestions the event owner can tick when setting up an event. Nothing is assumed: an event with none ticked asks no diet question. */
export const DIETS = ['Vegetarian', 'Jain', 'Chauvihar', 'Vegan', 'Other'] as const
export const TSHIRTS = ['4-6y', '8-10y', '12-14y', 'S', 'M', 'L', 'XL', 'XXL'] as const
export const SOFT_LIMIT = 8
export const DEFAULT_SPORTS = ['Chess', 'Carrom', 'Cricket', 'Badminton', 'Table Tennis', 'Pickleball']

export type OptionalColumn = 'email' | 'skill' | 'diet' | 'tshirt' | 'accessibility'
export type ColumnConfig = Record<OptionalColumn, { show: boolean; required: boolean }>
export const DEFAULT_COLUMNS: ColumnConfig = {
  email: { show: true, required: false },
  skill: { show: true, required: true },
  diet: { show: true, required: false },
  tshirt: { show: true, required: false },
  accessibility: { show: true, required: false },
}
/** Up to five extra questions the event owner adds, asked once per person. */
export function parseQuestions(v: unknown): Question[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 5).map((q, i) => {
    const o = (q ?? {}) as Record<string, unknown>
    const kind: Question['kind'] = o.kind === 'choice' ? 'choice' : 'text'
    const options = kind === 'choice' && Array.isArray(o.options) ? [...new Set((o.options as unknown[]).map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, 12) : []
    return { id: `q${i + 1}`, label: String(o.label ?? '').trim().slice(0, 80), kind: kind === 'choice' && !options.length ? 'text' as const : kind, options, required: o.required === true }
  }).filter((q) => q.label)
}
function parseDiets(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.map((d) => String(d).trim().slice(0, 30)).filter(Boolean))].slice(0, 12) : []
}
export function columnConfig(raw: string | null | undefined): ColumnConfig {
  try {
    const j = JSON.parse(raw || '{}'), c = j.columns ?? {}
    const cfg = Object.fromEntries(
      (Object.keys(DEFAULT_COLUMNS) as OptionalColumn[]).map((k) => [k, { ...DEFAULT_COLUMNS[k], ...c[k] }]),
    ) as ColumnConfig
    // The diet question exists only when the event owner has chosen diet options.
    cfg.diet = { ...cfg.diet, show: parseDiets(j.diets).length > 0 }
    return cfg
  } catch {
    return DEFAULT_COLUMNS
  }
}

/** English only for the MVP: Latin letters, spaces and . ' - so every admin and coordinator can read every name. */
export const PARTNER_TEXT = /^[A-Za-z0-9][A-Za-z0-9 .'’-]{0,59}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
/** The same check in the browser while typing and on the server at submit. */
export const isEmail = (v: string) => EMAIL_RE.test(v.trim()) && z.email().safeParse(v.trim()).success
export const ENGLISH_NAME = /^[A-Za-z][A-Za-z .'’-]*$/
const englishName = (max: number) =>
  z.string().trim().min(1, 'Required').max(max).regex(ENGLISH_NAME, 'Use English letters only')

export type Question = { id: string; label: string; kind: 'text' | 'choice'; options: string[]; required: boolean }
export const RULE_KEYS = ['all', 'singles', 'doubles', 'team'] as const
export type RuleKey = (typeof RULE_KEYS)[number]
/** Written rules the organisers publish: for the whole event, and per sport with optional extra text for singles, doubles or team play. */
export type EventRules = { general: string; sports: Record<string, Partial<Record<RuleKey, string>>> }
const RULE_MAX = 3000
export function parseRules(v: unknown): EventRules {
  const o = (v ?? {}) as { general?: unknown; sports?: Record<string, Record<string, unknown>> }
  const clean = (x: unknown) => String(x ?? '').replace(/\r\n/g, '\n').trim().slice(0, RULE_MAX)
  const sports: EventRules['sports'] = {}
  for (const [sp, r] of Object.entries(o.sports ?? {})) {
    const entry: Partial<Record<RuleKey, string>> = {}
    for (const k of RULE_KEYS) { const t = clean(r?.[k]); if (t) entry[k] = t }
    if (Object.keys(entry).length) sports[sp] = entry
  }
  return { general: clean(o.general), sports }
}
/** What a player in this sport and format must read: the sport's general rules first, then the format's own. */
export function rulesFor(rules: EventRules, sport: string, entryType?: 'singles' | 'doubles' | 'team'): { label: string; text: string }[] {
  const r = rules.sports[sport] ?? {}
  const out: { label: string; text: string }[] = []
  if (r.all) out.push({ label: `${sport}: all formats`, text: r.all })
  for (const k of entryType ? [entryType] : (['singles', 'doubles', 'team'] as const)) if (r[k]) out.push({ label: `${sport}: ${k}`, text: r[k]! })
  return out
}

export type GroupLinks = { whatsapp: string; telegram: string }
const GROUP_HOSTS: Record<keyof GroupLinks, string[]> = {
  whatsapp: ['chat.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com', 'wa.me'],
  telegram: ['t.me', 'telegram.me', 'telegram.dog'],
}
/** A group or channel invite link, only from the messaging app's own domain and only over https. Anything else becomes empty. */
export function groupLink(kind: keyof GroupLinks, raw: unknown): string {
  const text = String(raw ?? '').trim()
  if (!text || text.length > 300) return ''
  try {
    const u = new URL(text)
    if (u.protocol !== 'https:' || u.username || u.password || !GROUP_HOSTS[kind].includes(u.hostname.toLowerCase())) return ''
    if (u.pathname.length < 2) return ''
    return u.toString()
  } catch { return '' }
}
export function parseGroups(v: unknown): GroupLinks {
  const o = (v ?? {}) as Record<string, unknown>
  return { whatsapp: groupLink('whatsapp', o.whatsapp), telegram: groupLink('telegram', o.telegram) }
}

export type AgeLimit = { min?: number; max?: number }
export type EventSettings = { capacity: Record<string, number>; ages: Record<string, AgeLimit>; waiver: string; gates: string[]; spot: { open: boolean; cap: number }; approvalRequired: boolean; contactEmailRequired: boolean; diets: string[]; questions: Question[]; rules: EventRules; groups: GroupLinks }
export const DEFAULT_WAIVER =
  'I accept the injury waiver for everyone listed. For children I am the parent or guardian and consent to their participation.'

/** Per-event rules kept in event.config: capacity per sport, age limits per sport and the waiver wording. */
export function eventSettings(raw: string | null | undefined): EventSettings {
  let c: Record<string, unknown> = {}
  try { c = JSON.parse(raw || '{}') } catch { /* defaults */ }
  const capacity: Record<string, number> = {}
  for (const [k, v] of Object.entries((c.capacity ?? {}) as Record<string, unknown>)) if (Number(v) > 0) capacity[k] = Math.floor(Number(v))
  const ages: Record<string, AgeLimit> = {}
  for (const [k, v] of Object.entries((c.ages ?? {}) as Record<string, AgeLimit>)) {
    const min = Number(v?.min) || undefined, max = Number(v?.max) || undefined
    if (min || max) ages[k] = { min, max }
  }
  const gates = Array.isArray(c.gates) ? (c.gates as unknown[]).map((g) => String(g).trim()).filter(Boolean).slice(0, 12) : []
  const sp = (c.spot ?? {}) as { open?: boolean; cap?: number }
  // Required unless an admin switches it off: the emailed link is how a family gets back to its registration.
  return { groups: parseGroups(c.groups), rules: parseRules(c.rules), questions: parseQuestions(c.questions), diets: parseDiets(c.diets), contactEmailRequired: c.contactEmailRequired !== false, approvalRequired: c.approvalRequired === true, gates, spot: { open: sp.open === true, cap: Math.max(0, Math.floor(Number(sp.cap) || 0)) }, capacity, ages, waiver: typeof c.waiver === 'string' && c.waiver.trim() ? c.waiver : DEFAULT_WAIVER }
}

export const normalizeMobile = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
/** Indian mobile numbers are ten digits starting 6 to 9. */
export const isMobile = (v: string) => /^[6-9]\d{9}$/.test(normalizeMobile(v))
const mobile = z.string().transform(normalizeMobile).refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a 10-digit mobile number starting 6, 7, 8 or 9')

export type ParticipantInput = {
  name: string; age: string | number; gender: string; mobile: string; email: string; sports: string[]
  skill: string; skills: Record<string, string>; formats: Record<string, string[]>; partners: Record<string, string>; extra: Record<string, string>; diet: string; tshirt: string; accessibility: string; kind: string
}
export const blankRow = (): ParticipantInput => ({
  name: '', age: '', gender: '', mobile: '', email: '', sports: [], skill: '', skills: {}, formats: {}, partners: {}, extra: {}, diet: '',
  tshirt: '', accessibility: '', kind: 'member',
})

export type RowErrors = Partial<Record<keyof ParticipantInput, string>>

/** Validates one row against the event. Returns cleaned values or per-cell errors. Shared by browser and server. */
export function validateRow(row: ParticipantInput, eventSports: string[], cols: ColumnConfig, ages: Record<string, AgeLimit> = {}, diets: string[] = [], questions: Question[] = []) {
  const errors: RowErrors = {}
  const name = row.name.trim()
  if (!name) errors.name = 'Required'
  else if (name.length > 80) errors.name = 'Too long'
  else if (!ENGLISH_NAME.test(name)) errors.name = 'Use English letters only'
  const age = Number(row.age)
  if (row.age === '' || !Number.isInteger(age) || age < 1 || age > 99) errors.age = 'Age 1 to 99'
  if (!GENDERS.includes(row.gender as never)) errors.gender = 'Choose Male or Female'
  if (!KINDS.includes(row.kind as never)) errors.kind = 'Choose Member or Guest'
  const adult = age >= 18
  let phone = ''
  if (row.mobile.trim() || adult) {
    const r = mobile.safeParse(row.mobile)
    if (r.success) phone = r.data
    else errors.mobile = adult && !row.mobile.trim() ? 'Required for adults' : /[A-Za-z]/.test(row.mobile) ? 'Mobile numbers have digits only' : 'Enter a 10-digit mobile number starting 6, 7, 8 or 9'
  }
  const email = row.email.trim()
  if (email && !isEmail(email)) errors.email = 'Enter a valid email address, like name@example.com'
  if (cols.email.show && cols.email.required && !email) errors.email = 'Required'
  // Sports are optional: a grandparent can come with the family and not play.
  if (row.sports.some((s) => !eventSports.includes(s))) errors.sports = 'Unknown sport'
  else if (row.sports.length && !errors.age) {
    for (const sp of row.sports) {
      const lim = ages[sp]
      if (lim && ((lim.min && age < lim.min) || (lim.max && age > lim.max))) {
        errors.sports = `${sp} is for ages ${lim.min ?? 1} to ${lim.max ?? 99}`
        break
      }
    }
  }
  // Skill is per sport: a person can be a beginner at Chess and competitive at Badminton. `skill` is a fallback for pasted rows and older callers.
  const skills: Record<string, string> = {}
  for (const sp of row.sports) {
    const lvl = row.skills?.[sp] || row.skill || ''
    if (lvl && !SKILLS.includes(lvl as never)) errors.skill = 'Choose a level'
    else if (!lvl && cols.skill.show && cols.skill.required && !errors.skill) errors.skill = row.sports.length > 1 ? 'Choose a level for each sport' : 'Choose a level'
    skills[sp] = lvl
  }
  // How each sport is played: no choice means open to every format the sport allows. A partner or team name only makes sense for doubles or team play.
  const formats: Record<string, string[]> = {}, partners: Record<string, string> = {}
  for (const sp of row.sports) {
    const allowed = sportFormats(sp) as string[]
    const picked = (row.formats?.[sp] ?? []).filter((f) => allowed.includes(f))
    formats[sp] = picked.length ? [...new Set(picked)] : allowed
    const text = String(row.partners?.[sp] ?? '').replace(/\s+/g, ' ').trim()
    if (text && (formats[sp].includes('doubles') || formats[sp].includes('team'))) {
      if (!PARTNER_TEXT.test(text)) errors.partners = `${sp}: partner or team name needs English letters only`
      else partners[sp] = text
    }
  }
  const diet = cols.diet.show && diets.length ? row.diet : ''
  if (diet && !diets.includes(diet)) errors.diet = 'Choose a diet'
  if (cols.diet.show && cols.diet.required && !diet) errors.diet = 'Choose a diet'
  if (cols.tshirt.show && cols.tshirt.required && !row.tshirt) errors.tshirt = 'Required'
  if (row.tshirt && !TSHIRTS.includes(row.tshirt as never)) errors.tshirt = 'Invalid size'
  if (cols.accessibility.show && cols.accessibility.required && !row.accessibility.trim()) errors.accessibility = 'Required'
  if (row.accessibility.length > 300) errors.accessibility = 'Too long'
  const extra: Record<string, string> = {}
  for (const q of questions) {
    const a = String(row.extra?.[q.id] ?? '').trim().slice(0, 200)
    if (a && q.kind === 'choice' && !q.options.includes(a)) errors.extra = `${q.label}: choose one of the options`
    else if (!a && q.required) errors.extra = `${q.label} is required`
    if (a) extra[q.id] = a
  }
  const ok = Object.keys(errors).length === 0
  return {
    ok,
    errors,
    value: ok
      ? { name, age, gender: row.gender as 'Male' | 'Female', mobile: phone, email, sports: [...new Set(row.sports)],
          skill: bestSkill(Object.values(skills)), skills, formats, partners, extra, diet, tshirt: row.tshirt, accessibility: row.accessibility.trim(),
          kind: row.kind as 'member' | 'guest' }
      : null,
  }
}

export const bestSkill = (levels: string[]) => [...SKILLS].reverse().find((s) => levels.includes(s)) ?? ''

const text = (max: number) => z.string().max(max).default('')
/** Shape guard for anything arriving from a browser: wrong types or oversized values are rejected before any rule runs. */
export const rowShape = z.object({
  name: text(200), age: z.union([z.string().max(10), z.number()]).transform((v) => String(v)).default(''), gender: text(20), mobile: text(30), email: text(200),
  sports: z.array(z.string().max(60)).max(20).default([]), skill: text(20), skills: z.record(z.string().max(60), z.string().max(20)).default({}), formats: z.record(z.string().max(60), z.array(z.string().max(12)).max(4)).default({}), partners: z.record(z.string().max(60), z.string().max(80)).default({}), extra: z.record(z.string().max(10), z.string().max(300)).default({}), diet: text(30), tshirt: text(20), accessibility: text(1000), kind: text(20),
})
export const submissionShape = z.object({
  rows: z.array(rowShape).max(200),
  contact: z.object({
    website: z.string().max(200).optional(), submissionKey: z.string().max(80).optional(),
    registrantName: text(200), registrantMobile: text(30), registrantEmail: text(200), emergencyName: text(200), emergencyMobile: text(30), waiver: z.boolean().default(false),
  }),
})

const contactFields = {
  registrantName: englishName(80),
  registrantMobile: mobile,
  emergencyName: englishName(80),
  emergencyMobile: mobile,
  waiver: z.literal(true, { error: 'You must accept the waiver' }),
}
const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address')])
const requiredEmail = z.email('Enter a valid email address').min(1, 'Required')

/** Registrant details. `emailRequired` follows the event setting; the spot desk uses the optional form. */
export const contactSchemaFor = (emailRequired: boolean) =>
  z.object({ ...contactFields, registrantEmail: emailRequired ? z.string().trim().min(1, 'Email is required: your ticket link is sent here').pipe(requiredEmail) : optionalEmail })
export const contactSchema = contactSchemaFor(false)

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmaill.com': 'gmail.com',
  'yahho.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com',
}
/** A likely correction for a mistyped email domain (name@gmial.com becomes name@gmail.com), or null. */
export function suggestEmail(email: string): string | null {
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(email.trim().toLowerCase())
  if (!m) return null
  const fix = DOMAIN_TYPOS[m[2]]
  return fix ? `${m[1]}@${fix}` : null
}

/** Pasted block from Excel/Sheets: tab-separated, columns in grid order. */
export const PASTE_COLUMNS = ['name', 'age', 'gender', 'mobile', 'email', 'sports', 'skill', 'diet', 'tshirt', 'accessibility', 'kind'] as const
export function parsePaste(text: string, eventSports: string[]): ParticipantInput[] {
  const cap = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase()
  return text.split(/\r?\n/).filter((l) => l.trim()).map((line) => {
    const c = line.split('\t').map((x) => x.trim())
    const r = blankRow()
    PASTE_COLUMNS.forEach((k, i) => {
      const v = c[i] ?? ''
      if (k === 'sports') r.sports = v.split(/[,;]/).map((s) => eventSports.find((e) => e.toLowerCase() === s.trim().toLowerCase()) ?? '').filter(Boolean)
      else if (k === 'gender') r.gender = ['male', 'female'].includes(v.toLowerCase()) ? cap(v) : ''
      else if (k === 'kind') r.kind = v.toLowerCase() === 'guest' ? 'guest' : 'member'
      else if (k === 'skill') r.skill = v.toLowerCase()
      else if (k === 'diet') r.diet = v
      else if (v) (r as Record<string, unknown>)[k] = v
    })
    return r
  })
}

/** Level per sport for a stored participant; falls back to the single older `skill` value. */
export function skillsOf(p: { skills?: string; skill: string; sports: string }): Record<string, string> {
  let m: Record<string, string> = {}
  try { m = JSON.parse(p.skills || '{}') } catch { /* fall back */ }
  const out: Record<string, string> = {}
  for (const sp of JSON.parse(p.sports || '[]') as string[]) out[sp] = m[sp] || p.skill || ''
  return out
}

export function extraOf(p: { extra?: string }): Record<string, string> {
  try { return JSON.parse(p.extra || '{}') } catch { return {} }
}

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()
/** The emergency contact must be someone who is not coming: not one of the people on this registration, by name or by mobile. */
export function emergencyConflicts(emergencyName: string, emergencyMobile: string, people: { name: string; mobile: string }[]): { emergencyName?: string; emergencyMobile?: string } {
  const out: { emergencyName?: string; emergencyMobile?: string } = {}
  const n = norm(emergencyName), m = normalizeMobile(emergencyMobile)
  if (n && people.some((p) => norm(p.name) === n)) out.emergencyName = 'The emergency contact must be someone who is not on this registration'
  if (m && people.some((p) => p.mobile && normalizeMobile(p.mobile) === m)) out.emergencyMobile = 'This mobile belongs to someone on this registration. Give another person\'s number'
  return out
}

/** Row one is the person registering: an adult we can reach. */
export function registrantProblems(row: { name: string; age: string | number; mobile: string; email: string }, emailRequired: boolean): { name?: string; age?: string; mobile?: string; email?: string } {
  const out: { name?: string; age?: string; mobile?: string; email?: string } = {}
  if (Number(row.age) > 0 && Number(row.age) < 18) out.age = 'The person registering must be 18 or older. Put an adult in the first row'
  if (!isMobile(row.mobile)) out.mobile = row.mobile.trim() ? 'Enter a 10-digit mobile number starting 6, 7, 8 or 9' : 'Required: organisers call this number'
  if (!row.email.trim()) { if (emailRequired) out.email = 'Required: your ticket link is sent here' }
  else if (!isEmail(row.email)) out.email = 'Enter a valid email address, like name@example.com'
  return out
}

/** Level, format and partner per sport for a stored participant. */
export function formatsOf(p: { formats?: string; sports: string }): Record<string, string[]> {
  let m: Record<string, string[]> = {}
  try { m = JSON.parse(p.formats || '{}') } catch { /* fall back */ }
  const out: Record<string, string[]> = {}
  for (const sp of JSON.parse(p.sports || '[]') as string[]) out[sp] = m[sp]?.length ? m[sp] : (sportFormats(sp) as string[])
  return out
}
export function partnersOf(p: { partners?: string }): Record<string, string> {
  try { return JSON.parse(p.partners || '{}') } catch { return {} }
}
