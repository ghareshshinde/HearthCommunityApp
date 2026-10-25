import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, getRegistrationByToken, isOpen, listParticipantsOfRegistration, seatsLeft, ticketStatus } from '@/lib/repo'
import { columnConfig, eventSettings, skillsOf, extraOf } from '@/lib/registration/rules'
import { cancelOwnRegistration, editRegistration } from '@/app/actions'
import RegistrationForm from '@/components/RegistrationForm'
import Pic from '@/components/Pic'
import SaveLink from '@/components/SaveLink'
import { formatIst } from '@/lib/time'
import { googleCalendarUrl } from '@/lib/calendar'
import { makeTicket } from '@/lib/ticket'
import { feedbackOpen } from '@/lib/feedback'

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
  const ts = ticketStatus(reg, settings.approvalRequired)
  const waitlisted = people.filter((p) => (JSON.parse(p.waitlist) as string[]).length)
  return (
    <>
      {saved && <Pic src="/img/celebrate.svg" width={360} height={200} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />}
      <main className="wide">
        <h1>{ev.title}</h1>
        {saved && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}><strong style={{ color: 'var(--color-success)' }}>Registration saved.</strong> Your reference is <strong>{reg.ref}</strong>. Keep this page&apos;s link to edit or cancel. Organisers will verify members and guests and may contact you.</p>}
        {saved && ts.state !== 'rejected' && <SaveLink reference={reg.ref} title={ev.title} />}
        {waitlisted.length > 0 && (
          <p className="warn" role="status">
            Some sports are full, so these people are on the waitlist: {waitlisted.map((p) => `${p.name} (${(JSON.parse(p.waitlist) as string[]).join(', ')})`).join('; ')}. The organisers will contact you if a place opens.
          </p>
        )}
        <p>Reference <strong>{reg.ref}</strong> · <span className="tag">{ts.state}</span> · registered {formatIst(reg.created_at)}</p>
        {feedbackOpen(ev) && reg.status !== 'cancelled' && <p className="card"><strong>How was the event?</strong> <a className="btn gold" href={`/c/${slug}/r/${token}/feedback`}>Give feedback</a></p>}
        {ts.valid && <p><a className="btn" href={`/c/${slug}/t/${makeTicket(reg.id)}`}>Show my QR ticket</a></p>}
        <p><a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Add to Google Calendar</a> · <a href={`/c/${slug}/e/${ev.id}/calendar.ics`}>Download .ics</a></p>
        {ts.state === 'rejected' && <p className="warn" role="alert"><strong>Your registration was not approved.</strong> {reg.decision_note ? `Reason: ${reg.decision_note}. ` : ''}Your QR ticket no longer works. Please contact the organisers if you think this is a mistake.</p>}
        {ts.state === 'cancelled' && <p className="warn">This registration is cancelled and its QR ticket no longer works.</p>}
        {ts.state === 'pending' && <p className="card" role="status">Waiting for the organisers to approve your registration. You can still edit it until the cut-off.</p>}
        {editable ? (
          <>
            <RegistrationForm
              slug={slug} eventId={ev.id} sports={JSON.parse(ev.sports)} columns={columnConfig(ev.config)} ages={settings.ages} diets={settings.diets} questions={settings.questions} waiver={settings.waiver} emailRequired={settings.contactEmailRequired}
              seatsLeft={seatsLeft(ev)} draftKey={`edit-${reg.id}`}
              initialRows={people.map((p) => ({ name: p.name, age: String(p.age), gender: p.gender, mobile: p.mobile, email: p.email, sports: JSON.parse(p.sports), skill: '', skills: skillsOf(p), extra: extraOf(p), diet: p.diet, tshirt: p.tshirt, accessibility: p.accessibility, kind: p.kind }))}
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
