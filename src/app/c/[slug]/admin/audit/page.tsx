import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import { listAudit, listOutbox } from '@/lib/repo'
import { formatIst } from '@/lib/time'

export default async function Audit({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug, true)
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back</Link></p>
      <h1>Audit log</h1>
      <table className="data"><thead><tr><th>When (IST)</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>{listAudit(c.id).map((a) => <tr key={a.id}><td>{formatIst(a.at, { dateStyle: 'short', timeStyle: 'medium' })}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.target}</td><td><code>{a.meta}</code></td></tr>)}</tbody></table>
      <h2>Outbox (emails not sent: SMTP not configured)</h2>
      <table className="data"><tbody>{listOutbox(c.id).map((m) => <tr key={m.id}><td>{formatIst(m.at)}</td><td>{m.to_email}</td><td>{m.subject}</td><td>{m.body}</td></tr>)}</tbody></table>
    </main>
  )
}
