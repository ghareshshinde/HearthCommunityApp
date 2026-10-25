'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ENGLISH_NAME, GENDERS, SKILLS, SOFT_LIMIT, TSHIRTS, blankRow, emergencyConflicts, isEmail, isMobile, parsePaste, registrantProblems, validateRow,
  type ColumnConfig, type ParticipantInput, type Question, type RowErrors,
} from '@/lib/registration/rules'
import type { Contact, SubmitResult } from '@/lib/repo'
import Pic from '@/components/Pic'
import { sportFormats, sportIcon } from '@/lib/sports'
import { suggestEmail } from '@/lib/registration/rules'

type Props = {
  slug: string
  eventId: number
  sports: string[]
  columns: ColumnConfig
  ages?: Record<string, { min?: number; max?: number }>
  diets?: string[]
  questions?: Question[]
  waiver: string
  emailRequired?: boolean
  seatsLeft: Record<string, number | null>
  initialRows?: ParticipantInput[]
  initialContact?: Partial<Contact>
  submit: (contact: Contact, rows: ParticipantInput[]) => Promise<SubmitResult>
  submitLabel: string
  draftKey?: string
}

const DRAFT_DAYS = 7
const NO_AGES = {}
const NO_DIETS: string[] = []
const NO_QUESTIONS: Question[] = []

