import nodemailer from 'nodemailer'
import { getDb } from './db'
import { persist } from './persist'

type Row = { id: number; to_email: string; subject: string; body: string; attempts: number }

export const mailConfigured = () => !!process.env.SMTP_URL

/**
 * Sends everything waiting in the outbox through the SMTP server named in SMTP_URL (for example
 * smtps://user:app-password@smtp.gmail.com:465). With no SMTP_URL the outbox just accumulates and the admin can read it.
 * A failed send stays in the outbox and is retried, up to 5 times.
 */
export async function sendQueued(limit = 20): Promise<{ sent: number; failed: number }> {
  const url = process.env.SMTP_URL
  const d = getDb()
  if (!url) return { sent: 0, failed: 0 }
  const rows = d.prepare('select id,to_email,subject,body,attempts from outbox where sent = 0 and attempts < 5 order by id limit ?').all(limit) as unknown as Row[]
  if (!rows.length) return { sent: 0, failed: 0 }
  const transport = nodemailer.createTransport(url)
  let sent = 0, failed = 0
  for (const m of rows) {
    try {
      await transport.sendMail({ from: process.env.EMAIL_FROM ?? 'Hearth <no-reply@localhost>', replyTo: process.env.EMAIL_REPLY_TO || undefined, to: m.to_email, subject: m.subject, text: m.body })
      d.prepare('update outbox set sent = 1, error = null where id = ?').run(m.id)
      sent++
    } catch (e) {
      d.prepare('update outbox set attempts = attempts + 1, error = ? where id = ?').run(String((e as Error).message).slice(0, 200), m.id)
      failed++
    }
  }
  return { sent, failed }
}

/** Best effort after a request: never delays the person for long and never fails their registration. */
export async function deliverEmails(maxMs = 6000) {
  if (!mailConfigured()) return
  try {
    await Promise.race([sendQueued(), new Promise((r) => setTimeout(r, maxMs))])
    await persist() // so a restart does not re-send what already went out
  } catch (e) {
    console.error('email delivery failed', e)
  }
}
