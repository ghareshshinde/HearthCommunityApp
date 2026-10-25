'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * A slim progress bar at the top and a spinner on the button that was pressed, so a tap never feels ignored.
 * It runs from a link click until the new page arrives, and while a form is being sent to the server.
 */
export default function NavProgress() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [navigating, setNavigating] = useState(false)
  const [sending, setSending] = useState(0)
  const last = useRef<{ el: HTMLElement; at: number } | null>(null)
  const stop = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A new page has arrived: everything is done.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNavigating(false)
    document.querySelectorAll('.is-busy').forEach((el) => el.classList.remove('is-busy'))
  }, [pathname, search])

  useEffect(() => {
    const begin = () => {
      setNavigating(true)
      if (stop.current) clearTimeout(stop.current)
      stop.current = setTimeout(() => { setNavigating(false); document.querySelectorAll('.is-busy').forEach((el) => el.classList.remove('is-busy')) }, 20_000) // never stay stuck
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null
      const btn = t?.closest('button, input[type="submit"]') as HTMLElement | null
      if (btn) last.current = { el: btn, at: Date.now() }
      const a = t?.closest('a') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || a.target === '_blank' || a.hasAttribute('download')) return
      let u: URL
      try { u = new URL(a.href, location.href) } catch { return }
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return
      begin()
    }
    document.addEventListener('click', onClick, true)

    // Count form posts to the server (Next marks them with a Next-Action header).
    const original = window.fetch
    window.fetch = async function patched(input: RequestInfo | URL, init?: RequestInit) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      const isAction = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'POST' && headers.has('next-action')
      if (!isAction) return original.call(window, input, init)
      setSending((n) => n + 1)
      const pressed = last.current && Date.now() - last.current.at < 1500 ? last.current.el : null
      pressed?.classList.add('is-busy')
      try { return await original.call(window, input, init) } finally {
        setSending((n) => Math.max(0, n - 1))
        pressed?.classList.remove('is-busy')
      }
    }
    return () => { document.removeEventListener('click', onClick, true); window.fetch = original; if (stop.current) clearTimeout(stop.current) }
  }, [])

  const active = navigating || sending > 0
  return <div className={`navbar${active ? ' on' : ''}`} role="progressbar" aria-hidden={!active} aria-label="Loading"><span /></div>
}
