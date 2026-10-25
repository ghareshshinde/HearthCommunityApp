'use client'
import { useActionState } from 'react'
import { findMyRegistration } from '@/app/actions'

export default function FindForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(findMyRegistration.bind(null, slug), undefined)
  return (
    <form key={state?.values ? JSON.stringify(state.values) : 'new'} action={action} className="card" style={{ maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <label>Reference (like HR-1A2B3C4D)<input name="ref" required autoCapitalize="characters" autoComplete="off" defaultValue={state?.values?.ref} /></label>
      <label>Mobile number you registered with<input name="mobile" inputMode="tel" required defaultValue={state?.values?.mobile} /></label>
      {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      <p><button className="btn" disabled={pending}>Find my registration</button></p>
    </form>
  )
}
