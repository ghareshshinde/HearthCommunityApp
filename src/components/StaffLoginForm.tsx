'use client'
import { useActionState } from 'react'
import { staffLogin } from '@/app/staff-actions'

export default function StaffLoginForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(staffLogin.bind(null, slug), undefined)
  return (
    <form action={action} className="card" style={{ maxWidth: '22rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <label>Username<input name="username" autoComplete="username" autoCapitalize="none" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      <p><button className="btn" disabled={pending}>Sign in</button></p>
    </form>
  )
}
