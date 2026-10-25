import { timingSafeEqual } from 'node:crypto'
import { signValue } from './auth'

/** One signed ticket per registration. Tampering with the number invalidates the signature. */
export function makeTicket(registrationId: number): string {
  const body = `t${registrationId}`
  return `${body}.${signValue(`ticket:${body}`).slice(0, 20)}`
}

export function parseTicket(ticket: string): number | null {
  const m = /^t(\d{1,9})\.([0-9a-f]{20})$/.exec(ticket.trim())
  if (!m) return null
  const expected = signValue(`ticket:t${m[1]}`).slice(0, 20)
  return timingSafeEqual(Buffer.from(m[2]), Buffer.from(expected)) ? Number(m[1]) : null
}

/** The scanner reads either a bare ticket or the full ticket URL printed in the QR code. */
export function ticketFromScan(text: string): string {
  const t = text.trim()
  const m = /\/t\/([^/?#\s]+)/.exec(t)
  return m ? decodeURIComponent(m[1]) : t
}
