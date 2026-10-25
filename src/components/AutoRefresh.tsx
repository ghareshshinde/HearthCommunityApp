'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Re-reads the page from the shared database every few seconds, so every admin sees the same live data. */
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, seconds * 1000)
    return () => clearInterval(t)
  }, [router, seconds])
  return null
}
