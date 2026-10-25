import { saveEventAction } from '@/app/actions'
import { DEFAULT_COLUMNS, DEFAULT_SPORTS, columnConfig, eventSettings, type OptionalColumn } from '@/lib/registration/rules'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'
import { isoToIstInput } from '@/lib/time'
import type { EventRow } from '@/lib/repo'

export default function EventForm({ slug, ev }: { slug: string; ev?: EventRow }) {
  const cols = columnConfig(ev?.config)
  const sports = ev ? (JSON.parse(ev.sports) as string[]) : DEFAULT_SPORTS
  const settings = eventSettings(ev?.config)
  const sportRows = [...sports, '', '', '']
  return (
    <form action={saveEventAction.bind(null, slug, ev?.id ?? null)} className="card">
      <div className="fields">
        <label>Title<input name="title" defaultValue={ev?.title ?? 'Sports Fiesta'} required /></label>
        <label>Status
          <select name="status" defaultValue={ev?.status ?? 'draft'}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="closed">Closed</option></select>
        </label>
        <label>Starts (IST)<input type="datetime-local" name="starts_at" defaultValue={isoToIstInput(ev?.starts_at ?? null)} /></label>
        <label>Ends (IST)<input type="datetime-local" name="ends_at" defaultValue={isoToIstInput(ev?.ends_at ?? null)} /></label>
        <label>Registration and edit cut-off (IST)<input type="datetime-local" name="cutoff_at" defaultValue={isoToIstInput(ev?.cutoff_at ?? null)} /></label>
        <label>Venue<input name="venue" defaultValue={ev?.venue} /></label>
        <label>Google Maps link<input type="url" name="map_url" defaultValue={ev?.map_url} /></label>
      </div>
      <label>Description<textarea name="description" rows={4} defaultValue={ev?.description} /></label>
      <fieldset><legend>Sports</legend>
        <p className="muted" style={{ margin: '0 0 .5rem' }}>Leave capacity empty for no limit. People past a sport&apos;s capacity are waitlisted for it. Age limits are checked on the form.</p>
        <table className="data">
          <thead><tr><th>Sport</th><th>Capacity</th><th>Min age</th><th>Max age</th></tr></thead>
          <tbody>
            {sportRows.map((sp, i) => (
              <tr key={i}>
                <td style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  {sp && <Pic src={sportIcon(sp)} size={32} />}
                  <input name={`sport_name_${i}`} defaultValue={sp} placeholder="Add a sport" aria-label="Sport name" />
                </td>
                <td><input name={`sport_cap_${i}`} type="number" min={0} defaultValue={settings.capacity[sp] ?? ''} style={{ width: '5rem' }} aria-label="Capacity" /></td>
                <td><input name={`sport_min_${i}`} type="number" min={0} max={99} defaultValue={settings.ages[sp]?.min ?? ''} style={{ width: '4.5rem' }} aria-label="Minimum age" /></td>
                <td><input name={`sport_max_${i}`} type="number" min={0} max={99} defaultValue={settings.ages[sp]?.max ?? ''} style={{ width: '4.5rem' }} aria-label="Maximum age" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      <label>Waiver wording<textarea name="waiver" rows={3} defaultValue={settings.waiver} /></label>
      <fieldset><legend>Form columns</legend>
        {(Object.keys(DEFAULT_COLUMNS) as OptionalColumn[]).map((k) => (
          <p key={k}>
            <label style={{ flexDirection: 'row', gap: '.5rem' }}><input type="checkbox" name={`show_${k}`} defaultChecked={cols[k].show} />Show {k}</label>
            <label style={{ flexDirection: 'row', gap: '.5rem' }}><input type="checkbox" name={`req_${k}`} defaultChecked={cols[k].required} />Required</label>
          </p>
        ))}
      </fieldset>
      <p><button className="btn">Save event</button></p>
    </form>
  )
}
