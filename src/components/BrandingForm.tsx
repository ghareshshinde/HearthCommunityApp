'use client'
import { useActionState } from 'react'
import { saveBrandingAction } from '@/app/actions'
import type { Branding } from '@/lib/branding/tokens'

const FIELDS = ['primary', 'secondary', 'accent', 'background', 'surface', 'textPrimary', 'textSecondary'] as const

export default function BrandingForm({ slug, brand }: { slug: string; brand: Branding }) {
  const [state, action, pending] = useActionState(saveBrandingAction.bind(null, slug), undefined)
  return (
    <form action={action} className="card">
      <div className="fields">
        <label>Display name<input name="name" defaultValue={brand.name === 'Hearth' ? '' : brand.name} /></label>
        <label>Tagline<input name="tagline" defaultValue={brand.tagline} /></label>
        {FIELDS.map((k) => <label key={k}>{k}<input type="color" name={k} defaultValue={brand.colors[k]} /></label>)}
      </div>
      {state?.error && <p role="alert" className="cellerr">{state.error}</p>}
      {state?.ok && <p role="status">Saved. Changes show immediately on the public pages.</p>}
      <p><button className="btn" disabled={pending}>Save branding</button></p>
    </form>
  )
}
