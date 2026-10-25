// Browser-safe: the gate scanner imports this, so it must not pull in anything from the server.
/** The scanner reads either a bare ticket or the full ticket URL printed in the QR code. */
export function ticketFromScan(text: string): string {
  const t = text.trim()
  const m = /\/t\/([^/?#\s]+)/.exec(t)
  return m ? decodeURIComponent(m[1]) : t
}
