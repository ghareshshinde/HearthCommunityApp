const IST = 'Asia/Kolkata'
export const formatIst = (iso: string | null, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) =>
  iso ? new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...opts }).format(new Date(iso)) : ''

/** `datetime-local` value (entered as IST) to ISO UTC. */
export const istInputToIso = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : null)
/** ISO UTC to a `datetime-local` value in IST. */
export function isoToIstInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000)
  return d.toISOString().slice(0, 16)
}
