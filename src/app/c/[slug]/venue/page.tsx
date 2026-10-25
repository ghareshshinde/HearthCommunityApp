import QRCode from 'qrcode'
import { headers } from 'next/headers'
import { currentEvent, isOpen } from '@/lib/repo'
import { requireCommunity } from '@/lib/session'
import { eventSettings } from '@/lib/registration/rules'
import Pic from '@/components/Pic'

/** A printable poster for the venue: one QR to get a lost ticket back, one to register on the spot. */
export default async function VenuePoster({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug)
  const ev = currentEvent(c.id)
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
  const qr = (path: string) => QRCode.toString(`${origin}${path}`, { type: 'svg', margin: 1, width: 300, errorCorrectionLevel: 'M' })
  const myUrl = `/c/${slug}/my`
  const regUrl = ev ? `/c/${slug}/e/${ev.id}` : `/c/${slug}`
  const [myQr, regQr] = await Promise.all([qr(myUrl), qr(regUrl)])
  const showReg = ev && isOpen(ev)
  const gates = ev ? eventSettings(ev.config).gates : []
  return (
    <main style={{ maxWidth: '56rem', textAlign: 'center' }}>
      <div className="person" style={{ justifyContent: 'center' }}>{c.brand.logo && <Pic src={c.brand.logo} size={72} />}<h1 style={{ margin: 0 }}>{ev?.title ?? c.name}</h1></div>
      <p className="muted" style={{ fontSize: '1.2rem' }}>{c.brand.name === 'Hearth' ? c.name : c.brand.name}{gates.length ? ` · Check-in: ${gates.join(' · ')}` : ''}</p>
      <div style={{ display: 'grid', gridTemplateColumns: showReg ? '1fr 1fr' : '1fr', gap: '2rem', marginTop: '1.5rem' }}>
        <section className="card">
          <h2 style={{ fontSize: '1.6rem', marginTop: 0 }}>Lost your ticket?</h2>
          <div role="img" aria-label="QR code to find your registration" style={{ width: 300, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: myQr }} />
          <p style={{ fontSize: '1.2rem' }}>Scan to find your registration and QR ticket with your reference and mobile number.</p>
        </section>
        {showReg && (
          <section className="card">
            <h2 style={{ fontSize: '1.6rem', marginTop: 0 }}>Not registered yet?</h2>
            <div role="img" aria-label="QR code to register" style={{ width: 300, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: regQr }} />
            <p style={{ fontSize: '1.2rem' }}>Scan to register your family, or ask the spot desk.</p>
          </section>
        )}
      </div>
      <p className="muted" style={{ marginTop: '1.5rem' }}>Print this page (Ctrl or Cmd + P). Anyone at the gate can also look you up by name or mobile number.</p>
    </main>
  )
}
