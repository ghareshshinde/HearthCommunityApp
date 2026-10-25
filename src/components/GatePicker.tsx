'use client'
import { useRef } from 'react'
import { setGate } from '@/app/staff-actions'

export default function GatePicker({ slug, gates, current }: { slug: string; gates: string[]; current: string }) {
  const form = useRef<HTMLFormElement>(null)
  if (!gates.length) return null
  return (
    <form ref={form} action={setGate.bind(null, slug)}>
      <label>This device is at
        <select name="gate" defaultValue={current} onChange={() => form.current?.requestSubmit()}>
          <option value="">Choose a gate</option>
          {gates.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label>
    </form>
  )
}
