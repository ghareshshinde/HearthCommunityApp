import Link from 'next/link'
import { cookies } from 'next/headers'
import { currentEvent, findRegistrations, getRegistrationById, listParticipantsOfRegistration, stats, listRows, ticketStatus, regState } from '@/lib/repo'
import { canCheckIn, gateCookieName, requireActor } from '@/lib/session'
import { parseTicket } from '@/lib/ticket'
import { eventSettings } from '@/lib/registration/rules'
import { checkInAction, undoCheckInAction } from '@/app/staff-actions'
import { makeTicket } from '@/lib/ticket'
import { formatIst } from '@/lib/time'
import AutoRefresh from '@/components/AutoRefresh'
import GatePicker from '@/components/GatePicker'
import QrScanner from '@/components/QrScanner'
import WalkInForm from '@/components/WalkInForm'
import Pic from '@/components/Pic'

export default async function Gate({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string; q?: string; done?: string; blocked?: string }> }) {
  const { slug } = await params
  const sp = await searchParams
  const { c } = await requireActor(slug, canCheckIn)
  const ev = currentEvent(c.id)
  if (!ev) return <main><h1>Check-in</h1><p>No event yet.</p></main>
  const settings = eventSettings(ev.config)
  const gate = (await cookies()).get(gateCookieName(slug))?.value ?? ''
  const s = stats(listRows(c.id, ev.id))
  const sports: string[] = JSON.parse(ev.sports)

  const regId = sp.t ? parseTicket(sp.t) : null
  const reg = regId ? getRegistrationById(c.id, regId) : undefined
  const results = sp.q ? findRegistrations(c.id, ev.id, sp.q) : []
  const people = reg ? listParticipantsOfRegistration(c.id, reg.id) : []
  const waiting = people.filter((p) => !p.checked_in_at)
  const ts = reg ? ticketStatus(reg, settings.approvalRequired) : null

  return (
    <main style={{ maxWidth: '40rem' }}>
      <AutoRefresh seconds={8} />
      <p><Link href={`/c/${slug}/staff`}>Home</Link></p>
      <h1 style={{ marginBottom: 0 }}>Check-in</h1>
      <p className="muted" style={{ marginTop: 0 }}>{ev.title} · <strong>{s.arrived}</strong> of {s.participants} people in{s.walkIns ? ` · ${s.walkIns} walk-ins` : ''}</p>
      <GatePicker slug={slug} gates={settings.gates} current={gate} />
      {settings.gates.length > 0 && !gate && <p className="warn">Choose which gate this device is at, so each arrival records where it happened.</p>}

      <div style={{ display: 'grid', gap: '.75rem', margin: '1rem 0' }}>
        <QrScanner slug={slug} />
        <form method="get" style={{ display: 'flex', gap: '.5rem' }}>
          <input name="q" defaultValue={sp.q} placeholder="Name, mobile or reference" aria-label="Search" style={{ flexGrow: 1, minHeight: 48 }} />
          <button className="btn">Find</button>
        </form>
      </div>

      {sp.blocked && <p className="warn" role="alert">Nobody was admitted: this ticket is not valid.</p>}
      {sp.done && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}>Done. {sp.done} {sp.done === '1' ? 'person' : 'people'} admitted.</p>}
      {sp.t && !reg && <p className="warn" role="alert">This ticket is not valid for this event. Check the code or search by name.</p>}

      {results.map((r) => (
        <p key={r.id}><Link className="card" style={{ display: 'block' }} href={`/c/${slug}/staff/gate?t=${encodeURIComponent(makeTicket(r.id))}`}><strong>{r.registrant_name}</strong> · {r.ref} <span className="muted">{r.registrant_mobile}</span>{regState(r) !== 'approved' && regState(r) !== 'pending' && <span className="tag" style={{ marginLeft: 8, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>{regState(r)}</span>}</Link></p>
      ))}
      {sp.q && results.length === 0 && <p className="muted">Nobody found for &ldquo;{sp.q}&rdquo;. You can register them as a walk-in below.</p>}

      {reg && (
        <section className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>{reg.registrant_name} <span className="tag">{reg.ref}</span> {reg.source === 'spot' && <span className="tag">walk-in</span>}</h2>
          {ts && !ts.valid && (
            <div role="alert" style={{ margin: '.75rem 0', padding: '1rem', border: '3px solid var(--color-error)', borderRadius: 'var(--radius)', background: '#fef2f2' }}>
              <strong style={{ color: 'var(--color-error)', fontSize: '1.15rem' }}>DO NOT ADMIT: ticket deactivated</strong>
              <p style={{ margin: '.4rem 0 0' }}>{ts.reason}.</p>
              <p className="muted" style={{ margin: '.4rem 0 0' }}>Send them to an admin. If they should still play, register them as a new walk-in below.</p>
            </div>
          )}
          {ts && !ts.valid && people.map((p) => <div key={p.id} className="person muted" style={{ padding: '.4rem 0' }}><span>{p.name}, {p.age}{p.checked_in_at ? ' (was admitted earlier)' : ''}</span></div>)}
          {ts?.valid && (
          <form action={checkInAction.bind(null, slug, sp.t!)}>
            {people.map((p, i) => (
              <div key={p.id} className="person" style={{ padding: '.6rem 0', borderTop: i ? '1px solid var(--color-border)' : 0, minHeight: 56 }}>
                <Pic src={`/img/avatar-${(i % 4) + 1}.svg`} size={44} />
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.6rem', flexGrow: 1, fontSize: '1rem' }}>
                  {p.checked_in_at ? <span style={{ width: 28 }} aria-hidden="true" /> : <input type="checkbox" name="ids" value={p.id} defaultChecked style={{ width: 28, height: 28 }} />}
                  <span><strong>{p.name}</strong>, {p.age}<br /><small className="muted">{p.kind} · {(JSON.parse(p.sports) as string[]).join(', ')}{p.source === 'spot' ? ' · walk-in' : ''}</small></span>
                </label>
                {p.checked_in_at && (
                  <span style={{ textAlign: 'right' }}>
                    <span className="tag" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>In {formatIst(p.checked_in_at, { timeStyle: 'short' })}</span>
                    <small className="muted" style={{ display: 'block' }}>{p.checked_in_gate ? `${p.checked_in_gate}, ` : ''}{p.checked_in_by}</small>
                    <button formAction={undoCheckInAction.bind(null, slug, sp.t!, p.id)} style={{ marginTop: 4 }}>Undo</button>
                  </span>
                )}
              </div>
            ))}
            {waiting.length > 0
              ? <button className="btn" style={{ width: '100%', minHeight: 56, marginTop: '.75rem', fontSize: '1.1rem' }}>Admit selected</button>
              : <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>Everyone on this ticket is already in.</p>}
          </form>
          )}
          {settings.spot.open && ts?.valid && <WalkInForm slug={slug} eventId={ev.id} sports={sports} diets={settings.diets} registrationId={reg.id} ticket={sp.t!} title="Add someone to this family (walk-in)" />}
        </section>
      )}

      {settings.spot.open
        ? <WalkInForm slug={slug} eventId={ev.id} sports={sports} diets={settings.diets} registrationId={null} ticket="" title="New walk-in (separate entry)" />
        : <p className="muted">Spot registration is closed. The admin can open it in the Staff page.</p>}
    </main>
  )
}
