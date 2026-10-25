import { describe, expect, it } from 'vitest'
import { DEFAULT_COLUMNS, DEFAULT_SPORTS, blankRow, groupLink, parseRules, rulesFor, eventSettings, isMobile, isEmail, emergencyConflicts, registrantProblems, parseQuestions, columnConfig, normalizeMobile, parsePaste, validateRow } from './rules'

const row = (o = {}) => ({ ...blankRow(), name: 'Asha Shah', age: '34', gender: 'Female', mobile: '98765 43210', sports: ['Chess'], skill: 'casual', ...o })

describe('validateRow', () => {
  it('accepts a valid adult and normalises the mobile', () => {
    const r = validateRow(row(), DEFAULT_SPORTS, DEFAULT_COLUMNS)
    expect(r.ok).toBe(true)
    expect(r.value?.mobile).toBe('9876543210')
  })
  it('strips +91 and leading zero', () => {
    expect(normalizeMobile('+91 98765 43210')).toBe('9876543210')
    expect(normalizeMobile('09876543210')).toBe('9876543210')
  })
  it('requires a mobile for adults but not for children', () => {
    expect(validateRow(row({ mobile: '' }), DEFAULT_SPORTS, DEFAULT_COLUMNS).errors.mobile).toBeTruthy()
    expect(validateRow(row({ mobile: '', age: '9' }), DEFAULT_SPORTS, DEFAULT_COLUMNS).ok).toBe(true)
  })
  it('reports per-cell errors', () => {
    const r = validateRow(row({ name: '', age: '150', gender: '', sports: [], email: 'x' }), DEFAULT_SPORTS, DEFAULT_COLUMNS)
    expect(Object.keys(r.errors).sort()).toEqual(['age', 'email', 'gender', 'name'])
  })
  it('rejects sports the event does not offer', () => {
    expect(validateRow(row({ sports: ['Golf'] }), DEFAULT_SPORTS, DEFAULT_COLUMNS).errors.sports).toBe('Unknown sport')
  })
  it('honours per-event required columns', () => {
    const cols = { ...DEFAULT_COLUMNS, tshirt: { show: true, required: true } }
    expect(validateRow(row(), DEFAULT_SPORTS, cols).errors.tshirt).toBe('Required')
  })
})

describe('English-only names', () => {
  it('rejects Gujarati and Hindi script and digits, allows common name punctuation', () => {
    for (const bad of ['આશા શાહ', 'राज', 'Asha2', '<b>x</b>']) expect(validateRow(row({ name: bad }), DEFAULT_SPORTS, DEFAULT_COLUMNS).errors.name).toBe('Use English letters only')
    for (const ok of ["Mary-Ann O'Neil", 'Dr. Raj K. Shah']) expect(validateRow(row({ name: ok }), DEFAULT_SPORTS, DEFAULT_COLUMNS).ok).toBe(true)
  })
})

describe('parsePaste', () => {
  it('turns tab-separated Excel rows into participant rows', () => {
    const rows = parsePaste('Asha Shah\t34\tfemale\t9876543210\t\tChess, carrom\tcasual\tJain\tM\t\tguest\nRaj\t9\tMale', DEFAULT_SPORTS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ name: 'Asha Shah', gender: 'Female', sports: ['Chess', 'Carrom'], diet: 'Jain', kind: 'guest' })
    expect(rows[1]).toMatchObject({ name: 'Raj', age: '9', kind: 'member', diet: '' })
  })
})

