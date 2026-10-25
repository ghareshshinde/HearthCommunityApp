import { getCommunityBySlug, getEvent } from '@/lib/repo'
import { icsFor } from '@/lib/calendar'

export async function GET(_: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = getCommunityBySlug(slug)
  const ev = c && getEvent(c.id, Number(id))
  if (!c || !ev || ev.status === 'draft') return new Response('Not found', { status: 404 })
  return new Response(icsFor(ev, 'hearth'), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${slug}-event-${ev.id}.ics"` } })
}
