import QRCode from 'qrcode'
import type { GroupLinks as Links } from '@/lib/registration/rules'

/** Join buttons and QR codes for the event's WhatsApp and Telegram updates groups. Shows nothing when neither is set. */
export default async function GroupLinks({ groups, compact = false }: { groups: Links; compact?: boolean }) {
  const items = ([['whatsapp', 'WhatsApp', groups.whatsapp], ['telegram', 'Telegram', groups.telegram]] as const).filter(([, , url]) => url)
  if (!items.length) return null
  const qrs = await Promise.all(items.map(([, , url]) => QRCode.toString(url, { type: 'svg', margin: 1, width: compact ? 120 : 160, errorCorrectionLevel: 'M' })))
  return (
    <section className="card groups" aria-label="Join the updates group">
      <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>Get the latest updates</h2>
      <p className="muted" style={{ marginTop: 0 }}>Join the group to hear about schedule changes, court calls and results. Tap the button on your phone, or scan the code with another phone.</p>
      <div className="groupitems">
        {items.map(([kind, label, url], n) => (
          <div key={kind} className="groupitem">
            <div role="img" aria-label={`QR code to join the ${label} group`} dangerouslySetInnerHTML={{ __html: qrs[n] }} style={{ background: '#fff', width: compact ? 120 : 160 }} />
            <a className="btn" href={url} target="_blank" rel="noreferrer noopener">Join on {label}</a>
          </div>
        ))}
      </div>
    </section>
  )
}
