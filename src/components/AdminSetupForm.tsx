'use client'
import { useActionState } from 'react'
import { adminSetup } from '@/app/actions'

export default function AdminSetupForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(adminSetup.bind(null, slug), undefined)
  return (
    <form action={action} className="card" style={{ maxWidth: '24rem' }}>
      <p className="muted" style={{ marginTop: 0 }}>First time here. Choose the admin password for this site. Do it now, before sharing the link.</p>
      <label>New password (10 or more characters)<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>Type it again<input name="again" type="password" autoComplete="new-password" minLength={10} required /></label>
      {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      <p><button className="btn" disabled={pending}>Save password and sign in</button></p>
    </form>
  )
}
