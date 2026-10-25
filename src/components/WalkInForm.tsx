'use client'
import { useActionState } from 'react'
import { walkInAction, type WalkInState } from '@/app/staff-actions'
import { GENDERS, SKILLS } from '@/lib/registration/rules'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'

type Props = { slug: string; eventId: number; sports: string[]; diets?: string[]; registrationId: number | null; ticket: string; title: string }

/** Spot registration. With a registrationId the person joins that family; without one it is a separate entry with its own contact. */
export default function WalkInForm({ slug, eventId, sports, diets = [], registrationId, ticket, title }: Props) {
  const [state, action, pending] = useActionState<WalkInState | undefined, FormData>(walkInAction.bind(null, slug, eventId, registrationId, ticket), undefined)
  const e = (k: string) => state?.rowErrors?.[k] ?? state?.contactErrors?.[k]
  const v = (k: string) => (state?.values?.[k] as string | undefined) ?? ''
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input name={name} defaultValue={v(name)} {...props} />{e(name) && <small role="alert" className="cellerr">{e(name)}</small>}</label>
  )
  return (
    <details className="card" style={{ marginTop: '1rem' }} open={!!state?.error || !!state?.rowErrors || !!state?.contactErrors || undefined}>
      <summary style={{ fontWeight: 600, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>{title}</summary>
      {/* Re-keyed on every error so the form is rebuilt from the values handed back: React would otherwise clear it. */}
      <form key={state?.values ? JSON.stringify(state.values) : 'new'} action={action} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: '.75rem' }}>
        {field('name', 'Name', { required: true, autoComplete: 'off' })}
        <div className="fields">
          {field('age', 'Age', { inputMode: 'numeric', required: true })}
          <label>Gender<select name="gender" required defaultValue={v('gender')}><option value="" disabled>Select</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>{e('gender') && <small role="alert" className="cellerr">{e('gender')}</small>}</label>
          {field('mobile', 'Mobile (adults)', { inputMode: 'tel' })}
          <label>Skill<select name="skill" defaultValue={v('skill') || 'casual'}>{SKILLS.map((g) => <option key={g}>{g}</option>)}</select></label>
          {diets.length > 0 && <label>Diet<select name="diet" defaultValue={v('diet')}><option value="">Select</option>{diets.map((g) => <option key={g}>{g}</option>)}</select></label>}
          <label>Member or Guest<select name="kind" defaultValue={v('kind') || 'guest'}><option value="guest">Guest</option><option value="member">Member</option></select></label>
        </div>
        <fieldset><legend>Sports</legend>
          <div className="chips">
            {sports.map((s) => <label key={s} className="chip"><input type="checkbox" name="sports" value={s} defaultChecked={((state?.values?.sports as string[] | undefined) ?? []).includes(s)} /><Pic src={sportIcon(s)} size={22} />{s}</label>)}
          </div>
          {e('sports') && <small role="alert" className="cellerr">{e('sports')}</small>}
        </fieldset>
        {!registrationId && (
          <fieldset><legend>Contact</legend>
            <p className="muted" style={{ margin: 0 }}>Under 18? Add a parent or guardian. Adults use their own name and mobile above.</p>
            <div className="fields">
              {field('guardianName', 'Guardian name (under 18)')}{field('guardianMobile', 'Guardian mobile (under 18)', { inputMode: 'tel' })}
              {field('emergencyName', 'Emergency contact name', { required: true })}{field('emergencyMobile', 'Emergency contact mobile', { inputMode: 'tel', required: true })}
            </div>
            {(e('registrantName') || e('registrantMobile')) && <small role="alert" className="cellerr">{e('registrantName') ?? e('registrantMobile')}</small>}
          </fieldset>
        )}
        <label className="waiver"><input type="checkbox" name="waiver" defaultChecked={state?.values?.waiver === 'on'} /> Injury waiver accepted at the desk</label>
        {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
        <button className="btn" disabled={pending} style={{ minHeight: 52 }}>Register and admit</button>
      </form>
    </details>
  )
}
