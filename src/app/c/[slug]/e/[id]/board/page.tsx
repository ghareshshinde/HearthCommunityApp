import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { requireCommunity } from '@/lib/session'
import { getEvent, listRows } from '@/lib/repo'
import { listCompetitions, listMatches, podium, roundName, standings, listEntries, type Competition, type Match } from '@/lib/sports-ops'
import { sportIcon } from '@/lib/sports'
import AutoRefresh from '@/components/AutoRefresh'
import BoardCycle from '@/components/BoardCycle'

export const dynamic = 'force-dynamic'

type State = 'done' | 'live' | 'next' | 'wait'
const stateOf = (m: Match, shown: boolean): State => (!shown ? 'wait' : m.status === 'done' ? 'done' : m.status === 'live' ? 'live' : m.a_entry && m.b_entry ? 'next' : 'wait')

/** Only published rounds show names; later rounds appear as waiting boxes so the shape of the bracket is visible. */
function visible(k: Competition, m: Match, rounds: number) {
  return m.round <= k.published_rounds || (m.kind === 'third' && rounds <= k.published_rounds)
}

function Card({ m, state, shown, label }: { m: Match; state: State; shown: boolean; label: string }) {
  const done = state === 'done'
  const row = (name: string, entry: number | null, score: boolean) => {
    const won = done && m.winner && m.winner === entry
    const lost = done && m.winner && m.winner !== entry
    return <div className={`b-t${won ? ' win' : ''}${lost ? ' lose' : ''}`}><span>{shown ? name || 'TBD' : 'TBD'}</span>{score && won && m.score ? <b>{m.score.split(',')[0]}</b> : null}</div>
  }
  return (
    <div className={`b-m ${state}`}>
      <i className={`b-lb${state === 'live' ? ' live' : ''}`}>{state === 'live' ? `${m.court || 'On court'} · live` : [m.court, m.scheduled_at, state === 'done' ? 'done' : label].filter(Boolean).join(' · ')}</i>
      {row(m.aName, m.a_entry, true)}{row(m.bName, m.b_entry, true)}
      {done && m.score && <small className="b-score">{m.score}</small>}
      <span className={`b-node ${state}`} />
    </div>
  )
}

