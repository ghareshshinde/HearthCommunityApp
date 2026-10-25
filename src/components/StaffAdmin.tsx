'use client'
import { useActionState } from 'react'
import { createStaffAction, resetStaffAction, seedStaffAction, setStaffActiveAction, type Issued, type StaffState } from '@/app/staff-actions'
import { formatIst } from '@/lib/time'

const roleLabel = (role: string, sport: string | null) => (role === 'sport' ? `${sport} admin` : role === 'sports_all' ? 'Common sports admin (all sports)' : 'Gate volunteer')

/** Credentials are shown once, here, because only hashes are stored. */
export function IssuedSheet({ issued }: { issued: Issued[] }) {
  return (
    <section className="card" role="status" style={{ borderColor: 'var(--color-warning)' }}>
      <h2 style={{ marginTop: 0 }}>Copy these now. They are not shown again.</h2>
      <p className="muted">Each person can use the link (one tap) or the username and password. Links stop working after the date shown or if you reset or revoke them.</p>
      <table className="data">
        <thead><tr><th>Person</th><th>Username</th><th>Password</th><th>Invite link</th><th>Link valid until</th></tr></thead>
        <tbody>
          {issued.map((i) => (
            <tr key={i.username}><td>{roleLabel(i.role, i.sport)}</td><td><code>{i.username}</code></td><td><code>{i.password}</code></td><td style={{ wordBreak: 'break-all' }}><code>{i.invite}</code></td><td>{formatIst(i.expires)}</td></tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => window.print()}>Print this sheet</button>
    </section>
  )
}

export function NewStaffForm({ slug, eventId, sports }: { slug: string; eventId: number; sports: string[] }) {
  const [state, action, pending] = useActionState<StaffState | undefined, FormData>(createStaffAction.bind(null, slug), undefined)
  return (
    <>
      <form action={action} className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'flex-end' }}>
        <input type="hidden" name="eventId" value={eventId} />
        <label>Name<input name="name" placeholder="e.g. Rohan (Badminton)" /></label>
        <label>Role
          <select name="role" defaultValue="sport">
            <option value="sport">Sport admin</option><option value="sports_all">Common sports admin</option><option value="gate">Gate volunteer</option>
          </select>
        </label>
        <label>Sport (sport admins)<select name="sport" defaultValue="">{[<option key="" value="">None</option>, ...sports.map((s) => <option key={s}>{s}</option>)]}</select></label>
        <button className="btn" disabled={pending}>Create login and invite</button>
        {state?.error && <p role="alert" className="cellerr" style={{ width: '100%' }}>{state.error}</p>}
      </form>
      {state?.issued && <IssuedSheet issued={state.issued} />}
    </>
  )
}

export function StandardSet({ slug, eventId }: { slug: string; eventId: number }) {
  const [state, action, pending] = useActionState<StaffState | undefined, FormData>(seedStaffAction.bind(null, slug), undefined)
  return (
    <>
      <form action={action}>
        <input type="hidden" name="eventId" value={eventId} />
        <button className="btn" disabled={pending}>Create the standard set</button>
        <span className="muted"> Two admins for every sport, two common sports admins and two gate logins. Only fills what is missing.</span>
        {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      </form>
      {state?.issued && (state.issued.length ? <IssuedSheet issued={state.issued} /> : <p role="status">Everything is already covered.</p>)}
    </>
  )
}

export function ResetButton({ slug, staffId, eventId }: { slug: string; staffId: number; eventId: number }) {
  const [state, action, pending] = useActionState<StaffState | undefined, FormData>(resetStaffAction.bind(null, slug, staffId), undefined)
  return (
    <>
      <form action={action} style={{ display: 'inline' }}>
        <input type="hidden" name="eventId" value={eventId} />
        <button disabled={pending} title="New password and link; the old ones stop working">Reset</button>
      </form>
      {state?.issued && <IssuedSheet issued={state.issued} />}
    </>
  )
}

export function ActiveToggle({ slug, staffId, active }: { slug: string; staffId: number; active: boolean }) {
  return <form action={setStaffActiveAction.bind(null, slug, staffId, !active)} style={{ display: 'inline' }}><button>{active ? 'Revoke' : 'Re-enable'}</button></form>
}
