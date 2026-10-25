import { saveEventAction } from '@/app/actions'
import { DEFAULT_COLUMNS, DEFAULT_SPORTS, columnConfig, type OptionalColumn } from '@/lib/registration/rules'
import { isoToIstInput } from '@/lib/time'
import type { EventRow } from '@/lib/repo'

export default function EventForm({ slug, ev }: { slug: string; ev?: EventRow }) {
  const cols = columnConfig(ev?.config)
  const sports = ev ? (JSON.parse(ev.sports) as string[]) : DEFAULT_SPORTS
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
      <label>Sports (one per line)<textarea name="sports" rows={6} defaultValue={sports.join('\n')} /></label>
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
