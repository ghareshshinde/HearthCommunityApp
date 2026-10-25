'use client'
import { useActionState } from 'react'
import { emailMyLinks, findMyRegistration } from '@/app/actions'

export default function FindForm({ slug, emailOn }: { slug: string; emailOn: boolean }) {
  const [state, action, pending] = useActionState(findMyRegistration.bind(null, slug), undefined)
  const [mail, mailAction, mailPending] = useActionState(emailMyLinks.bind(null, slug), undefined)
  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '24rem' }}>
      <form key={state?.values ? JSON.stringify(state.values) : 'new'} action={action} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>With your reference</h2>
        <label>Reference (like HR-1A2B3C4D)<input name="ref" required autoCapitalize="characters" autoComplete="off" defaultValue={state?.values?.ref} /></label>
        <label>Mobile number you registered with<input name="mobile" inputMode="tel" required defaultValue={state?.values?.mobile} /></label>
        {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
        <p><button className="btn" disabled={pending}>Find my registration</button></p>
      </form>
      {emailOn && (
        <form action={mailAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Lost the reference? Email me my links</h2>
          <label>Email address you registered with<input name="email" type="email" required autoComplete="email" /></label>
          {mail?.error && <p role="alert" className="cellerr">{mail.error}</p>}
          {mail?.message && <p role="status">{mail.message}</p>}
          <p><button className="btn outline" disabled={mailPending}>Email me my links</button></p>
        </form>
      )}
    </div>
  )
}
