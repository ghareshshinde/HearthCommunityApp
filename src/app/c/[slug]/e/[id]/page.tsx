import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, isOpen } from '@/lib/repo'
import { formatIst } from '@/lib/time'
import { googleCalendarUrl } from '@/lib/calendar'
import ShareButton from '@/components/ShareButton'

export default async function EventPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug)
  const ev = getEvent(c.id, Number(id))
  if (!ev || ev.status === 'draft') notFound()
  const sports = JSON.parse(ev.sports) as string[]
  return (
    <main>
      <h1>{ev.title}</h1>
      <p className="muted">{formatIst(ev.starts_at)} to {formatIst(ev.ends_at)}</p>
      <p>{ev.venue} {ev.map_url && <a href={ev.map_url} target="_blank" rel="noreferrer">Map</a>}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</p>
      <p>{sports.map((s) => <span key={s} className="tag">{s}</span>)}</p>
      {ev.cutoff_at && <p className="muted">Registration and edits close {formatIst(ev.cutoff_at)} IST.</p>}
      <p>
        {isOpen(ev) ? <Link className="btn" href={`/c/${slug}/e/${id}/register`}>Register</Link> : <strong>Registration is closed.</strong>}{' '}
        <a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Add to Google Calendar</a> · <a href={`/c/${slug}/e/${id}/calendar.ics`}>Download .ics</a>
      </p>
      <ShareButton title={ev.title} />
    </main>
  )
}
