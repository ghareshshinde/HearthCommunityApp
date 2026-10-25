import { rulesFor, type EventRules } from '@/lib/registration/rules'

type EntryType = 'singles' | 'doubles' | 'team'

/** The organisers' written rules, folded away until opened. Text only, shown exactly as typed. */
export default function RulesView({ rules, sports, sport, entryType, title = 'Rules', open = false }: { rules: EventRules; sports?: string[]; sport?: string; entryType?: EntryType; title?: string; open?: boolean }) {
  const blocks: { label: string; text: string }[] = []
  if (!sport && rules.general) blocks.push({ label: 'For everyone', text: rules.general })
  for (const sp of sport ? [sport] : sports ?? []) blocks.push(...rulesFor(rules, sp, entryType))
  if (!blocks.length) return null
  return (
    <details className="card rules" open={open || undefined} id="rules">
      <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 44, display: 'flex', alignItems: 'center' }}>{title}</summary>
      {blocks.map((b) => (
        <section key={b.label} style={{ marginTop: '.75rem' }}>
          <h3 style={{ margin: '0 0 .25rem', fontSize: '1rem' }}>{b.label}</h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{b.text}</p>
        </section>
      ))}
    </details>
  )
}
