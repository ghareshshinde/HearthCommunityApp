'use client'
import { useState, useTransition } from 'react'
import { editParticipantAction } from '@/app/actions'
import type { EditableField } from '@/lib/repo'

export default function EditableCell({ slug, id, field, value, options }: { slug: string; id: number; field: EditableField; value: string; options?: string[] }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  function save() {
    if (v === value) return setEditing(false)
    start(async () => {
      const r = await editParticipantAction(slug, id, field, v)
      if (r.ok) { setErr(''); setEditing(false) } else setErr(r.error)
    })
  }
  if (!editing) return <button type="button" className="linklike" onClick={() => setEditing(true)} title="Click to edit">{value || '—'}</button>
  return (
    <span>
      {options ? (
        <select autoFocus value={v} onChange={(e) => setV(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
      ) : (
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setV(value); setEditing(false) } }} size={Math.max(6, v.length)} />
      )}
      <button type="button" onClick={save} disabled={pending}>Save</button>
      {err && <small className="cellerr"> {err}</small>}
    </span>
  )
}
