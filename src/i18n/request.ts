import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const LOCALES = ['en', 'hi', 'gu'] as const
export type Locale = (typeof LOCALES)[number]

export default getRequestConfig(async () => {
  const c = (await cookies()).get('locale')?.value
  const locale: Locale = LOCALES.includes(c as Locale) ? (c as Locale) : 'en'
  const base = (await import('../../messages/en.json')).default
  const msgs = locale === 'en' ? base : (await import(`../../messages/${locale}.json`)).default
  // Missing translations fall back to English instead of showing keys.
  return { locale, messages: deepMerge(base, msgs) }
})

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && typeof a[k] === 'object'
      ? deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>) : v
  }
  return out
}
