import Link from 'next/link'
import { currentEvent } from '@/lib/repo'
import { canSeeSport, requireActor } from '@/lib/session'
import { listCompetitions, listEntries, listMatches, podium } from '@/lib/sports-ops'
import { createCompetitionAction } from '@/app/sports-actions'
import { defaultTeamSize, sportFormats, sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'

const FORMAT: Record<string, string> = { knockout: 'Knockout', roundrobin: 'Round robin' }

export default async function Categories({ params, searchParams }: { params: Promise<{ slug: string; sport: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { slug, sport: raw } = await params
  const sport = decodeURIComponent(raw)
  const q = await searchParams
  const { c } = await requireActor(slug, (a) => canSeeSport(a, sport))
  const ev = currentEvent(c.id)
  if (!ev) return <main><p>No event yet.</p></main>
  const comps = listCompetitions(c.id, ev.id, sport)
  const base = `/c/${slug}/staff/sport/${encodeURIComponent(sport)}`
  return (
    <main>
      <p><Link href={base}>Players</Link> · <strong>Categories and results</strong></p>
      <div className="person"><Pic src={sportIcon(sport)} size={56} /><h1 style={{ margin: 0 }}>{sport}: categories</h1></div>
      <p className="muted">A category is one competition, for example &ldquo;Men&apos;s singles&rdquo; or &ldquo;Under 12 doubles&rdquo;. You choose who is in it, make the draw, enter the results and publish the rounds.</p>
      {q.msg && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}>{q.msg}</p>}
      {q.err && <p className="warn" role="alert">{q.err}</p>}

      <div className="grid">
        {comps.map((k) => {
          const entries = listEntries(c.id, k.id), ms = listMatches(c.id, k.id), pod = podium(c.id, k.id)
          const doneN = ms.filter((m) => m.status === 'done' && !m.bye).length, total = ms.filter((m) => !m.bye).length
          return (
            <Link key={k.id} href={`${base}/categories/${k.id}`} className="card">
              <h3 style={{ margin: 0 }}>{k.name} {k.locked ? <span className="tag">locked</span> : null}</h3>
              <p className="muted" style={{ margin: '.25rem 0' }}>{FORMAT[k.format]} · {k.entry_type} · {entries.filter((e) => !e.withdrawn).length} entries</p>
              <p style={{ margin: 0 }}>{k.drawn ? `${doneN} of ${total} matches played` : 'Draw not made yet'}{pod.complete ? ` · Winner: ${pod.first.map((e) => e.name).join(', ')}` : ''}</p>
            </Link>
          )
        })}
        {comps.length === 0 && <p className="muted">No categories yet. Create the first one below.</p>}
      </div>

      <h2>New category</h2>
      <form action={createCompetitionAction.bind(null, slug, ev.id, sport)} className="card" style={{ display: 'grid', gap: '.75rem', maxWidth: '36rem' }}>
        <label>Name<input name="name" required placeholder="Men's singles" maxLength={60} /></label>
        <div className="fields">
          <label>Who plays
            <select name="entryType" defaultValue={sportFormats(sport)[0]}>
              {sportFormats(sport).includes('singles') && <option value="singles">Singles (one player)</option>}
              {sportFormats(sport).includes('doubles') && <option value="doubles">Doubles (pairs)</option>}
              {sportFormats(sport).includes('team') && <option value="team">Teams</option>}
            </select>
          </label>
          <label>Format
            <select name="format" defaultValue="knockout"><option value="knockout">Knockout</option><option value="roundrobin">Round robin (everyone plays everyone)</option></select>
          </label>
          {sportFormats(sport).includes('team') && <label>Team size<input name="teamSize" type="number" min={2} max={15} defaultValue={defaultTeamSize(sport)} /></label>}
          <label>Gender
            <select name="gender" defaultValue=""><option value="">Open to all</option><option>Male</option><option>Female</option></select>
          </label>
          <label>Minimum age<input name="minAge" type="number" min={1} max={99} /></label>
          <label>Maximum age<input name="maxAge" type="number" min={1} max={99} /></label>
          <label>Third place (knockout)
            <select name="thirdPlace" defaultValue="match"><option value="match">Play a third-place match</option><option value="joint">Joint bronze (both semi-final losers)</option></select>
          </label>
        </div>
        <p><button className="btn">Create category</button></p>
      </form>
    </main>
  )
}
