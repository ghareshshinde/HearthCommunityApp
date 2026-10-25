import { getRequestConfig } from 'next-intl/server'

// English only for the MVP (PRD alternative track AM6). Add locales here and a messages/<locale>.json to bring them back.
export const LOCALES = ['en'] as const
export type Locale = (typeof LOCALES)[number]

export default getRequestConfig(async () => ({
  locale: 'en',
  messages: (await import('../../messages/en.json')).default,
}))
