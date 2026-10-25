import ExcelJS from 'exceljs'
import { cookies } from 'next/headers'
import { checkSession } from '@/lib/auth'
import { audit, getCommunityBySlug, getEvent } from '@/lib/repo'
import { listFeedback } from '@/lib/feedback'
import { cookieName } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = getCommunityBySlug(slug)
  if (!c || !checkSession((await cookies()).get(cookieName(slug))?.value, slug)) return new Response('Unauthorised', { status: 401 })
  const ev = getEvent(c.id, Number(id))
  if (!ev) return new Response('Not found', { status: 404 })
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Feedback')
  ws.columns = [['Reference', 12], ['Overall', 9], ['Organisation', 13], ['Games', 9], ['Favourite game', 16], ['Come again', 12], ['Went well', 50], ['Improve', 50], ['Updated', 22]].map(([header, width]) => ({ header: header as string, width: width as number }))
  ws.getRow(1).font = { bold: true }
  for (const f of listFeedback(c.id, ev.id)) ws.addRow([f.ref, f.overall, f.organisation, f.sports_rating, f.favourite, f.would_return, f.went_well, f.improve, f.updated_at])
  audit(c.id, 'admin', 'export.feedback', String(ev.id))
  return new Response(new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer), {
    headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${slug}-event-${ev.id}-feedback.xlsx"` },
  })
}