describe('skill per sport and event diets', () => {
  const sports = ['Chess', 'Badminton']
  it('needs a level for every chosen sport and keeps them separate', () => {
    const r = row({ sports: ['Chess', 'Badminton'], skill: '', skills: { Chess: 'beginner' } })
    expect(validateRow(r, sports, DEFAULT_COLUMNS).errors.skill).toMatch(/each sport/)
    const ok = validateRow({ ...r, skills: { Chess: 'beginner', Badminton: 'competitive' } }, sports, DEFAULT_COLUMNS)
    expect(ok.ok).toBe(true)
    expect(ok.value!.skills).toEqual({ Chess: 'beginner', Badminton: 'competitive' })
    expect(ok.value!.skill).toBe('competitive')
  })
  it('asks no diet question unless the event offers options, and only accepts those options', () => {
    const none = validateRow(row({ diet: 'Jain' }), sports, DEFAULT_COLUMNS)
    expect(none.value!.diet).toBe('')
    const cols = columnConfig(JSON.stringify({ diets: ['Jain', 'Vegan'] }))
    expect(cols.diet.show).toBe(true)
    expect(validateRow(row({ diet: 'Jain' }), sports, cols, {}, ['Jain', 'Vegan']).ok).toBe(true)
    expect(validateRow(row({ diet: 'Other' }), sports, cols, {}, ['Jain', 'Vegan']).errors.diet).toBeTruthy()
    expect(columnConfig('{}').diet.show).toBe(false)
  })
})

describe('extra questions', () => {
  const qs = parseQuestions([{ label: 'Blood group', kind: 'choice', options: ['A+', 'B+', ' '], required: true }, { label: '', kind: 'text' }, { label: 'School', kind: 'text', required: false }])
  it('keeps only filled questions and turns an empty choice list into free text', () => {
    expect(qs.map((q) => [q.id, q.label, q.kind])).toEqual([['q1', 'Blood group', 'choice'], ['q3', 'School', 'text']])
    expect(qs[0].options).toEqual(['A+', 'B+'])
  })
  it('enforces required and choice answers and returns the cleaned answers', () => {
    expect(validateRow(row(), ['Chess'], DEFAULT_COLUMNS, {}, [], qs).errors.extra).toMatch(/Blood group is required/)
    expect(validateRow(row({ extra: { q1: 'Z+' } }), ['Chess'], DEFAULT_COLUMNS, {}, [], qs).errors.extra).toMatch(/choose one/)
    const ok = validateRow(row({ extra: { q1: 'A+', q3: ' Sunrise High ', q9: 'ignored' } }), ['Chess'], DEFAULT_COLUMNS, {}, [], qs)
    expect(ok.value!.extra).toEqual({ q1: 'A+', q3: 'Sunrise High' })
  })
})

describe('event and sport rules', () => {
  it('keeps clean text per sport and format, drops empty and oversized entries, and picks what applies to a format', () => {
    const r = parseRules({ general: '  Be on time\r\nNo spikes ', sports: { Badminton: { all: 'Shuttle is provided', singles: '21 points', doubles: '', team: 'x' }, Chess: { all: '   ' }, Cricket: { team: 'y'.repeat(5000) } } })
    expect(r.general).toBe('Be on time\nNo spikes')
    expect(r.sports.Badminton).toEqual({ all: 'Shuttle is provided', singles: '21 points', team: 'x' })
    expect(r.sports.Chess).toBeUndefined()
    expect(r.sports.Cricket.team).toHaveLength(3000)
    expect(rulesFor(r, 'Badminton', 'singles').map((x) => x.text)).toEqual(['Shuttle is provided', '21 points'])
    expect(rulesFor(r, 'Badminton', 'doubles').map((x) => x.text)).toEqual(['Shuttle is provided'])
    expect(rulesFor(r, 'Badminton').map((x) => x.label)).toEqual(['Badminton: all formats', 'Badminton: singles', 'Badminton: team'])
    expect(eventSettings(JSON.stringify({ rules: { general: 'Hi' } })).rules.general).toBe('Hi')
    expect(eventSettings('{}').rules).toEqual({ general: '', sports: {} })
  })
})

