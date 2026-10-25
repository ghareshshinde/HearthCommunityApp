import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, getRegistrationByToken, isOpen, listParticipantsOfRegistration } from '@/lib/repo'
import { columnConfig } from '@/lib/registration/rules'
import { cancelOwnRegistration, editRegistration } from '@/app/actions'
import RegistrationForm from '@/components/RegistrationForm'
import { formatIst } from '@/lib/time'
import { googleCalendarUrl } from '@/lib/calendar'

export default async function MyRegistration({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug, token } = await params
  const { saved } = await searchParams
  const c = await requireCommunity(slug)
  const reg = getRegistrationByToken(token)
  if (!reg || reg.community_id !== c.id) notFound() // a token from another community never resolves here
  const ev = getEvent(c.id, reg.event_id)!
  const people = listParticipantsOfRegistration(c.id, reg.id)
  const editable = reg.status !== 'cancelled' && isOpen(ev)
  return (
    <main className="wide">
      <h1>{ev.title}</h1>
      {saved && <p className="card" role="status">Registration saved. Your reference is <strong>{reg.ref}</strong>. Keep this page&apos;s link to edit or cancel. Organisers will verify members and guests and may contact you.</p>}
      <p>Reference <strong>{reg.ref}</strong> · <span className="tag">{reg.status}</span> · registered {formatIst(reg.created_at)}</p>
      <p><a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Add to Google Calendar</a> · <a href={`/c/${slug}/e/${ev.id}/calendar.ics`}>Download .ics</a></p>
      {reg.status === 'cancelled' && <p className="warn">This registration is cancelled.</p>}
      {editable ? (
        <>
          <RegistrationForm
            slug={slug} eventId={ev.id} sports={JSON.parse(ev.sports)} columns={columnConfig(ev.config)} draftKey={`edit-${reg.id}`}
            initialRows={people.map((p) => ({ name: p.name, age: String(p.age), gender: p.gender, mobile: p.mobile, email: p.email, sports: JSON.parse(p.sports), skill: p.skill, diet: p.diet, tshirt: p.tshirt, accessibility: p.accessibility, kind: p.kind }))}
            initialContact={{ registrantName: reg.registrant_name, registrantMobile: reg.registrant_mobile, registrantEmail: reg.registrant_email, emergencyName: reg.emergency_name, emergencyMobile: reg.emergency_mobile, waiver: true }}
            submit={editRegistration.bind(null, token)} submitLabel="Save changes"
          />
          <form action={cancelOwnRegistration.bind(null, token)}><button className="btn outline">Cancel registration</button></form>
        </>
      ) : (
        <table className="data"><tbody>{people.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.age}</td><td>{p.kind}</td><td>{JSON.parse(p.sports).join(', ')}</td></tr>)}</tbody></table>
      )}
    </main>
  )
}
