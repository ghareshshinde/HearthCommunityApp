'use client'
import { useState } from 'react'

/** Lets a registrant keep their link without any email: share it to themselves (WhatsApp, Notes, Messages) or copy it. */
export default function SaveLink({ reference, title }: { reference: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const url = () => location.href.split('?')[0]
  const text = () => `${title}: my registration ${reference}. View, change or cancel it here: ${url()}`
  async function share() {
    if (navigator.share) await navigator.share({ title, text: text(), url: url() }).catch(() => {})
    else await copy()
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* ignore */ }
  }
  return (
    <div className="card" style={{ margin: '1rem 0' }}>
      <strong>Keep this link safe</strong>
      <p className="muted" style={{ margin: '.25rem 0 .75rem' }}>It is how you change your registration or show your QR ticket. Send it to yourself now.</p>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={share}>Send it to myself</button>
        <a className="btn outline" href={`https://wa.me/?text=${encodeURIComponent(`${title}: my registration ${reference}. View, change or cancel it here: `)}`} onClick={(e) => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(text())}` }} target="_blank" rel="noreferrer">WhatsApp</a>
        <button type="button" className="btn outline" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
    </div>
  )
}
