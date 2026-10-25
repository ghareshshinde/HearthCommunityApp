import { z } from 'zod'

export const GENDERS = ['Male', 'Female'] as const
export const KINDS = ['member', 'guest'] as const
export const SKILLS = ['beginner', 'casual', 'competitive'] as const
export const DIETS = ['Vegetarian', 'Jain', 'Chauvihar', 'Vegan', 'Other'] as const // Vegetarian is the default (A4)
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
export function columnConfig(raw: string | null | undefined): ColumnConfig {
  try {
    const c = JSON.parse(raw || '{}').columns ?? {}
    return Object.fromEntries(
      (Object.keys(DEFAULT_COLUMNS) as OptionalColumn[]).map((k) => [k, { ...DEFAULT_COLUMNS[k], ...c[k] }]),
    ) as ColumnConfig
  } catch {
    return DEFAULT_COLUMNS
  }
}

/** English only for the MVP: Latin letters, spaces and . ' - so every admin and coordinator can read every name. */
export const ENGLISH_NAME = /^[A-Za-z][A-Za-z .'’-]*$/
const englishName = (max: number) =>
  z.string().trim().min(1, 'Required').max(max).regex(ENGLISH_NAME, 'Use English letters only')

export type AgeLimit = { min?: number; max?: number }
export type EventSettings = { capacity: Record<string, number>; ages: Record<string, AgeLimit>; waiver: string; gates: string[]; spot: { open: boolean; cap: number }; approvalRequired: boolean }
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
  return { approvalRequired: c.approvalRequired === true, gates, spot: { open: sp.open === true, cap: Math.max(0, Math.floor(Number(sp.cap) || 0)) }, capacity, ages, waiver: typeof c.waiver === 'string' && c.waiver.trim() ? c.waiver : DEFAULT_WAIVER }
}

export const normalizeMobile = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
const mobile = z.string().transform(normalizeMobile).refine((v) => /^\d{10}$/.test(v), 'Enter a 10-digit mobile number')

export type ParticipantInput = {
  name: string; age: string | number; gender: string; mobile: string; email: string; sports: string[]
  skill: string; diet: string; tshirt: string; accessibility: string; kind: string
}
export const blankRow = (): ParticipantInput => ({
  name: '', age: '', gender: '', mobile: '', email: '', sports: [], skill: '', diet: 'Vegetarian',
  tshirt: '', accessibility: '', kind: 'member',
})

export type RowErrors = Partial<Record<keyof ParticipantInput, string>>

/** Validates one row against the event. Returns cleaned values or per-cell errors. Shared by browser and server. */
export function validateRow(row: ParticipantInput, eventSports: string[], cols: ColumnConfig, ages: Record<string, AgeLimit> = {}) {
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
    else errors.mobile = adult && !row.mobile.trim() ? 'Required for adults' : 'Enter a 10-digit mobile number'
  }
  const email = row.email.trim()
  if (email && !z.email().safeParse(email).success) errors.email = 'Invalid email'
  if (cols.email.show && cols.email.required && !email) errors.email = 'Required'
  if (!row.sports.length) errors.sports = 'Pick at least one sport'
  else if (row.sports.some((s) => !eventSports.includes(s))) errors.sports = 'Unknown sport'
  else if (!errors.age) {
    for (const sp of row.sports) {
      const lim = ages[sp]
      if (lim && ((lim.min && age < lim.min) || (lim.max && age > lim.max))) {
        errors.sports = `${sp} is for ages ${lim.min ?? 1} to ${lim.max ?? 99}`
        break
      }
    }
  }
  if (cols.skill.show && cols.skill.required && !SKILLS.includes(row.skill as never)) errors.skill = 'Choose a level'
  if (row.skill && !SKILLS.includes(row.skill as never)) errors.skill = 'Choose a level'
  if (!DIETS.includes(row.diet as never)) errors.diet = 'Choose a diet'
  if (cols.tshirt.show && cols.tshirt.required && !row.tshirt) errors.tshirt = 'Required'
  if (row.tshirt && !TSHIRTS.includes(row.tshirt as never)) errors.tshirt = 'Invalid size'
  if (cols.accessibility.show && cols.accessibility.required && !row.accessibility.trim()) errors.accessibility = 'Required'
  if (row.accessibility.length > 300) errors.accessibility = 'Too long'
  const ok = Object.keys(errors).length === 0
  return {
    ok,
    errors,
    value: ok
      ? { name, age, gender: row.gender as 'Male' | 'Female', mobile: phone, email, sports: row.sports,
          skill: row.skill, diet: row.diet, tshirt: row.tshirt, accessibility: row.accessibility.trim(),
          kind: row.kind as 'member' | 'guest' }
      : null,
  }
}

export const contactSchema = z.object({
  registrantName: englishName(80),
  registrantMobile: mobile,
  registrantEmail: z.union([z.literal(''), z.email()]),
  emergencyName: englishName(80),
  emergencyMobile: mobile,
  waiver: z.literal(true, { error: 'You must accept the waiver' }),
})

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
      else if (k === 'diet') r.diet = DIETS.find((d) => d.toLowerCase() === v.toLowerCase()) ?? 'Vegetarian'
      else if (v) (r as Record<string, unknown>)[k] = v
    })
    return r
  })
}
