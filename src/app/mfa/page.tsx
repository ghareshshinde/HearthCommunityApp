'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { supabaseBrowser } from '@/lib/supabase/browser'

function Mfa() {
  const next = useSearchParams().get('next') ?? '/'
  const t = useTranslations('admin')
  const [factorId, setFactorId] = useState<string>()
  const [qr, setQr] = useState<string>()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const sb = supabaseBrowser()
    ;(async () => {
      const { data: list } = await sb.auth.mfa.listFactors()
      const verified = list?.totp.find((f) => f.status === 'verified')
      if (verified) return setFactorId(verified.id)
      const { data } = await sb.auth.mfa.enroll({ factorType: 'totp' })
      if (data) { setFactorId(data.id); setQr(data.totp.qr_code) }
    })()
  }, [])

  async function verify() {
    const sb = supabaseBrowser()
    const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: factorId! })
    if (e1) return setErr(e1.message)
    const { error } = await sb.auth.mfa.verify({ factorId: factorId!, challengeId: ch.id, code })
    if (error) return setErr(error.message)
    location.href = next
  }

  return (
    <main>
      <h1>{t('mfaSetup')}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="" width={180} height={180} />}
      <p><input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code" /></p>
      <button className="btn" onClick={verify} disabled={!factorId}>OK</button>
      {err && <p role="alert">{err}</p>}
    </main>
  )
}
export default function Page() { return <Suspense><Mfa /></Suspense> }
