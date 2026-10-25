import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canSeeSport, getActor, requireActor } from '@/lib/session'
import { eligiblePlayers, getCompetition, listEntries, listMatches, listPartnerRequests, podium, roundName, standings, suggestPairs, type Match } from '@/lib/sports-ops'
import * as A from '@/app/sports-actions'
import { sportIcon } from '@/lib/sports'
import { formatIst } from '@/lib/time'
import AutoRefresh from '@/components/AutoRefresh'
import Pic from '@/components/Pic'
import ConfirmButton from '@/components/ConfirmButton'

const FORMAT: Record<string, string> = { knockout: 'Knockout', roundrobin: 'Round robin' }
const SKILL: Record<string, string> = { competitive: 'competitive', casual: 'casual', beginner: 'beginner', '': '' }

export default async function Console({ params, searchParams }: { params: Promise<{ slug: string; sport: string; cid: string }>; searchParams: Promise<{ msg?: string; err?: string; warn?: string }> }) {
  const { slug, sport: raw, cid } = await params
  const sport = decodeURIComponent(raw)
  const q = await searchParams
  const { c, actor } = await requireActor(slug, (a) => canSeeSport(a, sport))
  const comp = getCompetition(c.id, Number(cid))
  if (!comp || comp.sport !== sport) notFound()
  const isAdmin = (await getActor(slug))?.kind === 'admin'
  const entries = listEntries(c.id, comp.id)
  const live = entries.filter((e) => !e.withdrawn)
  const matches = listMatches(c.id, comp.id)
  const pod = podium(c.id, comp.id)
  const base = `/c/${slug}/staff/sport/${encodeURIComponent(sport)}`
  const rounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0
  const noResults = !matches.some((m) => m.status === 'done' && !m.bye)
  const locked = !!comp.locked
  const pool = comp.drawn ? [] : eligiblePlayers(c.id, comp)
  const suggestions = comp.entry_type === 'doubles' && !comp.drawn ? suggestPairs(c.id, comp) : []
  const requests = comp.entry_type === 'doubles' ? listPartnerRequests(c.id, comp.event_id, comp.sport) : []
  const nameOfPlayer = new Map(pool.map((p) => [p.id, p.name]))
  void actor
  const roundList = [...new Set(matches.map((m) => `${m.kind === 'third' ? rounds : m.round}`))].map(Number).sort((a, b) => a - b)

  return (
    <main className="wide" style={{ maxWidth: '60rem' }}>
      <AutoRefresh seconds={6} />
      <p><Link href={base}>Players</Link> · <Link href={`${base}/categories`}>All categories</Link></p>
      <div className="person"><Pic src={sportIcon(sport)} size={56} />
        <div><h1 style={{ margin: 0 }}>{comp.name}</h1>
          <span className="muted">{sport} · {FORMAT[comp.format]} · {comp.entry_type}{comp.gender ? ` · ${comp.gender}` : ''}{comp.min_age ? ` · from ${comp.min_age}` : ''}{comp.max_age ? ` · up to ${comp.max_age}` : ''}</span></div>
      </div>
      {q.msg && <p className="card" role="status" style={{ borderColor: 'var(--color-success)' }}>{q.msg}</p>}
      {q.err && <p className="warn" role="alert">{q.err}</p>}
      {q.warn && <p className="warn" role="alert"><strong>Heads up:</strong> {q.warn}</p>}
      {locked && <p className="warn" role="status"><strong>Results are locked by the event admin.</strong> Nothing here can change until they reopen it.</p>}

      {pod.complete && (
        <section className="card" style={{ borderColor: 'var(--color-accent)', margin: '1rem 0' }}>
          <div className="person"><Pic src="/img/trophy.svg" width={44} height={56} /><h2 style={{ margin: 0 }}>Podium</h2></div>
          <ol style={{ fontSize: '1.15rem', lineHeight: 1.8 }}>
            <li><strong>1st</strong> {pod.first.map((e) => e.name).join(', ')}</li>
            <li><strong>2nd</strong> {pod.second.map((e) => e.name).join(', ')}</li>
            {pod.third.length > 0 && <li><strong>3rd</strong> {pod.third.map((e) => e.name).join(' and ')}</li>}
          </ol>
          {pod.unresolvedTie && <p className="warn" role="alert">Two or more entries are level on wins for a podium place. Decide the order with a play-off, then tell the event admin.</p>}
        </section>
      )}

      {/* ---------- entries ---------- */}
      <section className="card" style={{ margin: '1rem 0' }}>
        <h2 style={{ marginTop: 0 }}>Entries ({live.length})</h2>
        {entries.length === 0 && <p className="muted">Nobody entered yet.</p>}
        <table className="data">
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} style={e.withdrawn ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                <td style={{ width: '2.5rem' }}>{comp.drawn ? e.seed : i + 1}</td>
                <td><strong>{e.name}</strong><br /><small className="muted">{e.players.map((p) => `${p.age}, ${SKILL[p.skill] ?? p.skill}`).join(' · ')}</small></td>
                <td style={{ textAlign: 'right' }}>
                  {!comp.drawn && !locked && (
                    <>
                      <form action={A.seedAction.bind(null, slug, comp.id, 'up', e.id)} style={{ display: 'inline' }}><button aria-label={`Move ${e.name} up`}>Up</button></form>{' '}
                      <form action={A.seedAction.bind(null, slug, comp.id, 'down', e.id)} style={{ display: 'inline' }}><button aria-label={`Move ${e.name} down`}>Down</button></form>{' '}
                      <form action={A.removeEntryAction.bind(null, slug, comp.id, e.id)} style={{ display: 'inline' }}><button aria-label={`Remove ${e.name}`}>Remove</button></form>
                    </>
                  )}
                  {comp.drawn && !e.withdrawn && !locked && (
                    <form action={A.withdrawAction.bind(null, slug, comp.id, e.id)} style={{ display: 'inline' }}><ConfirmButton message={`Mark ${e.name} as withdrawn? Their remaining opponents get a walkover.`} secondary>Withdraw</ConfirmButton></form>
                  )}
                  {e.withdrawn ? <span className="tag">withdrawn</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!comp.drawn && !locked && (
          <>
            <h3>Add players who have arrived</h3>
            {pool.length === 0 && <p className="muted">Nobody else is available. Only players who have been checked in at the gate, registered for {sport} and fitting this category appear here.</p>}
            {pool.length > 0 && (
              <form action={A.addEntryAction.bind(null, slug, comp.id)} style={{ display: 'grid', gap: '.5rem' }}>
                <div style={{ display: 'grid', gap: '.25rem', maxHeight: '18rem', overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: '.5rem' }}>
                  {pool.map((p) => (
                    <label key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: '.6rem', minHeight: 40, fontSize: '1rem' }}>
                      <input type="checkbox" name="ids" value={p.id} style={{ width: 22, height: 22 }} />
                      <span><strong>{p.name}</strong>, {p.age} {p.gender[0]} <small className="muted">{SKILL[p.skill] ?? p.skill}</small></span>
                    </label>
                  ))}
                </div>
                {comp.entry_type === 'team' && <label>Team name<input name="teamName" placeholder="Team Lotus" maxLength={40} /></label>}
                <p style={{ margin: 0 }}>
                  <button className="btn">{comp.entry_type === 'singles' ? 'Add selected players' : comp.entry_type === 'doubles' ? 'Make a pair from the two selected' : `Make a team from the selected (up to ${comp.team_size})`}</button>
                  {comp.entry_type === 'singles' && <button className="btn outline" formAction={A.addAllSinglesAction.bind(null, slug, comp.id)} style={{ marginLeft: '.5rem' }}>Add everyone</button>}
                </p>
              </form>
            )}

            {comp.entry_type === 'doubles' && (
              <>
                <h3>Partner requests</h3>
                <p className="muted" style={{ marginTop: 0 }}>Note who asked to play with whom. You decide the pairs: suggestions never create anything by themselves.</p>
                {requests.map((r) => (
                  <p key={r.id} style={{ margin: '.25rem 0' }}>{nameOfPlayer.get(r.from_pid) ?? `Player ${r.from_pid}`} asked for {nameOfPlayer.get(r.to_pid) ?? `player ${r.to_pid}`}{r.note ? ` (${r.note})` : ''}{' '}
                    <form action={A.removeRequestAction.bind(null, slug, comp.id, r.id)} style={{ display: 'inline' }}><button>Remove</button></form></p>
                ))}
                {pool.length > 1 && (
                  <form action={A.partnerRequestAction.bind(null, slug, comp.id)} style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label>Player<select name="from">{pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                    <label>wants to play with<select name="to">{pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                    <label>Note<input name="note" maxLength={120} /></label>
                    <button className="btn outline">Note the request</button>
                  </form>
                )}
                <h3>Suggested pairs</h3>
                {suggestions.length === 0 && <p className="muted">No suggestions: fewer than two free players.</p>}
                {suggestions.map((s) => (
                  <form key={`${s.a.id}-${s.b.id}`} action={A.addSuggestedPairAction.bind(null, slug, comp.id, s.a.id, s.b.id)} className="person" style={{ padding: '.4rem 0', flexWrap: 'wrap' }}>
                    <span style={{ flexGrow: 1 }}><strong>{s.a.name}</strong> + <strong>{s.b.name}</strong> <small className="muted">{s.reason === 'mutual' ? 'both asked for each other' : s.reason === 'requested' ? 'one asked for the other' : `similar skill and age (${s.a.age}, ${s.b.age})`}</small></span>
                    <button className="btn outline">Create this pair</button>
                  </form>
                ))}
              </>
            )}
            {live.length > 1 && <form action={A.seedAction.bind(null, slug, comp.id, 'auto', null)} style={{ marginTop: '.75rem' }}><button className="btn outline">Seed by skill</button> <span className="muted">Strongest entries are seeded first and get the byes. Adjust with Up and Down.</span></form>}
          </>
        )}
      </section>

      {/* ---------- draw ---------- */}
      {!comp.drawn && !locked && (
        <section className="card" style={{ margin: '1rem 0' }}>
          <h2 style={{ marginTop: 0 }}>Make the draw</h2>
          <p className="muted">{live.length < 2 ? 'Add at least two entries first.' : `${live.length} entries. Nothing is shown to players until you publish a round.`}</p>
          <form action={A.drawAction.bind(null, slug, comp.id)}><button className="btn" disabled={live.length < 2}>Make the draw</button></form>
        </section>
      )}

      {/* ---------- matches ---------- */}
      {comp.drawn === 1 && (
        <>
          <h2>Matches</h2>
          {comp.format === 'roundrobin' && <Standings compId={comp.id} cid={c.id} />}
          {roundList.map((r) => {
            const inRound = matches.filter((m) => (m.kind === 'third' ? rounds : m.round) === r)
            const label = comp.format === 'roundrobin' ? `Round ${r}` : roundName(r, rounds, 'main')
            return (
              <section key={r} style={{ margin: '1.25rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
                  <h3 style={{ margin: 0 }}>{label} {comp.published_rounds >= r ? <span className="tag on">visible to players</span> : <span className="tag">not published</span>}</h3>
                  {!locked && (
                    <form action={A.publishAction.bind(null, slug, comp.id, comp.published_rounds >= r ? r - 1 : r)}>
                      <button className="btn outline">{comp.published_rounds >= r ? 'Hide this round' : `Publish ${label.toLowerCase()}`}</button>
                    </form>
                  )}
                </div>
                <div style={{ display: 'grid', gap: '.75rem', marginTop: '.5rem' }}>
                  {inRound.filter((m) => !m.bye).map((m) => <MatchCard key={m.id} m={m} slug={slug} locked={locked} kindLabel={m.kind === 'third' ? 'Third place' : ''} />)}
                  {inRound.filter((m) => m.bye).map((m) => <p key={m.id} className="muted" style={{ margin: 0 }}>Bye: {m.aName || m.bName} goes straight through.</p>)}
                </div>
              </section>
            )
          })}
          {noResults && !locked && <form action={A.drawAction.bind(null, slug, comp.id)}><ConfirmButton message="Make the draw again? The current draw is replaced." secondary>Redo the draw</ConfirmButton></form>}
        </>
      )}

      <section className="card" style={{ margin: '2rem 0 1rem' }}>
        <h2 style={{ marginTop: 0 }}>Admin</h2>
        {isAdmin ? (
          <form action={A.lockAction.bind(null, slug, comp.id, !locked, 'console')}><button className="btn outline">{locked ? 'Reopen results for changes' : 'Lock results (final)'}</button></form>
        ) : <p className="muted" style={{ margin: 0 }}>Only the event admin can lock or reopen results.</p>}
        {noResults && !locked && <form action={A.deleteCompetitionAction.bind(null, slug, comp.id)} style={{ marginTop: '.5rem' }}><ConfirmButton message="Delete this category and its draw?" secondary>Delete this category</ConfirmButton></form>}
      </section>
    </main>
  )
}

function Standings({ compId, cid }: { compId: number; cid: number }) {
  const st = standings(cid, compId)
  return (
    <table className="data" style={{ marginBottom: '1rem' }}>
      <thead><tr><th>#</th><th>Entry</th><th>Played</th><th>Won</th><th>Lost</th></tr></thead>
      <tbody>{st.map((s) => <tr key={s.entry.id}><td>{s.rank}</td><td>{s.entry.name}{s.tied && s.played > 0 ? <small className="wl"> level</small> : null}</td><td>{s.played}</td><td>{s.wins}</td><td>{s.losses}</td></tr>)}</tbody>
    </table>
  )
}

/** One match. Tap a winner's button to save the result straight away; score and "how it ended" are optional. */
function MatchCard({ m, slug, locked, kindLabel }: { m: Match; slug: string; locked: boolean; kindLabel: string }) {
  const ready = !!m.a_entry && !!m.b_entry
  const done = m.status === 'done'
  return (
    <div className="card" style={{ borderColor: m.status === 'live' ? 'var(--color-accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
        <strong>{kindLabel || `Match ${m.slot}`}</strong>
        <span className="muted">{m.court || 'No court yet'}{m.scheduled_at ? ` · ${m.scheduled_at}` : ''} · <span className="tag">{done ? 'done' : m.status === 'live' ? 'live' : ready ? 'ready' : 'waiting'}</span></span>
      </div>
      {!ready && <p className="muted" style={{ margin: '.5rem 0 0' }}>Waiting for {!m.a_entry && !m.b_entry ? 'both players' : 'the other player'} from the earlier round.</p>}
      {ready && (
        <form action={A.resultAction.bind(null, slug, m.id)} style={{ display: 'grid', gap: '.5rem', marginTop: '.5rem' }}>
          <input type="hidden" name="version" value={m.version} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
            <button name="side" value="a" disabled={locked} className={m.winner === m.a_entry ? 'btn' : 'btn outline'} style={{ minHeight: 56, fontSize: '1.05rem' }}>{m.aName}{m.winner === m.a_entry ? ' ✓ won' : ''}</button>
            <button name="side" value="b" disabled={locked} className={m.winner === m.b_entry ? 'btn' : 'btn outline'} style={{ minHeight: 56, fontSize: '1.05rem' }}>{m.bName}{m.winner === m.b_entry ? ' ✓ won' : ''}</button>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', minHeight: 36 }}>Score or how it ended</summary>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
              <label>Score<input name="score" defaultValue={m.score} placeholder="21-17, 21-19" maxLength={40} /></label>
              <label>How it ended<select name="outcome" defaultValue={m.outcome === 'bye' || !m.outcome ? 'played' : m.outcome}><option value="played">Played</option><option value="walkover">Walkover (other side absent)</option><option value="retired">Retired (injured or stopped)</option></select></label>
            </div>
            <p className="muted" style={{ margin: '.25rem 0 0' }}>Tap a name above to save the winner with these details.</p>
          </details>
        </form>
      )}
      {!locked && (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '.5rem' }}>
          <form action={A.scheduleAction.bind(null, slug, m.id)} style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label>Court<input name="court" defaultValue={m.court} placeholder="Court 2" maxLength={30} style={{ width: '7rem' }} /></label>
            <label>Time<input name="time" defaultValue={m.scheduled_at} placeholder="10:40" maxLength={20} style={{ width: '6rem' }} /></label>
            <button>Save</button>
          </form>
          {ready && !done && <form action={A.startMatchAction.bind(null, slug, m.id, m.status !== 'live')}><button>{m.status === 'live' ? 'Stop (not live)' : 'Start (live)'}</button></form>}
          {done && !m.bye && (
            <form action={A.clearResultAction.bind(null, slug, m.id)}><input type="hidden" name="version" value={m.version} /><ConfirmButton message="Clear this result? The winner is removed from the next round." secondary>Clear result</ConfirmButton></form>
          )}
        </div>
      )}
      {done && <p style={{ margin: '.5rem 0 0' }} className="muted">{m.outcome === 'walkover' ? 'Walkover. ' : m.outcome === 'retired' ? 'Retired. ' : ''}{m.score}{m.updated_by ? ` · entered by ${m.updated_by}${m.updated_at ? ` at ${formatIst(m.updated_at, { timeStyle: 'short' })}` : ''}` : ''}</p>}
    </div>
  )
}