export default function RegistrationForm({ slug, eventId, sports, columns, ages = NO_AGES, diets = NO_DIETS, questions = NO_QUESTIONS, waiver, emailRequired = true, seatsLeft, initialRows, initialContact, submit, submitLabel, draftKey }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ParticipantInput[]>(initialRows?.length ? initialRows : [blankRow()])
  const [contact, setContact] = useState<Contact>({ registrantName: '', registrantMobile: '', registrantEmail: '', emergencyName: '', emergencyMobile: '', waiver: false, ...initialContact })
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({})
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false) // buttons stay off until the page can respond to them
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<number | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  // A field shows its problem once the person leaves it, or stops typing for a moment: mistakes appear while they can still fix them.
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const touch = (k: string) => setTouched((t) => (t.has(k) ? t : new Set(t).add(k)))
  const touchSoon = (k: string) => { clearTimeout(timers.current[k]); timers.current[k] = setTimeout(() => touch(k), 700) }
  const tableRef = useRef<HTMLTableElement>(null)
  // One key per form visit: a repeated submit (double tap, retry) returns the first registration instead of making another.
  const [submissionKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`))
  const key = draftKey ?? `hearth-draft-${eventId}`

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setReady(true), [])
  // TR9: draft kept 7 days in this browser.
  useEffect(() => {
    if (initialRows) return
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (d && Date.now() - d.at < DRAFT_DAYS * 86400_000) {
        // localStorage exists only in the browser, so restoring must happen after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRows((d.rows as ParticipantInput[]).map((r) => ({ ...blankRow(), ...r }))); setContact(d.contact); setDraftNote('Draft restored')
      }
    } catch { /* storage unavailable */ }
  }, [key, initialRows])
  useEffect(() => {
    if (initialRows) return
    const t = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), rows, contact })) } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [rows, contact, key, initialRows])

  const live = useMemo(() => rows.map((r) => validateRow(r, sports, columns, ages, diets, questions)), [rows, sports, columns, ages, diets, questions])
  const registrant = useMemo(() => registrantProblems(rows[0] ?? blankRow(), emailRequired), [rows, emailRequired])
  const conflicts = useMemo(() => emergencyConflicts(contact.emergencyName, contact.emergencyMobile, rows), [contact.emergencyName, contact.emergencyMobile, rows])
  const emName = !contact.emergencyName.trim() ? 'Required' : !ENGLISH_NAME.test(contact.emergencyName.trim()) ? 'Use English letters only' : conflicts.emergencyName
  const emMobile = !contact.emergencyMobile.trim() ? 'Required' : !isMobile(contact.emergencyMobile) ? 'Enter a 10-digit mobile number starting 6, 7, 8 or 9' : conflicts.emergencyMobile
  // Columns in the table, for the full-width games row under each person.
  const gridCols = 6 + (columns.diet.show ? 1 : 0) + (columns.tshirt.show ? 1 : 0) + (columns.accessibility.show ? 1 : 0) + questions.length + 2
  const summary = {
    participants: rows.length,
    members: rows.filter((r) => r.kind === 'member').length,
    guests: rows.filter((r) => r.kind === 'guest').length,
    sports: new Set(rows.flatMap((r) => r.sports)).size,
    playing: rows.filter((r) => r.sports.length).length,
  }

  const set = (i: number, k: keyof ParticipantInput, v: string | string[]) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
    touchSoon(`${i}:${k}`)
  }
  const patchRow = (i: number, f: (r: ParticipantInput) => ParticipantInput) => setRows((rs) => rs.map((r, j) => (j === i ? f(r) : r)))
  /** Ticking a sport starts with the sport's first format (singles, or team); the person can add doubles. */
  const toggleSport = (i: number, sp: string, on: boolean) => patchRow(i, (r) => on
    ? { ...r, sports: [...r.sports, sp], formats: { ...r.formats, [sp]: [sportFormats(sp)[0]] } }
    : { ...r, sports: r.sports.filter((x) => x !== sp) })
  const toggleFormat = (i: number, sp: string, fmt: string, on: boolean) => patchRow(i, (r) => {
    const cur = r.formats[sp]?.length ? r.formats[sp] : [sportFormats(sp)[0]]
    const next = on ? [...new Set([...cur, fmt])] : cur.filter((f) => f !== fmt)
    return next.length ? { ...r, formats: { ...r.formats, [sp]: next } } : r // one format always stays chosen
  })
  /** Brings the row at `index` into view, highlights it for a moment and puts the cursor in its name cell. */
  const show = (index: number) => {
    setFlash(index)
    setTimeout(() => {
      const el = tableRef.current?.querySelector<HTMLElement>(`[data-row="${index}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // Move the cursor to the new row only if the person has not already clicked into another field.
      const ae = document.activeElement as HTMLElement | null
      if (!ae || ae === document.body || ae.closest('button')) tableRef.current?.querySelector<HTMLElement>(`[data-r="${index}"][data-c="name"]`)?.focus({ preventScroll: true })
    }, 60)
    setTimeout(() => setFlash(null), 1600)
  }
  const addRow = () => { setRows((rs) => [...rs, blankRow()]); show(rows.length); setNote(`Person ${rows.length + 1} added`) }
  const dup = (i: number) => {
    setRows((rs) => [...rs.slice(0, i + 1), { ...rs[i], sports: [...rs[i].sports], skills: { ...rs[i].skills }, formats: { ...rs[i].formats }, partners: {}, extra: { ...rs[i].extra }, name: '', mobile: '', email: '' }, ...rs.slice(i + 1)])
    show(i + 1); setNote(`Person ${i + 1} duplicated: enter the new name`)
  }
  const del = (i: number) => {
    setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blankRow()]))
    setRowErrors({}); setNote(rows.length > 1 ? `Person ${i + 1} removed` : 'Row cleared')
  }

  // TR6: arrows move between rows in the same column; Enter in the last row adds a row.
  function onKey(e: React.KeyboardEvent, i: number, c: string) {
    const t = e.target as HTMLElement
    if (e.key === 'Enter' && t.tagName !== 'BUTTON' && t.tagName !== 'TEXTAREA') {
      e.preventDefault()
      if (i === rows.length - 1) addRow()
      else tableRef.current?.querySelector<HTMLElement>(`[data-r="${i + 1}"][data-c="${c}"]`)?.focus()
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && t.tagName !== 'SELECT') {
      const n = i + (e.key === 'ArrowDown' ? 1 : -1)
      const target = tableRef.current?.querySelector<HTMLElement>(`[data-r="${n}"][data-c="${c}"]`)
      if (target) { e.preventDefault(); target.focus() }
    }
  }
  function onPaste(e: React.ClipboardEvent, i: number) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()
    const parsed = parsePaste(text, sports)
    setRows((rs) => {
      const empty = rs.every((r) => !r.name && !r.age)
      return empty ? parsed : [...rs.slice(0, i), ...parsed, ...rs.slice(i + (rs[i].name ? 0 : 1))]
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShowErrors(true); setFormError('')
    const errs: Record<number, RowErrors> = {}
    live.forEach((v, i) => { if (!v.ok) errs[i] = v.errors })
    for (const k of ['name', 'age', 'mobile', 'email'] as const) if (registrant[k]) errs[0] = { ...(errs[0] ?? {}), [k]: registrant[k] }
    setRowErrors(errs)
    const first = Object.keys(errs).map(Number).sort((x, y) => x - y)[0]
    const cErrs: Record<string, string> = {}
    if (emName) cErrs.emergencyName = emName
    if (emMobile) cErrs.emergencyMobile = emMobile
    if (!contact.waiver) cErrs.waiver = 'You must accept the waiver'
    setContactErrors(cErrs)
    if (first !== undefined) {
      tableRef.current?.querySelector(`[data-row="${first}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    if (Object.keys(cErrs).length) { document.getElementById('emergency')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }
    setBusy(true)
    const first0 = rows[0]
    const res = await submit({ ...contact, registrantName: first0.name.trim(), registrantMobile: first0.mobile, registrantEmail: first0.email.trim(), submissionKey }, rows)
    setBusy(false)
    if (res.ok) {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
      router.push(`/c/${slug}/r/${res.token}?saved=1`)
      router.refresh()
      return
    }
    setFormError(res.error ?? '')
    const ce = res.contactErrors ?? {}
    setContactErrors(ce)
    // The registrant is row one, so their contact problems belong on that row.
    const re = (res.rowErrors ?? {}) as Record<number, RowErrors>
    if (ce.registrantMobile || ce.registrantEmail || ce.registrantName)
      re[0] = { ...(re[0] ?? {}), ...(ce.registrantName ? { name: ce.registrantName } : {}), ...(ce.registrantMobile ? { mobile: ce.registrantMobile } : {}), ...(ce.registrantEmail ? { email: ce.registrantEmail } : {}) }
    setRowErrors(re)
  }

  const err = (i: number, k: keyof ParticipantInput) => {
    const problem = (i === 0 && (k === 'name' || k === 'age' || k === 'mobile' || k === 'email') ? registrant[k] : undefined) ?? rowErrors[i]?.[k] ?? live[i].errors[k]
    return problem && (showErrors || touched.has(`${i}:${k}`)) ? problem : undefined
  }
  const cell = (label: string, i: number, k: keyof ParticipantInput, input: React.ReactNode) => (
    <td data-label={label} className={err(i, k) ? 'bad' : ''}>
      {input}
      {err(i, k) && <small role="alert" className="cellerr">{err(i, k)}</small>}
      {k === 'email' && suggestEmail(rows[i].email) && <small role="status" className="wl">Did you mean <button type="button" className="linklike" onClick={() => set(i, 'email', suggestEmail(rows[i].email)!)}>{suggestEmail(rows[i].email)}</button>?</small>}
    </td>
  )
  const inp = (i: number, k: keyof ParticipantInput, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input data-r={i} data-c={k} value={rows[i][k] as string} onChange={(e) => set(i, k, e.target.value)} onBlur={() => touch(`${i}:${k}`)}
      onKeyDown={(e) => onKey(e, i, k)} onPaste={k === 'name' ? (e) => onPaste(e, i) : undefined} aria-label={i === 0 && k === 'name' ? 'Your name' : i === 0 ? `Your ${k}` : k}
      aria-invalid={!!err(i, k)} {...props} />
  )
  const sel = (i: number, k: keyof ParticipantInput, opts: readonly string[], blank = true) => (
    <select data-r={i} data-c={k} value={rows[i][k] as string} onChange={(e) => set(i, k, e.target.value)} onBlur={() => touch(`${i}:${k}`)} onKeyDown={(e) => onKey(e, i, k)} aria-label={k}>
      {blank && <option value="">Select</option>}
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  void isEmail

  return (
    <form onSubmit={onSubmit} noValidate>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" value={contact.website ?? ''} onChange={(e) => setContact({ ...contact, website: e.target.value })} />
      <h2>Participants</h2>
      <p className="muted">The first row is you, the person registering: we use your mobile and email to reach you. Then add everyone else who is coming, including people who will not play a game. Mark each as Member or Guest; organisers verify this. You can paste rows copied from Excel into the first Name cell.</p>
      <table ref={tableRef} className="grid-table">
        <thead>
          <tr>
            <th>#</th><th>Name</th><th>Age</th><th>Gender</th><th>Mobile</th>
            <th>Email</th>
            {columns.diet.show && <th>Diet</th>}
            {columns.tshirt.show && <th>T-shirt</th>}{columns.accessibility.show && <th>Accessibility needs</th>}
            {questions.map((q) => <th key={q.id}>{q.label}{q.required ? ' *' : ''}</th>)}
            <th>Member or Guest</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={i}>
            <tr data-row={i} className={flash === i ? 'flash' : undefined}>
              <td data-label="#">{i + 1}{i === 0 && <small className="you">You</small>}</td>
              {cell('Name', i, 'name', inp(i, 'name', { autoComplete: 'off' }))}
              {cell('Age', i, 'age', inp(i, 'age', { inputMode: 'numeric', style: { width: '4.5rem' } }))}
              {cell('Gender', i, 'gender', sel(i, 'gender', GENDERS))}
              {cell('Mobile', i, 'mobile', inp(i, 'mobile', { inputMode: 'tel', autoComplete: i === 0 ? 'tel-national' : 'off' }))}
              {cell('Email', i, 'email', inp(i, 'email', { type: 'email', inputMode: 'email', autoComplete: i === 0 ? 'email' : 'off' }))}
              {columns.diet.show && cell('Diet', i, 'diet', sel(i, 'diet', diets))}
              {columns.tshirt.show && cell('T-shirt', i, 'tshirt', sel(i, 'tshirt', TSHIRTS))}
              {columns.accessibility.show && cell('Accessibility needs', i, 'accessibility', inp(i, 'accessibility'))}
              {questions.map((q, qi) => (
                <td key={q.id} data-label={q.label} className={qi === questions.length - 1 && err(i, 'extra') ? 'bad' : ''}>
                  {q.kind === 'choice'
                    ? <select data-r={i} data-c={`extra-${q.id}`} aria-label={q.label} value={r.extra[q.id] ?? ''} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, extra: { ...x.extra, [q.id]: e.target.value } } : x)))}><option value="">Select</option>{q.options.map((o) => <option key={o}>{o}</option>)}</select>
                    : <input data-r={i} data-c={`extra-${q.id}`} aria-label={q.label} value={r.extra[q.id] ?? ''} maxLength={200} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, extra: { ...x.extra, [q.id]: e.target.value } } : x)))} />}
                  {qi === questions.length - 1 && err(i, 'extra') && <small role="alert" className="cellerr">{err(i, 'extra')}</small>}
                </td>
              ))}
              {cell('Member or Guest', i, 'kind', sel(i, 'kind', ['member', 'guest'], false))}
              <td className="actions">
                <button type="button" disabled={!ready} onClick={() => dup(i)} title="Duplicate this person" aria-label={`Duplicate person ${i + 1}`}>Duplicate</button>
                <button type="button" disabled={!ready} onClick={() => del(i)} title="Delete this person" aria-label={`${rows.length > 1 ? "Delete" : "Clear"} person ${i + 1}`}>{rows.length > 1 ? 'Delete' : 'Clear'}</button>
              </td>
            </tr>
            <tr className={`gamesrow${flash === i ? ' flash' : ''}`} data-games={i}>
              <td colSpan={gridCols} data-label="Games">
                <div className="games-head"><strong>Games for {r.name.trim() || (i === 0 ? 'you' : `person ${i + 1}`)}</strong><span className="muted">{r.sports.length ? `${r.sports.length} chosen` : 'Not playing? Leave all unticked, that is fine.'}</span></div>
                <div className="gamegrid" role="group" aria-label={`Games for person ${i + 1}`}>
                  {sports.map((sp) => {
                    const on = r.sports.includes(sp)
                    const allowed = sportFormats(sp)
                    const picked = r.formats[sp]?.length ? r.formats[sp] : [allowed[0]]
                    const wantsPartner = on && (picked.includes('doubles') || picked.includes('team'))
                    const level = r.skills[sp] || r.skill
                    return (
                      <div key={sp} className={`gamecard${on ? ' on' : ''}`}>
                        <label className="gc-head">
                          <input type="checkbox" className="sr-only" data-r={i} data-c={`sport-${sp}`} checked={on} onChange={(e) => toggleSport(i, sp, e.target.checked)} />
                          <Pic src={sportIcon(sp)} size={44} />
                          <span className="gc-name">{sp}{seatsLeft[sp] === 0 && <em className="wl"> waitlist</em>}<small>{on ? 'Playing' : 'Tap to join'}</small></span>
                          <span className="gc-tick" aria-hidden="true">{on ? '✓' : '+'}</span>
                        </label>
                        {on && columns.skill.show && (
                          <div className="gc-row">
                            <span className="gc-label">Skill level</span>
                            <div className="seg" role="radiogroup" aria-label={`Skill level for ${sp}`}>
                              {SKILLS.map((o) => (
                                <label key={o} className={level === o ? 'on' : ''}>
                                  <input type="radio" className="sr-only" name={`skill-${i}-${sp}`} data-r={i} data-c={`skill-${sp}`} value={o} checked={level === o}
                                    onChange={() => patchRow(i, (x) => ({ ...x, skills: { ...x.skills, [sp]: o } }))} />{o}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {on && allowed.length > 1 && (
                          <div className="gc-row">
                            <span className="gc-label">Plays</span>
                            <div className="seg multi" role="group" aria-label={`How ${r.name || 'this person'} plays ${sp}`}>
                              {allowed.map((f) => (
                                <label key={f} className={picked.includes(f) ? 'on' : ''}>
                                  <input type="checkbox" className="sr-only" aria-label={`${f} in ${sp}`} data-r={i} data-c={`fmt-${sp}-${f}`} checked={picked.includes(f)} onChange={(e) => toggleFormat(i, sp, f, e.target.checked)} />{f === 'singles' ? 'Singles' : f === 'doubles' ? 'Doubles' : 'Team'}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {wantsPartner && (
                          <input className="partner" data-r={i} data-c={`partner-${sp}`} maxLength={60} aria-label={picked.includes('team') ? `Team name for ${sp}` : `Partner for ${sp}`} value={r.partners[sp] ?? ''}
                            placeholder={picked.includes('team') ? 'Team name (optional)' : "Partner's name or HR reference (optional)"}
                            onChange={(e) => patchRow(i, (x) => ({ ...x, partners: { ...x.partners, [sp]: e.target.value } }))} />
                        )}
                      </div>
                    )
                  })}
                </div>
                {err(i, 'sports') && <small role="alert" className="cellerr">{err(i, 'sports')}</small>}
                {err(i, 'skill') && <small role="alert" className="cellerr">{err(i, 'skill')}</small>}
                {err(i, 'partners') && <small role="alert" className="cellerr">{err(i, 'partners')}</small>}
              </td>
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <p><button type="button" className="btn outline" disabled={!ready} onClick={() => addRow()}>Add person</button> <span className="muted" role="status">{note || draftNote}</span></p>
      {rows.length > SOFT_LIMIT && <p className="warn" role="status">You are registering more than {SOFT_LIMIT} people. You can continue, but please check the list.</p>}

      <p className="summary" aria-live="polite">
        <strong>{summary.participants}</strong> {summary.participants === 1 ? 'participant' : 'participants'} · <strong>{summary.members}</strong> {summary.members === 1 ? 'member' : 'members'} · <strong>{summary.guests}</strong> {summary.guests === 1 ? 'guest' : 'guests'} · <strong>{summary.sports}</strong> {summary.sports === 1 ? 'sport' : 'sports'} · <strong>{summary.playing}</strong> playing
      </p>

      <fieldset className="card" id="emergency">
        <legend>Emergency contact</legend>
        <p className="muted" style={{ marginTop: 0 }}>Someone we can call if anyone on this registration is hurt. They must not be on this registration, because everyone on it will be at the venue.</p>
        <div className="fields">
          <label>Emergency contact name<input value={contact.emergencyName} onChange={(e) => { setContact({ ...contact, emergencyName: e.target.value }); touchSoon('em:name') }} onBlur={() => touch('em:name')} aria-invalid={!!((showErrors || touched.has('em:name')) && emName)} />
            {(showErrors || touched.has('em:name')) && (emName || contactErrors.emergencyName) && <small role="alert" className="cellerr">{emName ?? contactErrors.emergencyName}</small>}</label>
          <label>Emergency contact mobile<input inputMode="tel" value={contact.emergencyMobile} onChange={(e) => { setContact({ ...contact, emergencyMobile: e.target.value }); touchSoon('em:mobile') }} onBlur={() => touch('em:mobile')} aria-invalid={!!((showErrors || touched.has('em:mobile')) && emMobile)} />
            {(showErrors || touched.has('em:mobile')) && (emMobile || contactErrors.emergencyMobile) && <small role="alert" className="cellerr">{emMobile ?? contactErrors.emergencyMobile}</small>}</label>
        </div>
      </fieldset>

      <label className="waiver">
        <input type="checkbox" checked={contact.waiver} onChange={(e) => setContact({ ...contact, waiver: e.target.checked })} />
        {waiver}
      </label>
      {contactErrors.waiver && <small role="alert" className="cellerr">{contactErrors.waiver}</small>}
      {formError && <p role="alert" className="cellerr">{formError}</p>}
      <p><button className="btn" disabled={busy || !ready}>{busy ? 'Saving…' : submitLabel}</button></p>
    </form>
  )
}
