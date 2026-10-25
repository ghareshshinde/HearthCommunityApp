'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'
import { ticketFromScan } from '@/lib/ticket-scan'

/** Camera scanner that runs in the phone browser: no app to install. Falls back to typing or searching when the camera is blocked. */
export default function QrScanner({ slug }: { slug: string }) {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const [on, setOn] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!on) return
    let stop = false
    let stream: MediaStream | undefined
    const canvas = document.createElement('canvas')
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const tick = () => {
          if (stop || !video.current) return
          const v = video.current
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!
            ctx.drawImage(v, 0, 0)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(img.data, img.width, img.height)
            if (code?.data) {
              const t = ticketFromScan(code.data)
              if (/^t\d+\.[0-9a-f]{20}$/.test(t)) { setOn(false); router.push(`/c/${slug}/staff/gate?t=${encodeURIComponent(t)}`); return }
              setMsg('That is not a Hearth ticket')
            }
          }
          requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setMsg('Camera not available. Search by name, mobile or reference instead.')
        setOn(false)
      }
    })()
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, [on, router, slug])

  return (
    <div>
      {!on && <button type="button" className="btn" style={{ minHeight: 56, width: '100%', fontSize: '1.1rem' }} onClick={() => { setMsg(''); setOn(true) }}>Scan ticket QR</button>}
      {on && (
        <div>
          <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '60vh', objectFit: 'cover' }} />
          <button type="button" className="btn outline" onClick={() => setOn(false)}>Stop camera</button>
        </div>
      )}
      {msg && <p role="status" className="warn">{msg}</p>}
    </div>
  )
}
