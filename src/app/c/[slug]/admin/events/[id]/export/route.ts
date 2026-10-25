import { cookies } from 'next/headers'
import { checkSession } from '@/lib/auth'
import { audit, filterRows, getCommunityBySlug, getEvent, listRows, type Filters } from '@/lib/repo'
import { buildWorkbook } from '@/lib/export'
import { cookieName } from '@/lib/session'
import { eventSettings } from '@/lib/registration/rules'

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = getCommunityBySlug(slug)
  if (!c || !checkSession((await cookies()).get(cookieName(slug))?.value, slug)) return new Response('Unauthorised', { status: 401 })
  const ev = getEvent(c.id, Number(id))
  if (!ev) return new Response('Not found', { status: 404 })
  const f = Object.fromEntries(new URL(req.url).searchParams) as Filters
  const rows = filterRows(listRows(c.id, ev.id), f)
  audit(c.id, 'admin', 'export.excel', String(ev.id), { rows: rows.length, filters: f })
  const buf = await buildWorkbook(rows, JSON.parse(ev.sports), eventSettings(ev.config).questions)
  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${slug}-event-${ev.id}-registrations.xlsx"`,
    },
  })
}
