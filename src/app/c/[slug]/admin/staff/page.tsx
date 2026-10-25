import Link from 'next/link'
import { currentEvent, getEvent, stats, listRows } from '@/lib/repo'
import { requireCommunity } from '@/lib/session'
import { coverage, listStaff } from '@/lib/staff'
import { eventSettings } from '@/lib/registration/rules'
import { saveDeskSettingsAction } from '@/app/staff-actions'
import { NewStaffForm, ResetButton, ActiveToggle, StandardSet } from '@/components/StaffAdmin'
import { formatIst } from '@/lib/time'

export default async function StaffAdminPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ event?: string }> }) {
  const { slug } = await params
  const q = await searchParams
  const c = await requireCommunity(slug, true)
  const ev = (q.event ? getEvent(c.id, Number(q.event)) : undefined) ?? currentEvent(c.id)
  if (!ev) return <main><p><Link href={`/c/${slug}/admin`}>Back</Link></p><h1>Staff</h1><p>Create an event first.</p></main>
  const sports: string[] = JSON.parse(ev.sports)
  const cov = coverage(c.id, sports)
  const settings = eventSettings(ev.config)
  const staff = listStaff(c.id)
  const s = stats(listRows(c.id, ev.id))
  const gaps = [...sports.filter((sp) => cov.perSport[sp] < 2).map((sp) => `${sp}: ${cov.perSport[sp]} of 2`), ...(cov.common < 2 ? [`Common sports admins: ${cov.common} of 2`] : []), ...(cov.gate < 1 ? ['No gate volunteer'] : [])]
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back</Link></p>
      <h1>Staff and check-in: {ev.title}</h1>
      <p><strong>{s.arrived}</strong> of {s.participants} people checked in · {s.walkIns} walk-ins · <Link href={`/c/${slug}/staff/gate`}>Open the gate screen</Link></p>

      <section className="card" style={{ margin: '1rem 0' }}>
        <h2 style={{ marginTop: 0 }}>Cover check</h2>
        {gaps.length ? <p className="warn" role="alert">Not enough cover yet: {gaps.join(' · ')}</p> : <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>Every sport has two admins, there are two common sports admins and a gate login.</p>}
        <StandardSet slug={slug} eventId={ev.id} />
      </section>

      <h2>Add one person</h2>
      <NewStaffForm slug={slug} eventId={ev.id} sports={sports} />

      <h2>Everyone with a login</h2>
      <table className="data">
        <thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Invite valid until</th><th>Status</th><th /></tr></thead>
        <tbody>
          {staff.map((m) => (
            <tr key={m.id} style={m.active ? undefined : { opacity: 0.5 }}>
              <td>{m.name}</td><td>{m.role === 'sport' ? `${m.sport} admin` : m.role === 'sports_all' ? 'Common sports admin' : 'Gate volunteer'}</td><td><code>{m.username}</code></td>
              <td>{m.invite_expires_at ? formatIst(m.invite_expires_at) : ''}</td><td>{m.active ? 'active' : 'revoked'}</td>
              <td><ResetButton slug={slug} staffId={m.id} eventId={ev.id} /> <ActiveToggle slug={slug} staffId={m.id} active={!!m.active} /></td>
            </tr>
          ))}
          {staff.length === 0 && <tr><td colSpan={6} className="muted">No staff logins yet.</td></tr>}
        </tbody>
      </table>
      <p className="muted">Staff pages read the same live database as this console, so every admin sees the same arrivals and rosters within seconds, whoever signed in.</p>

      <h2>Check-in points and spot desk</h2>
      <form action={saveDeskSettingsAction.bind(null, slug, ev.id)} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', maxWidth: '32rem' }}>
        <label>Check-in points (one per line, shown on tickets)<textarea name="gates" rows={3} defaultValue={settings.gates.join('\n')} placeholder="Main gate&#10;Side gate" /></label>
        <label style={{ flexDirection: 'row', gap: '.5rem', alignItems: 'center' }}><input type="checkbox" name="spotOpen" defaultChecked={settings.spot.open} />Spot registration is open</label>
        <label>Walk-in limit (0 for none)<input name="spotCap" type="number" min={0} defaultValue={settings.spot.cap} style={{ width: '8rem' }} /></label>
        <p><button className="btn">Save</button></p>
      </form>
    </main>
  )
}
