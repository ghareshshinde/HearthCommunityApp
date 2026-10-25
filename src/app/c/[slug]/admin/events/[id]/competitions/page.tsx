import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent } from '@/lib/repo'
import { listCompetitions, listEntries, listMatches, podium } from '@/lib/sports-ops'
import { lockAction } from '@/app/sports-actions'
import { sportIcon } from '@/lib/sports'
import Pic from '@/components/Pic'
import ConfirmButton from '@/components/ConfirmButton'

export default async function CompetitionsAdmin({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug, true)
  const ev = getEvent(c.id, Number(id))
  if (!ev) notFound()
  const comps = listCompetitions(c.id, ev.id)
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back</Link> · <Link href={`/c/${slug}/e/${ev.id}/results`}>Public results page</Link></p>
      <h1>Sports and results: {ev.title}</h1>
      <p className="muted">Coordinators run their own categories. You can see everything here, open any category, and lock a category once its final is entered so nothing can change by accident.</p>
      <table className="data">
        <thead><tr><th>Sport</th><th>Category</th><th>Format</th><th>Entries</th><th>Progress</th><th>Winner</th><th /></tr></thead>
        <tbody>
          {comps.map((k) => {
            const ms = listMatches(c.id, k.id).filter((m) => !m.bye), pod = podium(c.id, k.id)
            return (
              <tr key={k.id}>
                <td><span className="person"><Pic src={sportIcon(k.sport)} size={28} />{k.sport}</span></td>
                <td><Link href={`/c/${slug}/staff/sport/${encodeURIComponent(k.sport)}/categories/${k.id}`}>{k.name}</Link> {k.locked ? <span className="tag">locked</span> : null}</td>
                <td>{k.format === 'knockout' ? 'Knockout' : 'Round robin'}, {k.entry_type}</td>
                <td>{listEntries(c.id, k.id).filter((e) => !e.withdrawn).length}</td>
                <td>{k.drawn ? `${ms.filter((m) => m.status === 'done').length} of ${ms.length} played, ${k.published_rounds} round(s) published` : 'not drawn'}</td>
                <td>{pod.complete ? pod.first.map((e) => e.name).join(', ') : ''}</td>
                <td>
                  <form action={lockAction.bind(null, slug, k.id, !k.locked, 'admin')}>
                    {k.locked ? <button>Reopen</button> : <ConfirmButton message="Lock this category? Nobody can change results until you reopen it." secondary>Lock</ConfirmButton>}
                  </form>
                </td>
              </tr>
            )
          })}
          {comps.length === 0 && <tr><td colSpan={7} className="muted">No categories yet. Sport admins create them from their sport page.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
