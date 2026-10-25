'use client'
import { useEffect, useState } from 'react'

type Tab = { id: number; label: string; icon: string }

/** Shows one category at a time on the projector and moves to the next every few seconds. Tapping a tab pins it. */
export default function BoardCycle({ tabs, panels, seconds = 25 }: { tabs: Tab[]; panels: React.ReactNode[]; seconds?: number }) {
  const [i, setI] = useState(0)
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    if (pinned || tabs.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % tabs.length), seconds * 1000)
    return () => clearInterval(t)
  }, [pinned, tabs.length, seconds])
  const at = Math.min(i, Math.max(0, tabs.length - 1))
  return (
    <>
      <nav className="b-tabs" aria-label="Categories">
        {tabs.map((t, n) => (
          <button key={t.id} type="button" className={`b-tab${n === at ? ' on' : ''}`} aria-pressed={n === at} onClick={() => { setI(n); setPinned(true) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.icon} alt="" />{t.label}
          </button>
        ))}
        {tabs.length > 1 && <button type="button" className="b-tab auto" onClick={() => setPinned(!pinned)}>{pinned ? 'Auto-switch off' : 'Auto-switching'}</button>}
      </nav>
      <div className="b-stage">{panels[at]}</div>
    </>
  )
}
