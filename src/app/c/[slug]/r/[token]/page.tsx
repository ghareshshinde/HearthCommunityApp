import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, getRegistrationByToken, isOpen, listParticipantsOfRegistration, seatsLeft } from '@/lib/repo'
import { columnConfig, eventSettings } from '@/lib/registration/rules'
import { cancelOwnRegistration, editRegistration } from '@/app/actions'
import RegistrationForm from '@/components/RegistrationForm'
import Pic from '@/components/Pic'
import { formatIst } from '@/lib/time'
import { googleCalendarUrl } from '@/lib/calendar'
import { makeTicket } from '@/lib/ticket'

const AVATARS = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4']

export default async function MyRegistration({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug, token } = await params
  const { saved } = await searchParams
  const c = await requireCommunity(slug)
  const reg = getRegistrationByToken(token)
  if (!reg || reg.community_id !== c.id) notFound() // a token from another community never resolves here
  const ev = getEvent(c.id, reg.event_id)!
  const people = listParticipantsOfRegistration(c.id, reg.id)
  const editable = reg.status !== 'cancelled' && isOpen(ev)
  const settings = eventSettings(ev.config)
  const waitlisted = people.filter((p) => (JSON.parse(p.waitlist) as string[]).length)
  return (
    <>
      {saved && <Pic src="/img/celebrate.svg" width={360} height={200} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />}
      <main className="wide">
        <h1>{ev.title}</h1>
        {saved && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}><strong style={{ color: 'var(--color-success)' }}>Registration saved.</strong> Your reference is <strong>{reg.ref}</strong>. Keep this page&apos;s link to edit or cancel. Organisers will verify members and guests and may contact you.</p>}
        {waitlisted.length > 0 && (
          <p className="warn" role="status">
            Some sports are full, so these people are on the waitlist: {waitlisted.map((p) => `${p.name} (${(JSON.parse(p.waitlist) as string[]).join(', ')})`).join('; ')}. The organisers will contact you if a place opens.
          </p>
        )}
        <p>Reference <strong>{reg.ref}</strong> · <span className="tag">{reg.status}</span> · registered {formatIst(reg.created_at)}</p>
        {reg.status !== 'cancelled' && <p><a className="btn" href={`/c/${slug}/t/${makeTicket(reg.id)}`}>Show my QR ticket</a></p>}
        <p><a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Add to Google Calendar</a> · <a href={`/c/${slug}/e/${ev.id}/calendar.ics`}>Download .ics</a></p>
        {reg.status === 'cancelled' && <p className="warn">This registration is cancelled.</p>}
        {editable ? (
          <>
            <RegistrationForm
              slug={slug} eventId={ev.id} sports={JSON.parse(ev.sports)} columns={columnConfig(ev.config)} ages={settings.ages} waiver={settings.waiver}
              seatsLeft={seatsLeft(ev)} draftKey={`edit-${reg.id}`}
              initialRows={people.map((p) => ({ name: p.name, age: String(p.age), gender: p.gender, mobile: p.mobile, email: p.email, sports: JSON.parse(p.sports), skill: p.skill, diet: p.diet, tshirt: p.tshirt, accessibility: p.accessibility, kind: p.kind }))}
              initialContact={{ registrantName: reg.registrant_name, registrantMobile: reg.registrant_mobile, registrantEmail: reg.registrant_email, emergencyName: reg.emergency_name, emergencyMobile: reg.emergency_mobile, waiver: true }}
              submit={editRegistration.bind(null, token)} submitLabel="Save changes"
            />
            <form action={cancelOwnRegistration.bind(null, token)}><button className="btn outline">Cancel registration</button></form>
          </>
        ) : (
          <div className="card">
            {people.map((p, i) => (
              <div key={p.id} className="person" style={{ padding: '.5rem 0', borderTop: i ? '1px solid var(--color-border)' : 0 }}>
                <Pic src={`/img/${AVATARS[i % AVATARS.length]}.svg`} size={36} />
                <span style={{ flexGrow: 1 }}>{p.name}, {p.age}</span><span className="tag">{p.kind}</span><span className="muted">{(JSON.parse(p.sports) as string[]).join(', ')}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
