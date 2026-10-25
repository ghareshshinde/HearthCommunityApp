/** Shown at once while a page is being prepared, so a tap on a link never looks stuck. */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="skel skel-line" /><div className="skel skel-line short" />
      <div className="skel-grid"><div className="skel skel-card" /><div className="skel skel-card" /><div className="skel skel-card" /></div>
    </main>
  )
}
