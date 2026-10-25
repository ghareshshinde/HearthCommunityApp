import QRCode from 'qrcode'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, getRegistrationById, listParticipantsOfRegistration } from '@/lib/repo'
import { parseTicket } from '@/lib/ticket'
import { eventSettings } from '@/lib/registration/rules'
import { formatIst } from '@/lib/time'
import { googleCalendarUrl } from '@/lib/calendar'
import TicketOffline from '@/components/TicketOffline'
import Pic from '@/components/Pic'

export default async function Ticket({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const c = await requireCommunity(slug)
  const regId = parseTicket(token)
  const reg = regId ? getRegistrationById(c.id, regId) : undefined
  if (!reg) notFound()
  const ev = getEvent(c.id, reg.event_id)!
  const people = listParticipantsOfRegistration(c.id, reg.id)
  const settings = eventSettings(ev.config)
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
  const svg = await QRCode.toString(`${origin}/c/${slug}/t/${token}`, { type: 'svg', margin: 1, width: 260, errorCorrectionLevel: 'M' })
  return (
    <main style={{ maxWidth: '30rem' }}>
      <TicketOffline />
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="person" style={{ justifyContent: 'center' }}>
          {c.brand.logo && <Pic src={c.brand.logo} size={40} />}<strong>{c.brand.name === 'Hearth' ? c.name : c.brand.name}</strong>
        </div>
        <h1 style={{ margin: '.5rem 0 0' }}>{ev.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{formatIst(ev.starts_at)} · {ev.venue}</p>
        <div role="img" aria-label={`QR code for ticket ${reg.ref}`} style={{ margin: '1rem auto', width: 260, background: '#fff' }} dangerouslySetInnerHTML={{ __html: svg }} />
        <p style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '.05em', margin: 0 }}>{reg.ref}</p>
        <p className="muted">Show this at the gate. One scan admits everyone listed below.</p>
        {settings.gates.length > 0 && <p><strong>Check-in:</strong> {settings.gates.join(' · ')}</p>}
        {ev.map_url && <p><a href={ev.map_url} target="_blank" rel="noreferrer">Open venue in Maps</a> · <a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Add to calendar</a></p>}
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        {people.map((p, i) => (
          <div key={p.id} className="person" style={{ padding: '.5rem 0', borderTop: i ? '1px solid var(--color-border)' : 0 }}>
            <Pic src={`/img/avatar-${(i % 4) + 1}.svg`} size={36} />
            <span style={{ flexGrow: 1 }}>{p.name}, {p.age}<br /><small className="muted">{(JSON.parse(p.sports) as string[]).join(', ')}</small></span>
            {p.checked_in_at ? <span className="tag" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>In at {formatIst(p.checked_in_at, { timeStyle: 'short' })}</span> : <span className="tag">not yet in</span>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: '.85rem' }}>This page is saved on your phone after you open it once, so it works without a connection.</p>
    </main>
  )
}