function Bracket({ k, ms, complete }: { k: Competition; ms: Match[]; complete: boolean }) {
  const rounds = Math.max(...ms.map((m) => m.round))
  const main = ms.filter((m) => m.kind === 'main')
  const third = ms.find((m) => m.kind === 'third')
  const cols = Array.from({ length: rounds }, (_, i) => i + 1)
  return (
    <div className="b-bracket">
      {cols.map((r) => {
        const list = main.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot)
        return (
          <div key={r} className="b-col">
            <h3>{roundName(r, rounds, 'main')}</h3>
            <div className="b-cells">
              {list.map((m, n) => {
                const shown = complete || visible(k, m, rounds)
                return (
                  <div key={m.id} className={`b-cell${r < rounds ? (n % 2 ? ' lower' : ' upper') : ''}${r > 1 ? ' in' : ''}`}>
                    {m.bye ? <div className="b-bye">{shown ? (m.aName || m.bName) : 'TBD'} · bye</div> : <Card m={m} state={stateOf(m, shown)} shown={shown} label={roundName(r, rounds, 'main')} />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {third && (
        <div className="b-col third">
          <h3>Third place</h3>
          <div className="b-cells"><div className="b-cell"><Card m={third} state={stateOf(third, complete || visible(k, third, rounds))} shown={complete || visible(k, third, rounds)} label="Third place" /></div></div>
        </div>
      )}
    </div>
  )
}

export default async function Board({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug)
  const ev = getEvent(c.id, Number(id))
  if (!ev || ev.status === 'draft') notFound()
  const comps = listCompetitions(c.id, ev.id).filter((k) => k.drawn)
  const data = comps.map((k) => ({ k, ms: listMatches(c.id, k.id), pod: podium(c.id, k.id), entries: listEntries(c.id, k.id) }))
  const shownData = data.filter((d) => d.k.published_rounds > 0 || d.pod.complete)
  const all = data.flatMap((d) => d.ms.filter((m) => !m.bye && (d.k.published_rounds >= m.round || d.pod.complete)).map((m) => ({ d, m })))
  const live = all.filter((x) => x.m.status === 'live')
  const next = all.filter((x) => x.m.status !== 'done' && x.m.status !== 'live' && x.m.a_entry && x.m.b_entry)
    .sort((a, b) => (a.m.scheduled_at || '~').localeCompare(b.m.scheduled_at || '~') || a.m.round - b.m.round).slice(0, 4)
  const rows = listRows(c.id, ev.id)
  const arrived = rows.filter((r) => r.checked_in_at && r.reg_status !== 'cancelled').length
  const total = data.flatMap((d) => d.ms.filter((m) => !m.bye)).length
  const done = data.flatMap((d) => d.ms.filter((m) => !m.bye && m.status === 'done')).length
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
  const qr = await QRCode.toString(`${origin}/c/${slug}/e/${ev.id}/results`, { type: 'svg', margin: 0, width: 96, errorCorrectionLevel: 'M' })
  const nameOf = (m: Match) => `${m.aName} vs ${m.bName}`

  const panels = shownData.map(({ k, ms, pod, entries }) => (
    <section key={k.id} className="b-panel" aria-label={`${k.sport} ${k.name}`}>
      {pod.complete && (
        <div className="b-podium">
          <Image src="/img/trophy.svg" alt="" width={80} height={100} />
          <div><strong>Champion</strong><span>{pod.first.map((e) => e.name).join(', ')}</span></div>
          <div><strong>Runner-up</strong><span>{pod.second.map((e) => e.name).join(', ')}</span></div>
          {pod.third.length > 0 && <div><strong>Third</strong><span>{pod.third.map((e) => e.name).join(' and ')}</span></div>}
        </div>
      )}
      {k.format === 'knockout'
        ? <Bracket k={k} ms={ms} complete={pod.complete} />
        : (
          <table className="b-table">
            <thead><tr><th>#</th><th>Player</th><th>Played</th><th>Won</th><th>Lost</th></tr></thead>
            <tbody>{standings(c.id, k.id).map((s) => <tr key={s.entry.id}><td>{s.rank}</td><td>{s.entry.name}</td><td>{s.played}</td><td>{s.wins}</td><td>{s.losses}</td></tr>)}</tbody>
          </table>
        )}
      <p className="b-note">{entries.length} entries · {ms.filter((m) => !m.bye && m.status === 'done').length} of {ms.filter((m) => !m.bye).length} matches played</p>
    </section>
  ))

  return (
    <div className="board">
      <AutoRefresh seconds={6} />
      <header className="b-head">
        <div className="b-title">
          {c.brand.logo && <Image src={c.brand.logo} alt="" width={72} height={72} style={{ borderRadius: '50%' }} />}
          <div><h1>{ev.title}</h1><p>Live scores and brackets</p></div>
        </div>
        <div className="b-stats">
          <div><span>Checked in</span><b>{arrived}</b></div>
          <div><span>Matches done</span><b>{done} / {total}</b></div>
          <div className="b-qr"><div dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="QR code for results on your phone" /><small>Find your family</small></div>
        </div>
      </header>
      {shownData.length === 0 ? (
        <div className="b-empty"><Image src="/img/trophy.svg" alt="" width={160} height={200} /><p>Brackets appear here when the first round is published.</p><Link href={`/c/${slug}/e/${ev.id}`}>{ev.title}</Link></div>
      ) : (
        <BoardCycle
          tabs={shownData.map(({ k }) => ({ id: k.id, label: `${k.sport}: ${k.name}`, icon: sportIcon(k.sport) }))}
          panels={panels}
        />
      )}
      <div className="b-legend"><span><i className="b-node done" />Done</span><span><i className="b-node live" />Live</span><span><i className="b-node next" />Up next</span><span><i className="b-node wait" />Waiting</span></div>
      <footer className="b-foot">
        <div className="b-now">
          <strong className="chip blue">On court now</strong>
          {live.length ? live.map(({ d, m }) => <span key={m.id}>{m.court || d.k.sport}: {nameOf(m)}</span>) : <span className="dim">No match in progress</span>}
        </div>
        <div className="b-now">
          <strong className="chip gold">Up next</strong>
          {next.length ? next.map(({ d, m }) => <span key={m.id}>{m.court || d.k.sport}{m.scheduled_at ? ` ${m.scheduled_at}` : ''}: {nameOf(m)}</span>) : <span className="dim">Nothing scheduled yet</span>}
        </div>
      </footer>
    </div>
  )
}
