'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { supabaseBrowser } from '@/lib/supabase/browser'

function Login() {
  const next = useSearchParams().get('next') ?? '/'
  const t = useTranslations('common')
  const go = () =>
    supabaseBrowser().auth.signInWithOAuth({
      provider: 'google', // the only login method (A1): no password or OTP screens exist
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  return <main><button className="btn" onClick={go}>{t('signIn')}</button></main>
}
export default function Page() { return <Suspense><Login /></Suspense> }
