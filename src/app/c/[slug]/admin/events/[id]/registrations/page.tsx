import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { filterRows, getEvent, listRows, stats, type Filters } from '@/lib/repo'
import { bulkActionForm } from '@/app/actions'
import { GENDERS, TSHIRTS, eventSettings, extraOf, skillsOf } from '@/lib/registration/rules'
import { formatIst } from '@/lib/time'
import EditableCell from '@/components/EditableCell'
import ConfirmButton from '@/components/ConfirmButton'

export default async function Registrations({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Filters> }) {
  const { slug, id } = await params
  const f = await searchParams
  const c = await requireCommunity(slug, true)
  const ev = getEvent(c.id, Number(id))
  const diets = ev ? eventSettings(ev.config).diets : []
  const questions = ev ? eventSettings(ev.config).questions : []
  if (!ev) notFound()
  const sports = JSON.parse(ev.sports) as string[]
  const all = listRows(c.id, ev.id)
  const rows = filterRows(all, f)
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString()
  const s = stats(rows)
  const opt = (name: keyof Filters, label: string, values: readonly string[]) => (
    <label>{label}<select name={name} defaultValue={f[name] ?? ''}><option value="">All</option>{values.map((v) => <option key={v}>{v}</option>)}</select></label>
  )
  const base = `/c/${slug}/admin/events/${ev.id}`
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back</Link></p>
      <h1>{ev.title}: registrations</h1>
      <form className="fields" method="get">
        <label>Search<input name="q" defaultValue={f.q} placeholder="Name, mobile, reference" /></label>
        {opt('sport', 'Sport', sports)}{opt('gender', 'Gender', GENDERS)}{opt('kind', 'Member or guest', ['member', 'guest'])}
        {diets.length > 0 && opt('diet', 'Diet', diets)}{opt('status', 'Registration status', ['pending', 'approved', 'rejected', 'cancelled'])}{opt('verified', 'Verified', ['yes', 'no'])}{opt('arrived', 'Arrived', ['yes', 'no'])}{opt('source', 'Source', ['online', 'spot'])}
        <label>Min age<input name="minAge" defaultValue={f.minAge} inputMode="numeric" /></label>
        <label>Max age<input name="maxAge" defaultValue={f.maxAge} inputMode="numeric" /></label>
        <label>Sort by<select name="sort" defaultValue={f.sort ?? 'registered_at'}>{['registered_at', 'name', 'age', 'gender', 'kind', 'reg_ref', 'diet'].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Order<select name="dir" defaultValue={f.dir ?? 'asc'}><option>asc</option><option>desc</option></select></label>
        <p><button className="btn">Apply</button> <Link href={base + '/registrations'}>Clear</Link> · <a href={`${base}/export?${qs}`}>Download Excel ({rows.length} rows, per-sport tabs)</a></p>
      </form>
      <p aria-live="polite"><strong>{rows.length}</strong> of {all.length} shown · {s.members} members · {s.guests} guests · {s.verified} verified</p>

      <form action={bulkActionForm.bind(null, slug, ev.id)}>
        <input type="hidden" name="qs" value={qs} />
        <p>
          <label style={{ flexDirection: 'row', gap: '.5rem', alignItems: 'center' }}>With selected:
            <select name="action">
              <option value="verify">Mark verified</option><option value="unverify">Clear verified</option>
              <option value="confirm">Approve (or reinstate) registration</option><option value="reject">Reject registration (QR stops working)</option><option value="cancel">Cancel registration (QR stops working)</option>
              <option value="member">Set as member</option><option value="guest">Set as guest</option><option value="promote">Move off waitlist</option>
            </select>
            <input name="note" placeholder="Reason or note (shown to the registrant on rejection)" aria-label="Reason" style={{ minWidth: '16rem' }} />
            <ConfirmButton message="Apply this action to all selected rows?">Apply to selected</ConfirmButton>
          </label>
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead><tr><th /><th>Ref</th><th>Registered (IST)</th><th>Name</th><th>Age</th><th>Gender</th><th>Mobile</th><th>Sports</th><th>Skill</th><th>Diet</th><th>T-shirt</th><th>Access.</th>{questions.map((q) => <th key={q.id}>{q.label}</th>)}<th>Type</th><th>Verified</th><th>Arrived</th><th>Status</th><th>Registrant</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.reg_status === 'cancelled' ? { opacity: 0.5 } : undefined}>
                  <td><input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.name}`} /></td>
                  <td>{r.reg_ref}</td><td>{formatIst(r.registered_at)}</td>
                  <td><EditableCell slug={slug} id={r.id} field="name" value={r.name} /></td>
                  <td><EditableCell slug={slug} id={r.id} field="age" value={String(r.age)} /></td>
                  <td><EditableCell slug={slug} id={r.id} field="gender" value={r.gender} options={[...GENDERS]} /></td>
                  <td><EditableCell slug={slug} id={r.id} field="mobile" value={r.mobile} /></td>
                  <td><EditableCell slug={slug} id={r.id} field="sports" value={r.sportList.join(', ')} />{r.waitlistList.length > 0 && <small className="wl"> waitlist: {r.waitlistList.join(', ')}</small>}</td>
                  <td>{r.sportList.map((sp) => `${sp}: ${skillsOf(r)[sp] || "-"}`).join(", ")}</td>
                  <td><EditableCell slug={slug} id={r.id} field="diet" value={r.diet} options={["", ...diets]} /></td>
                  <td><EditableCell slug={slug} id={r.id} field="tshirt" value={r.tshirt} options={['', ...TSHIRTS]} /></td>
                  <td><EditableCell slug={slug} id={r.id} field="accessibility" value={r.accessibility} /></td>
                  {questions.map((q) => <td key={q.id}>{extraOf(r)[q.id] ?? ''}</td>)}
                  <td><EditableCell slug={slug} id={r.id} field="kind" value={r.kind} options={['member', 'guest']} /></td>
                  <td>{r.verified ? 'Yes' : 'No'}</td><td>{r.checked_in_at ? formatIst(r.checked_in_at, { timeStyle: 'short' }) : ''}{r.source === 'spot' ? ' (walk-in)' : ''}</td><td><span className="tag">{r.reg_state}</span>{r.reg_note && <small className="muted" style={{ display: 'block' }}>{r.reg_note}</small>}</td>
                  <td>{r.registrant_name}<br />{r.registrant_mobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </main>
  )
}
