import ExcelJS from 'exceljs'
import { formatIst } from './time'
import type { Row } from './repo'
import { extraOf, skillsOf, type Question } from './registration/rules'

const COLS: [string, number, (r: Row) => string | number][] = [
  ['Reference', 12, (r) => r.reg_ref], ['Registered at (IST)', 20, (r) => formatIst(r.registered_at)], ['Registration status', 14, (r) => r.reg_status],
  ['Registrant', 22, (r) => r.registrant_name], ['Registrant mobile', 14, (r) => r.registrant_mobile],
  ['Participant', 24, (r) => r.name], ['Age', 6, (r) => r.age], ['Gender', 9, (r) => r.gender], ['Mobile', 14, (r) => r.mobile], ['Email', 26, (r) => r.email],
  ['Sports', 24, (r) => r.sportList.join(', ')], ['Waitlisted for', 18, (r) => r.waitlistList.join(', ')], ['Skill by sport', 26, (r) => Object.entries(skillsOf(r)).map(([sp, l]) => `${sp}: ${l || '-'}`).join('; ')], ['Diet', 12, (r) => r.diet], ['T-shirt', 8, (r) => r.tshirt],
  ['Accessibility', 24, (r) => r.accessibility], ['Member or Guest', 12, (r) => r.kind], ['Source', 9, (r) => (r.source === 'spot' ? 'Spot' : 'Online')], ['Arrived (IST)', 20, (r) => formatIst(r.checked_in_at)], ['Gate', 12, (r) => r.checked_in_gate ?? ''], ['Checked in by', 16, (r) => r.checked_in_by ?? ''], ['Verified', 9, (r) => (r.verified ? 'Yes' : 'No')],
  ['Emergency contact', 22, (r) => r.emergency_name], ['Emergency mobile', 14, (r) => r.emergency_mobile], ['Waiver accepted (IST)', 20, (r) => formatIst(r.waiver_at)],
]

function sheet(wb: ExcelJS.Workbook, name: string, rows: Row[], questions: Question[]) {
  const cols: typeof COLS = [...COLS, ...questions.map((q): (typeof COLS)[number] => [q.label, 22, (r) => extraOf(r)[q.id] ?? ''])]
  const ws = wb.addWorksheet(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
  ws.columns = cols.map(([header, width]) => ({ header, width }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const r of rows) ws.addRow(cols.map(([, , get]) => get(r)))
}

/** Catering and logistics counts: people registered and people who have arrived, by diet, T-shirt size and sport. */
function counts(wb: ExcelJS.Workbook, rows: Row[]) {
  const ws = wb.addWorksheet('Counts')
  ws.columns = [{ width: 28 }, { width: 14 }, { width: 14 }]
  const live = rows.filter((r) => r.reg_status !== 'cancelled' && !(r.reg_state === 'rejected'))
  const add = (title: string, key: (r: Row) => string[]) => {
    ws.addRow([title, 'Registered', 'Arrived']).font = { bold: true }
    const m = new Map<string, [number, number]>()
    for (const r of live) for (const k of key(r)) { const v = m.get(k) ?? [0, 0]; v[0]++; if (r.checked_in_at) v[1]++; m.set(k, v) }
    for (const [k, v] of [...m].sort((a, b) => a[0].localeCompare(b[0]))) ws.addRow([k, v[0], v[1]])
    ws.addRow([])
  }
  add('Everyone', () => ['All people'])
  add('Member or guest', (r) => [r.kind])
  add('Meals by diet', (r) => [r.diet || 'No diet chosen'])
  add('T-shirt sizes', (r) => [r.tshirt || 'No size'])
  add('Sports (not waitlisted)', (r) => r.sportList.filter((s) => !r.waitlistList.includes(s)))
}

/** RW6/RW7/R1: one "All" sheet plus one tab per sport. Strings are stored as UTF-8 shared strings, so Hindi and Gujarati survive. */
export async function buildWorkbook(rows: Row[], sports: string[], questions: Question[] = []): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  counts(wb, rows)
  sheet(wb, 'All participants', rows, questions)
  for (const s of sports) sheet(wb, s, rows.filter((r) => r.sportList.includes(s)), questions)
  return Buffer.from(await wb.xlsx.writeBuffer())
}
