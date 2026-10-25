import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent } from '@/lib/repo'
import { listCompetitions, listEntries, listMatches, podium, roundName, type Competition } from '@/lib/sports-ops'
import { sportIcon } from '@/lib/sports'
import AutoRefresh from '@/components/AutoRefresh'
import Pic from '@/components/Pic'

/** Public results: winners as finals are entered, brackets once a coordinator has published a round, and a name search for families. Names and results only. */
export default async function Results({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug, id } = await params
  const { q } = await searchParams
  const c = await requireCommunity(slug)
  const ev = getEvent(c.id, Number(id))
  if (!ev || ev.status === 'draft') notFound()
  const comps = listCompetitions(c.id, ev.id).filter((k) => k.drawn)
  const needle = q?.trim().toLowerCase()
  const data = comps.map((k) => ({ k, pod: podium(c.id, k.id), ms: listMatches(c.id, k.id), entries: listEntries(c.id, k.id) }))
  const finished = data.filter((d) => d.pod.complete)
  const mine = needle && needle.length >= 2
    ? data.flatMap((d) => {
        const ids = new Set(d.entries.filter((e) => e.players.some((p) => p.name.toLowerCase().includes(needle)) || e.name.toLowerCase().includes(needle)).map((e) => e.id))
        return d.ms.filter((m) => (d.pod.complete || visible(d.k, m.round, m.kind, d.ms)) && (ids.has(m.a_entry ?? -1) || ids.has(m.b_entry ?? -1))).map((m) => ({ d, m }))
      })
    : []
  return (
    <main>
      <AutoRefresh seconds={8} />
      <p><Link href={`/c/${slug}/e/${id}`}>{ev.title}</Link></p>
      <h1>Results</h1>
      <form method="get" style={{ display: 'flex', gap: '.5rem', maxWidth: '28rem' }}>
        <input name="q" defaultValue={q} placeholder="Find a player or family" aria-label="Find a player" style={{ flexGrow: 1, minHeight: 44 }} />
        <button className="btn">Find</button>
      </form>
      {needle && (
        <section className="card" style={{ margin: '1rem 0' }}>
          <h2 style={{ marginTop: 0 }}>Matches for &ldquo;{q}&rdquo;</h2>
          {mine.length === 0 && <p className="muted">Nothing published for that name yet.</p>}
          {mine.map(({ d, m }) => (
            <p key={m.id} style={{ margin: '.4rem 0' }}>
              <strong>{d.k.sport}</strong> · {d.k.name} · {label(d.k, m)}: {m.aName || 'TBD'} vs {m.bName || 'TBD'}
              {m.status === 'done' ? <> → <strong>{m.winnerName}</strong> won {m.score}</> : m.court || m.scheduled_at ? <> · {m.court} {m.scheduled_at}</> : null}
            </p>
          ))}
        </section>
      )}

      <h2>Winners</h2>
      {finished.length === 0 && <p className="muted">Winners appear here as soon as each final is played.</p>}
      <div className="grid">
        {finished.map(({ k, pod }) => (
          <div key={k.id} className="card">
            <div className="person"><Pic src={sportIcon(k.sport)} size={40} /><strong>{k.sport}: {k.name}</strong></div>
            <ol style={{ lineHeight: 1.8, paddingLeft: '1.2rem' }}>
              <li><strong>1st</strong> {pod.first.map((e) => e.name).join(', ')}</li>
              <li>2nd {pod.second.map((e) => e.name).join(', ')}</li>
              {pod.third.length > 0 && <li>3rd {pod.third.map((e) => e.name).join(' and ')}</li>}
            </ol>
          </div>
        ))}
      </div>

      <h2>Brackets</h2>
      {data.filter((d) => d.k.published_rounds > 0 || d.pod.complete).length === 0 && <p className="muted">Brackets appear here when a coordinator publishes the first round.</p>}
      {data.filter((d) => d.k.published_rounds > 0 || d.pod.complete).map(({ k, ms, pod }) => {
        const rounds = Math.max(...ms.map((m) => m.round))
        const shown = ms.filter((m) => !m.bye && (pod.complete || visible(k, m.round, m.kind, ms)))
        const names = [...new Set(shown.map((m) => (m.kind === 'third' ? rounds : m.round)))].sort((a, b) => a - b)
        return (
          <section key={k.id} className="card" style={{ margin: '1rem 0' }}>
            <div className="person"><Pic src={sportIcon(k.sport)} size={36} /><h3 style={{ margin: 0 }}>{k.sport}: {k.name}</h3></div>
            {names.map((r) => (
              <div key={r}>
                <h4 style={{ margin: '.75rem 0 .25rem' }}>{k.format === 'roundrobin' ? `Round ${r}` : roundName(r, rounds, 'main')}</h4>
                {shown.filter((m) => (m.kind === 'third' ? rounds : m.round) === r).map((m) => (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '.5rem', padding: '.35rem 0', borderTop: '1px solid var(--color-border)' }}>
                    <span>
                      <span className={m.winner && m.winner === m.a_entry ? 'won' : m.winner ? 'lost' : ''}>{m.aName || 'TBD'}</span>{' vs '}
                      <span className={m.winner && m.winner === m.b_entry ? 'won' : m.winner ? 'lost' : ''}>{m.bName || 'TBD'}</span>
                      {m.kind === 'third' ? <small className="muted"> (third place)</small> : null}
                    </span>
                    <span className="muted">{m.status === 'done' ? `${m.winnerName} won${m.score ? ` ${m.score}` : ''}` : m.status === 'live' ? <strong style={{ color: 'var(--color-error)' }}>LIVE {m.court}</strong> : `${m.court} ${m.scheduled_at}`.trim()}</span>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )
      })}
      <p className="muted" style={{ fontSize: '.85rem' }}>Names and results only. No contact details are shown.</p>
    </main>
  )
}

/** A match is public once its round is published, or the whole category has finished. */
function visible(k: Competition, round: number, kind: string, ms: { round: number; kind: string }[]) {
  const rounds = Math.max(...ms.map((m) => m.round))
  return round <= k.published_rounds || (kind === 'third' && rounds <= k.published_rounds)
}
const label = (k: Competition, m: { round: number; kind: string }) => (k.format === 'roundrobin' ? `Round ${m.round}` : m.kind === 'third' ? 'Third place' : `Round ${m.round}`)
