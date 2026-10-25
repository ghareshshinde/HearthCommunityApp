'use client'
import { useActionState } from 'react'
import { changePasswordAction } from '@/app/actions'

export default function PasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(changePasswordAction.bind(null, slug), undefined)
  return (
    <form action={action} className="card" style={{ maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
      <label>New password (10+ characters)<input name="next" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>Repeat new password<input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
      {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      {state?.ok && <p role="status">Password changed.</p>}
      <p><button className="btn" disabled={pending}>Change password</button></p>
    </form>
  )
}
