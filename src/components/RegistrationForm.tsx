'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DIETS, GENDERS, SKILLS, SOFT_LIMIT, TSHIRTS, blankRow, parsePaste, validateRow,
  type ColumnConfig, type ParticipantInput, type RowErrors,
} from '@/lib/registration/rules'
import type { Contact, SubmitResult } from '@/lib/repo'
import Pic from '@/components/Pic'
import { sportIcon } from '@/lib/sports'
import { suggestEmail } from '@/lib/registration/rules'

type Props = {
  slug: string
  eventId: number
  sports: string[]
  columns: ColumnConfig
  ages?: Record<string, { min?: number; max?: number }>
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

export default function RegistrationForm({ slug, eventId, sports, columns, ages = NO_AGES, waiver, emailRequired = true, seatsLeft, initialRows, initialContact, submit, submitLabel, draftKey }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ParticipantInput[]>(initialRows?.length ? initialRows : [blankRow()])
  const [contact, setContact] = useState<Contact>({ registrantName: '', registrantMobile: '', registrantEmail: '', emergencyName: '', emergencyMobile: '', waiver: false, ...initialContact })
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({})
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftNote, setDraftNote] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const tableRef = useRef<HTMLTableElement>(null)
  // One key per form visit: a repeated submit (double tap, retry) returns the first registration instead of making another.
  const [submissionKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`))
  const key = draftKey ?? `hearth-draft-${eventId}`

  // TR9: draft kept 7 days in this browser.
  useEffect(() => {
    if (initialRows) return
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (d && Date.now() - d.at < DRAFT_DAYS * 86400_000) {
        // localStorage exists only in the browser, so restoring must happen after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRows(d.rows); setContact(d.contact); setDraftNote('Draft restored')
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

  const live = useMemo(() => rows.map((r) => validateRow(r, sports, columns, ages)), [rows, sports, columns, ages])
  const summary = {
    participants: rows.length,
    members: rows.filter((r) => r.kind === 'member').length,
    guests: rows.filter((r) => r.kind === 'guest').length,
    sports: new Set(rows.flatMap((r) => r.sports)).size,
  }

  const set = (i: number, k: keyof ParticipantInput, v: string | string[]) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const addRow = (focusIndex?: number) => {
    setRows((rs) => [...rs, blankRow()])
    setTimeout(() => tableRef.current?.querySelector<HTMLElement>(`[data-r="${focusIndex ?? rows.length}"][data-c="name"]`)?.focus(), 30)
  }
  const dup = (i: number) => setRows((rs) => [...rs.slice(0, i + 1), { ...rs[i], name: '', mobile: '', email: '' }, ...rs.slice(i + 1)])
  const del = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blankRow()]))

  // TR6: arrows move between rows in the same column; Enter in the last row adds a row.
  function onKey(e: React.KeyboardEvent, i: number, c: string) {
    const t = e.target as HTMLElement
    if (e.key === 'Enter' && t.tagName !== 'BUTTON' && t.tagName !== 'TEXTAREA') {
      e.preventDefault()
      if (i === rows.length - 1) addRow(i + 1)
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
    const bad = live.findIndex((v) => !v.ok)
    const errs: Record<number, RowErrors> = {}
    live.forEach((v, i) => { if (!v.ok) errs[i] = v.errors })
    setRowErrors(errs)
    if (bad >= 0) {
      tableRef.current?.querySelector(`[data-row="${bad}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    const mailErr = emailRequired && !contact.registrantEmail.trim() ? 'Email is required: your ticket link is sent here'
      : contact.registrantEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.registrantEmail.trim()) ? 'Enter a valid email address' : ''
    if (mailErr) { setContactErrors({ registrantEmail: mailErr }); document.querySelector('[name="registrantEmail"]')?.scrollIntoView({ block: 'center' }); return }
    if (!contact.waiver) { setContactErrors({ waiver: 'You must accept the waiver' }); return }
    setBusy(true)
    const res = await submit({ ...contact, submissionKey }, rows)
    setBusy(false)
    if (res.ok) {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
      router.push(`/c/${slug}/r/${res.token}?saved=1`)
      router.refresh()
      return
    }
    setFormError(res.error ?? '')
    setContactErrors(res.contactErrors ?? {})
    setRowErrors((res.rowErrors ?? {}) as Record<number, RowErrors>)
  }

  const err = (i: number, k: keyof ParticipantInput) => (showErrors ? rowErrors[i]?.[k] ?? live[i].errors[k] : undefined)
  const cell = (label: string, i: number, k: keyof ParticipantInput, input: React.ReactNode) => (
    <td data-label={label} className={err(i, k) ? 'bad' : ''}>
      {input}
      {err(i, k) && <small role="alert" className="cellerr">{err(i, k)}</small>}
    </td>
  )
  const inp = (i: number, k: keyof ParticipantInput, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input data-r={i} data-c={k} value={rows[i][k] as string} onChange={(e) => set(i, k, e.target.value)}
      onKeyDown={(e) => onKey(e, i, k)} onPaste={k === 'name' ? (e) => onPaste(e, i) : undefined} aria-label={k} {...props} />
  )
  const sel = (i: number, k: keyof ParticipantInput, opts: readonly string[], blank = true) => (
    <select data-r={i} data-c={k} value={rows[i][k] as string} onChange={(e) => set(i, k, e.target.value)} onKeyDown={(e) => onKey(e, i, k)} aria-label={k}>
      {blank && <option value="">Select</option>}
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" value={contact.website ?? ''} onChange={(e) => setContact({ ...contact, website: e.target.value })} />
      <fieldset className="card">
        <legend>Your details</legend>
        <div className="fields">
          <label>Your name<input value={contact.registrantName} onChange={(e) => setContact({ ...contact, registrantName: e.target.value })} />{contactErrors.registrantName && <small role="alert" className="cellerr">{contactErrors.registrantName}</small>}</label>
          <label>Your mobile<input inputMode="tel" value={contact.registrantMobile} onChange={(e) => setContact({ ...contact, registrantMobile: e.target.value })} />{contactErrors.registrantMobile && <small role="alert" className="cellerr">{contactErrors.registrantMobile}</small>}</label>
          <label>Your email{emailRequired ? '' : ' (optional)'}<input name="registrantEmail" type="email" autoComplete="email" inputMode="email" required={emailRequired} value={contact.registrantEmail} onChange={(e) => setContact({ ...contact, registrantEmail: e.target.value })} />
            <small className="muted">{emailRequired ? 'We email your ticket link here. Please type it carefully.' : 'We email your ticket link here if you give one.'}</small>
            {suggestEmail(contact.registrantEmail) && <small role="status" className="wl">Did you mean <button type="button" className="linklike" onClick={() => setContact({ ...contact, registrantEmail: suggestEmail(contact.registrantEmail)! })}>{suggestEmail(contact.registrantEmail)}</button>?</small>}
            {contactErrors.registrantEmail && <small role="alert" className="cellerr">{contactErrors.registrantEmail}</small>}</label>
          <label>Emergency contact name<input value={contact.emergencyName} onChange={(e) => setContact({ ...contact, emergencyName: e.target.value })} />{contactErrors.emergencyName && <small role="alert" className="cellerr">{contactErrors.emergencyName}</small>}</label>
          <label>Emergency contact mobile<input inputMode="tel" value={contact.emergencyMobile} onChange={(e) => setContact({ ...contact, emergencyMobile: e.target.value })} />{contactErrors.emergencyMobile && <small role="alert" className="cellerr">{contactErrors.emergencyMobile}</small>}</label>
        </div>
      </fieldset>

      <h2>Participants</h2>
      <p className="muted">One row per person. Mark each as Member or Guest; organisers verify this. You can paste rows copied from Excel into the first Name cell.</p>
      <table ref={tableRef} className="grid-table">
        <thead>
          <tr>
            <th>#</th><th>Name</th><th>Age</th><th>Gender</th><th>Mobile</th>
            {columns.email.show && <th>Email</th>}<th>Sports</th>
            {columns.skill.show && <th>Skill level</th>}{columns.diet.show && <th>Diet</th>}
            {columns.tshirt.show && <th>T-shirt</th>}{columns.accessibility.show && <th>Accessibility needs</th>}
            <th>Member or Guest</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} data-row={i}>
              <td data-label="#">{i + 1}</td>
              {cell('Name', i, 'name', inp(i, 'name', { autoComplete: 'off' }))}
              {cell('Age', i, 'age', inp(i, 'age', { inputMode: 'numeric', style: { width: '4.5rem' } }))}
              {cell('Gender', i, 'gender', sel(i, 'gender', GENDERS))}
              {cell('Mobile', i, 'mobile', inp(i, 'mobile', { inputMode: 'tel' }))}
              {columns.email.show && cell('Email', i, 'email', inp(i, 'email', { type: 'email' }))}
              {cell('Sports', i, 'sports',
                <div className="chips" role="group" aria-label="Sports">
                  {sports.map((s) => (
                    <label key={s} className={`chip ${r.sports.includes(s) ? 'on' : ''}`}>
                      <input type="checkbox" checked={r.sports.includes(s)} onChange={(e) => set(i, 'sports', e.target.checked ? [...r.sports, s] : r.sports.filter((x) => x !== s))} />
                      <Pic src={sportIcon(s)} size={22} />{s}{seatsLeft[s] === 0 && <em className="wl"> waitlist</em>}
                    </label>
                  ))}
                </div>)}
              {columns.skill.show && cell('Skill level', i, 'skill', sel(i, 'skill', SKILLS))}
              {columns.diet.show && cell('Diet', i, 'diet', sel(i, 'diet', DIETS, false))}
              {columns.tshirt.show && cell('T-shirt', i, 'tshirt', sel(i, 'tshirt', TSHIRTS))}
              {columns.accessibility.show && cell('Accessibility needs', i, 'accessibility', inp(i, 'accessibility'))}
              {cell('Member or Guest', i, 'kind', sel(i, 'kind', ['member', 'guest'], false))}
              <td className="actions">
                <button type="button" onClick={() => dup(i)} title="Duplicate row">Duplicate</button>
                <button type="button" onClick={() => del(i)} title="Delete row">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><button type="button" className="btn outline" onClick={() => addRow()}>Add person</button> <span className="muted">{draftNote}</span></p>
      {rows.length > SOFT_LIMIT && <p className="warn" role="status">You are registering more than {SOFT_LIMIT} people. You can continue, but please check the list.</p>}

      <p className="summary" aria-live="polite">
        <strong>{summary.participants}</strong> {summary.participants === 1 ? 'participant' : 'participants'} · <strong>{summary.members}</strong> {summary.members === 1 ? 'member' : 'members'} · <strong>{summary.guests}</strong> {summary.guests === 1 ? 'guest' : 'guests'} · <strong>{summary.sports}</strong> {summary.sports === 1 ? 'sport' : 'sports'}
      </p>

      <label className="waiver">
        <input type="checkbox" checked={contact.waiver} onChange={(e) => setContact({ ...contact, waiver: e.target.checked })} />
        {waiver}
      </label>
      {contactErrors.waiver && <small role="alert" className="cellerr">{contactErrors.waiver}</small>}
      {formError && <p role="alert" className="cellerr">{formError}</p>}
      <p><button className="btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></p>
    </form>
  )
}