describe('sports are optional, mobile and email are checked, formats default to everything allowed', () => {
  it('lets someone attend without playing', () => {
    const r = validateRow(row({ sports: [], skill: '' }), DEFAULT_SPORTS, DEFAULT_COLUMNS)
    expect(r.ok).toBe(true)
    expect(r.value!.sports).toEqual([])
  })
  it('checks mobile and email shapes', () => {
    expect(isMobile('98765 43210')).toBe(true)
    expect(isMobile('+91 9876543210')).toBe(true)
    expect(isMobile('1234567890')).toBe(false)
    expect(isMobile('98765')).toBe(false)
    expect(isEmail('asha@example.com')).toBe(true)
    for (const bad of ['asha', 'asha@', 'asha@example', 'a b@example.com', '@example.com']) expect(isEmail(bad), bad).toBe(false)
    expect(validateRow(row({ mobile: '5876543210' }), DEFAULT_SPORTS, DEFAULT_COLUMNS).errors.mobile).toMatch(/starting 6, 7, 8 or 9/)
    expect(validateRow(row({ mobile: 'abcdefghij' }), DEFAULT_SPORTS, DEFAULT_COLUMNS).errors.mobile).toMatch(/digits only/)
  })
  it('keeps format and partner per sport, defaults to every allowed format, drops a partner for singles-only', () => {
    const ok = validateRow(row({ sports: ['Badminton', 'Chess', 'Cricket'], skill: 'casual', formats: { Badminton: ['doubles'], Cricket: ['team'] }, partners: { Badminton: 'Rahul Mehta', Chess: 'Nobody', Cricket: 'Lotus XI' } }), DEFAULT_SPORTS, DEFAULT_COLUMNS)
    expect(ok.value!.formats).toEqual({ Badminton: ['doubles'], Chess: ['singles'], Cricket: ['team'] })
    expect(ok.value!.partners).toEqual({ Badminton: 'Rahul Mehta', Cricket: 'Lotus XI' })
    expect(validateRow(row({ sports: ['Badminton'], skill: 'casual' }), DEFAULT_SPORTS, DEFAULT_COLUMNS).value!.formats).toEqual({ Badminton: ['singles', 'doubles'] })
    expect(validateRow(row({ sports: ['Badminton'], skill: 'casual', formats: { Badminton: ['doubles'] }, partners: { Badminton: 'आशा' } }), DEFAULT_SPORTS, DEFAULT_COLUMNS).errors.partners).toBeTruthy()
  })
  it('the emergency contact check ignores case and spacing and also compares mobiles', () => {
    const people = [{ name: 'Asha  Shah', mobile: '9876543210' }, { name: 'Kid', mobile: '' }]
    expect(emergencyConflicts('asha shah', '9123456780', people).emergencyName).toBeTruthy()
    expect(emergencyConflicts('Someone Else', '+91 98765-43210', people).emergencyMobile).toBeTruthy()
    expect(emergencyConflicts('Someone Else', '9123456780', people)).toEqual({})
  })
  it('the person registering must be an adult with a mobile and, when required, an email', () => {
    expect(registrantProblems({ name: 'A', age: '12', mobile: '9876543210', email: 'a@b.co' }, true).age).toBeTruthy()
    expect(registrantProblems({ name: 'A', age: '30', mobile: '', email: '' }, true)).toMatchObject({ mobile: expect.any(String), email: expect.any(String) })
    expect(registrantProblems({ name: 'A', age: '30', mobile: '9876543210', email: '' }, false)).toEqual({})
  })
})

describe('updates group links', () => {
  it('accepts only https invite links from WhatsApp or Telegram and drops everything else', () => {
    expect(groupLink('whatsapp', ' https://chat.whatsapp.com/AbC123 ')).toBe('https://chat.whatsapp.com/AbC123')
    expect(groupLink('whatsapp', 'https://whatsapp.com/channel/0029Va')).toBe('https://whatsapp.com/channel/0029Va')
    expect(groupLink('telegram', 'https://t.me/+AbCdEf')).toBe('https://t.me/+AbCdEf')
    for (const bad of ['http://t.me/x', 'https://evil.example/t.me/x', 'https://t.me.evil.example/x', 'javascript:alert(1)', 'https://user:pw@t.me/x', 'https://t.me/', 'not a url', '']) expect(groupLink('telegram', bad), bad).toBe('')
    expect(groupLink('whatsapp', 'https://t.me/x')).toBe('') // each box takes its own app's links
    expect(eventSettings(JSON.stringify({ groups: { whatsapp: 'https://wa.me/123', telegram: 'ftp://t.me/x' } })).groups).toEqual({ whatsapp: 'https://wa.me/123', telegram: '' })
  })
})
