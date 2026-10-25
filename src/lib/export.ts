import ExcelJS from 'exceljs'
import { formatIst } from './time'
import type { Row } from './repo'

const COLS: [string, number, (r: Row) => string | number][] = [
  ['Reference', 12, (r) => r.reg_ref], ['Registered at (IST)', 20, (r) => formatIst(r.registered_at)], ['Registration status', 14, (r) => r.reg_status],
  ['Registrant', 22, (r) => r.registrant_name], ['Registrant mobile', 14, (r) => r.registrant_mobile],
  ['Participant', 24, (r) => r.name], ['Age', 6, (r) => r.age], ['Gender', 9, (r) => r.gender], ['Mobile', 14, (r) => r.mobile], ['Email', 26, (r) => r.email],
  ['Sports', 24, (r) => r.sportList.join(', ')], ['Skill', 12, (r) => r.skill], ['Diet', 12, (r) => r.diet], ['T-shirt', 8, (r) => r.tshirt],
  ['Accessibility', 24, (r) => r.accessibility], ['Member or Guest', 12, (r) => r.kind], ['Verified', 9, (r) => (r.verified ? 'Yes' : 'No')],
  ['Emergency contact', 22, (r) => r.emergency_name], ['Emergency mobile', 14, (r) => r.emergency_mobile], ['Waiver accepted (IST)', 20, (r) => formatIst(r.waiver_at)],
]

function sheet(wb: ExcelJS.Workbook, name: string, rows: Row[]) {
  const ws = wb.addWorksheet(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
  ws.columns = COLS.map(([header, width]) => ({ header, width }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const r of rows) ws.addRow(COLS.map(([, , get]) => get(r)))
}

/** RW6/RW7/R1: one "All" sheet plus one tab per sport. Strings are stored as UTF-8 shared strings, so Hindi and Gujarati survive. */
export async function buildWorkbook(rows: Row[], sports: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  sheet(wb, 'All participants', rows)
  for (const s of sports) sheet(wb, s, rows.filter((r) => r.sportList.includes(s)))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
