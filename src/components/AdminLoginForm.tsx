'use client'
import { useActionState } from 'react'
import { adminLogin } from '@/app/actions'

export default function AdminLoginForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(adminLogin.bind(null, slug), undefined)
  return (
    <form action={action} className="card" style={{ maxWidth: '22rem' }}>
      <label>Admin password<input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      <p><button className="btn" disabled={pending}>Sign in</button></p>
    </form>
  )
}
