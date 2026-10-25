import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import { listAudit, listOutbox } from '@/lib/repo'
import { formatIst } from '@/lib/time'
import { retryEmailsAction } from '@/app/actions'
import { mailConfigured } from '@/lib/mail'

export default async function Audit({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug, true)
  return (
    <main className="wide">
      <p><Link href={`/c/${slug}/admin`}>Back</Link></p>
      <h1>Audit log</h1>
      <table className="data"><thead><tr><th>When (IST)</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>{listAudit(c.id).map((a) => <tr key={a.id}><td>{formatIst(a.at, { dateStyle: 'short', timeStyle: 'medium' })}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.target}</td><td><code>{a.meta}</code></td></tr>)}</tbody></table>
      <h2>Emails</h2>
      <p className="muted">{mailConfigured() ? 'Sending is on. Failed emails are retried up to 5 times.' : 'Sending is off (no SMTP_URL set), so these are only recorded here.'}</p>
      {mailConfigured() && <form action={retryEmailsAction.bind(null, slug)}><button className="btn outline">Retry unsent emails</button></form>}
      <table className="data"><tbody>{listOutbox(c.id).map((m) => <tr key={m.id}><td>{formatIst(m.at)}</td><td>{m.to_email}</td><td>{m.subject}</td><td>{m.sent ? 'sent' : m.error ? `failed (${m.attempts}): ${m.error}` : 'waiting'}</td></tr>)}</tbody></table>
    </main>
  )
}
