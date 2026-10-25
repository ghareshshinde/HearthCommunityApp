import type { EventRow } from './repo'

const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '')
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n')

export function icsFor(ev: EventRow, uidHost: string): string {
  const start = ev.starts_at ?? new Date().toISOString()
  const end = ev.ends_at ?? new Date(new Date(start).getTime() + 3600_000).toISOString()
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hearth//EN', 'BEGIN:VEVENT', `UID:event-${ev.id}@${uidHost}`,
    `DTSTAMP:${fmt(new Date().toISOString())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc(ev.venue)}`, `DESCRIPTION:${esc(ev.description + (ev.map_url ? `\n${ev.map_url}` : ''))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}
export function googleCalendarUrl(ev: EventRow) {
  const s = ev.starts_at ?? new Date().toISOString()
  const e = ev.ends_at ?? new Date(new Date(s).getTime() + 3600_000).toISOString()
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: `${fmt(s)}/${fmt(e)}`, location: ev.venue, details: ev.description })
  return `https://calendar.google.com/calendar/render?${p}`
}
