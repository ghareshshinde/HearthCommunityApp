import { saveEventAction } from '@/app/actions'
import { DEFAULT_COLUMNS, DEFAULT_SPORTS, DIETS, columnConfig, eventSettings, type OptionalColumn } from '@/lib/registration/rules'
import { sportFormats, sportIcon } from '@/lib/sports'
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
      <fieldset><legend>Updates group for registered families</legend>
        <p className="muted" style={{ margin: '0 0 .5rem' }}>Paste the invite link of a WhatsApp group or channel, a Telegram group or channel, or both. Registered families see a Join button and a QR code on their registration page, ticket and confirmation email. Only links from whatsapp.com, wa.me or t.me are accepted.</p>
        <div className="fields">
          <label>WhatsApp group or channel link<input type="url" name="group_whatsapp" defaultValue={settings.groups.whatsapp} placeholder="https://chat.whatsapp.com/..." pattern="https://(chat\.whatsapp\.com|www\.whatsapp\.com|whatsapp\.com|wa\.me)/.+" title="A link that starts with https://chat.whatsapp.com/, https://whatsapp.com/channel/ or https://wa.me/" /></label>
          <label>Telegram group or channel link<input type="url" name="group_telegram" defaultValue={settings.groups.telegram} placeholder="https://t.me/..." pattern="https://(t\.me|telegram\.me|telegram\.dog)/.+" title="A link that starts with https://t.me/" /></label>
        </div>
      </fieldset>
      <fieldset><legend>Rules</legend>
        <p className="muted" style={{ margin: '0 0 .5rem' }}>Shown to families on the event page and to coordinators on each category. Plain text; use new lines. Leave empty for none. Rules for a newly added sport can be written after you save it once.</p>
        <label>Rules for the whole event<textarea name="rule_general" rows={4} maxLength={3000} defaultValue={settings.rules.general} placeholder="Dress code, conduct, reporting time, refund and cancellation, safety" /></label>
        {sports.map((sp, i) => (
          <details key={sp} className="card" style={{ margin: '.5rem 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{sp} rules</summary>
            <input type="hidden" name={`rule_sport_${i}`} value={sp} />
            <label>All formats<textarea name={`rule_${i}_all`} rows={3} maxLength={3000} defaultValue={settings.rules.sports[sp]?.all ?? ''} placeholder="Rules that apply to every match of this sport" /></label>
            {sportFormats(sp).includes('singles') && <label>Singles only<textarea name={`rule_${i}_singles`} rows={3} maxLength={3000} defaultValue={settings.rules.sports[sp]?.singles ?? ''} placeholder="Scoring, match length, serving, tie-breaks for singles" /></label>}
            {sportFormats(sp).includes('doubles') && <label>Doubles only<textarea name={`rule_${i}_doubles`} rows={3} maxLength={3000} defaultValue={settings.rules.sports[sp]?.doubles ?? ''} placeholder="Scoring, court size, serving order, partner changes for doubles" /></label>}
            {sportFormats(sp).includes('team') && <label>Team only<textarea name={`rule_${i}_team`} rows={3} maxLength={3000} defaultValue={settings.rules.sports[sp]?.team ?? ''} placeholder="Overs, squad size, substitutions, umpire decisions" /></label>}
          </details>
        ))}
      </fieldset>
      <label style={{ flexDirection: 'row', gap: '.5rem', alignItems: 'center' }}><input type="checkbox" name="contactEmailRequired" defaultChecked={settings.contactEmailRequired} />The registrant&apos;s email is required (their ticket link is sent there)</label>
      <label style={{ flexDirection: 'row', gap: '.5rem', alignItems: 'center' }}><input type="checkbox" name="approvalRequired" defaultChecked={settings.approvalRequired} />QR tickets work only after an admin approves the registration</label>
      <label>Waiver wording<textarea name="waiver" rows={3} defaultValue={settings.waiver} /></label>
      <fieldset><legend>Dietary options</legend>
        <p className="muted" style={{ margin: '0 0 .5rem' }}>Tick what this event offers. If nothing is ticked, the form does not ask about diet.</p>
        {DIETS.map((d) => (
          <label key={d} style={{ flexDirection: 'row', gap: '.5rem' }}><input type="checkbox" name="diet_opt" value={d} defaultChecked={settings.diets.includes(d)} />{d}</label>
        ))}
        <label>Other options (comma separated)<input name="diet_custom" defaultValue={settings.diets.filter((d) => !(DIETS as readonly string[]).includes(d)).join(', ')} placeholder="e.g. Eggetarian" /></label>
      </fieldset>
      <fieldset><legend>Extra questions (asked for each person)</legend>
        <p className="muted" style={{ margin: '0 0 .5rem' }}>Up to five, for example blood group or school. For a pick list, type the choices separated by commas; leave it empty for a free-text answer.</p>
        {Array.from({ length: 5 }, (_, i) => settings.questions[i]).map((q, i) => (
          <div key={i} className="fields" style={{ alignItems: 'end' }}>
            <label>Question {i + 1}<input name={`q_label_${i}`} defaultValue={q?.label ?? ''} maxLength={80} /></label>
            <label>Choices (optional)<input name={`q_options_${i}`} defaultValue={q?.options.join(', ') ?? ''} /></label>
            <label style={{ flexDirection: 'row', gap: '.5rem' }}><input type="checkbox" name={`q_required_${i}`} defaultChecked={q?.required} />Required</label>
          </div>
        ))}
      </fieldset>
      <fieldset><legend>Form columns</legend>
        {(Object.keys(DEFAULT_COLUMNS) as OptionalColumn[]).map((k) => (
          <p key={k}>
            {k === 'diet' ? <span className="muted">Shown when dietary options are ticked above</span> : <label style={{ flexDirection: 'row', gap: '.5rem' }}><input type="checkbox" name={`show_${k}`} defaultChecked={cols[k].show} />Show {k === 'skill' ? 'skill level (asked per sport)' : k}</label>}
            <label style={{ flexDirection: 'row', gap: '.5rem' }}><input type="checkbox" name={`req_${k}`} defaultChecked={cols[k].required} />Required</label>
          </p>
        ))}
      </fieldset>
      <p><button className="btn">Save event</button></p>
    </form>
  )
}
