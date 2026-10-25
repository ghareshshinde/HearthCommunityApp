'use client'
export default function ShareButton({ title, className = 'btn outline' }: { title: string; className?: string }) {
  async function share() {
    const data = { title, url: location.href }
    if (navigator.share) await navigator.share(data).catch(() => {})
    else await navigator.clipboard?.writeText(location.href)
  }
  return <button type="button" className={className} onClick={share}>Share</button>
}
