import net from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'
import { makeTicket, ticketFromScan } from '@/lib/ticket'
import { sendQueued } from '@/lib/mail'

beforeEach(() => resetDbForTests())
afterEach(() => vi.unstubAllEnvs())

/** Draws a QR the way a phone screen shows it (black modules, white quiet zone) and reads it back with the same decoder the gate scanner uses. */
function scan(text: string, scale: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size, quiet = 4, side = (n + quiet * 2) * scale
  const px = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!qr.modules.get(x, y)) continue
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4
      px[i] = px[i + 1] = px[i + 2] = 0
    }
  }
  return jsQR(px, side, side)?.data
}

describe('QR tickets', () => {
  it('a ticket link scanned from a small screen QR gives back the exact signed ticket the gate accepts', () => {
    const jsg = repo.getCommunityBySlug('jsg')!
    const ticket = makeTicket(42)
    for (const scale of [3, 4, 6]) {
      const data = scan(`https://hearth.example/c/${jsg.slug}/t/${ticket}`, scale)
      expect(data, `scale ${scale}`).toBeTruthy()
      expect(ticketFromScan(data!)).toBe(ticket)
    }
    // A bare ticket code and a printed link both resolve; a foreign QR does not look like a ticket.
    expect(ticketFromScan(scan(ticket, 4)!)).toBe(ticket)
    expect(/^t\d+\.[0-9a-f]{20}$/.test(ticketFromScan(scan('https://example.com/menu', 4)!))).toBe(false)
  })
})

function smtpSink() {
  const inbox: { to: string[]; data: string }[] = []
  const server = net.createServer((s) => {
    let buf = '', data = false, cur = { to: [] as string[], data: '' }
    s.write('220 sink ESMTP\r\n')
    s.on('data', (c) => {
      buf += c.toString()
      for (;;) {
        if (data) {
          const end = buf.indexOf('\r\n.\r\n')
          if (end < 0) return
          cur.data = buf.slice(0, end); buf = buf.slice(end + 5); data = false
          inbox.push(cur); cur = { to: [], data: '' }
          s.write('250 queued\r\n')
          continue
        }
        const nl = buf.indexOf('\r\n')
        if (nl < 0) return
        const line = buf.slice(0, nl); buf = buf.slice(nl + 2)
        if (/^EHLO|^HELO/i.test(line)) s.write('250 sink\r\n')
        else if (/^MAIL FROM/i.test(line)) s.write('250 ok\r\n')
        else if (/^RCPT TO/i.test(line)) { cur.to.push(line.replace(/^RCPT TO:\s*<?|>?$/gi, '')); s.write('250 ok\r\n') }
        else if (/^DATA/i.test(line)) { data = true; s.write('354 go\r\n') }
        else if (/^QUIT/i.test(line)) { s.write('221 bye\r\n'); s.end() }
        else s.write('250 ok\r\n')
      }
    })
  })
  return new Promise<{ port: number; inbox: typeof inbox; close: () => void }>((res) => server.listen(0, '127.0.0.1', () => res({ port: (server.address() as net.AddressInfo).port, inbox, close: () => server.close() })))
}

describe('email delivery over SMTP', () => {
  it('sends queued mail through the configured server and marks it sent', async () => {
    const jsg = repo.getCommunityBySlug('jsg')!
    const sink = await smtpSink()
    vi.stubEnv('SMTP_URL', `smtp://127.0.0.1:${sink.port}/?ignoreTLS=true`)
    vi.stubEnv('EMAIL_FROM', 'JSG Sports <sports@example.test>')
    repo.queueEmail(jsg.id, 'family@example.test', 'Registration received', 'Your reference is HR-12345678')
    const r = await sendQueued()
    sink.close()
    expect(r).toEqual({ sent: 1, failed: 0 })
    expect(sink.inbox).toHaveLength(1)
    expect(sink.inbox[0].to).toEqual(['family@example.test'])
    expect(sink.inbox[0].data).toContain('Subject: Registration received')
    expect(sink.inbox[0].data).toContain('HR-12345678')
    expect(sink.inbox[0].data).toContain('sports@example.test')
    expect(repo.listOutbox(jsg.id)[0]).toMatchObject({ sent: 1 })
  })
  it('keeps mail for retry, counts the attempt, and gives up after five', async () => {
    const jsg = repo.getCommunityBySlug('jsg')!
    vi.stubEnv('SMTP_URL', 'smtp://127.0.0.1:1/?ignoreTLS=true')
    repo.queueEmail(jsg.id, 'family@example.test', 'Hello', 'Body')
    for (let i = 0; i < 6; i++) await sendQueued()
    const m = repo.listOutbox(jsg.id)[0]
    expect(m.sent).toBe(0)
    expect(m.attempts).toBe(5)
    expect(m.error).toBeTruthy()
  })
})
