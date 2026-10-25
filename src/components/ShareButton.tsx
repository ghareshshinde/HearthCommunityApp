'use client'
export default function ShareButton({ title }: { title: string }) {
  async function share() {
    const data = { title, url: location.href }
    if (navigator.share) await navigator.share(data).catch(() => {})
    else await navigator.clipboard?.writeText(location.href)
  }
  return <button type="button" className="btn outline" onClick={share}>Share</button>
}
