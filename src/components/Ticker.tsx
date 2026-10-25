'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type Item = { id: number; message: string; level: 'info' | 'urgent' }
const SEEN = 'hearth-seen-announcements'

/** News-channel style bar fixed to the bottom of the page. Polls for live announcements and can raise a phone notification while the site is open. */
export default function Ticker({ slug, initial }: { slug: string; initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial)
  const [perm, setPerm] = useState<'unsupported' | NotificationPermission>('unsupported')
  const seen = useRef<Set<number>>(new Set(initial.map((i) => i.id)))

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/c/${slug}/announcements`, { cache: 'no-store' })
      if (!res.ok) return
      const list = (await res.json()) as Item[]
      setItems(list)
      for (const a of list) {
        if (seen.current.has(a.id)) continue
        seen.current.add(a.id)
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(a.level === 'urgent' ? 'Urgent announcement' : 'Announcement', { body: a.message, tag: `ann-${a.id}` }) } catch { /* some phones only allow service-worker notifications */ }
        }
      }
      try { localStorage.setItem(SEEN, JSON.stringify([...seen.current].slice(-50))) } catch { /* storage unavailable */ }
    } catch { /* offline: keep showing what we have */ }
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ('Notification' in window) setPerm(Notification.permission)
    const t = setInterval(() => { if (document.visibilityState === 'visible') poll() }, 15_000)
    const onVis = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [poll])

  if (!items.length && perm !== 'default') return null
  const urgent = items.some((i) => i.level === 'urgent')
  const text = items.map((i) => (i.level === 'urgent' ? `URGENT: ${i.message}` : i.message))
  // Speed stays readable whatever the length: about 7 characters a second.
  const seconds = Math.max(18, Math.round(text.join('   ').length / 7))
  return (
    <aside className={`ticker${urgent ? ' urgent' : ''}`} role="region" aria-label="Announcements">
      <span className="ticker-tag">{urgent ? 'URGENT' : 'NEWS'}</span>
      <div className="ticker-track" role="status" aria-live="polite">
        {items.length > 0
          ? <div className="ticker-run" style={{ animationDuration: `${seconds}s` }}>{text.map((t, i) => <span key={i}>{t}</span>)}</div>
          : <span className="ticker-idle">Get a notification when organisers announce something.</span>}
      </div>
      {perm === 'default' && <button type="button" className="ticker-btn" onClick={async () => setPerm(await Notification.requestPermission())}>Alerts</button>}
    </aside>
  )
}
