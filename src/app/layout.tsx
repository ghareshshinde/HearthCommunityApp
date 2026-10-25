import './globals.css'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { PLATFORM_BRANDING } from '@/lib/branding/defaults'
import { brandingToCss } from '@/lib/branding/css'
import { Suspense } from 'react'
import NavProgress from '@/components/NavProgress'

export const metadata: Metadata = { title: PLATFORM_BRANDING.name, description: PLATFORM_BRANDING.tagline }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()])
  return (
    <html lang={locale}>
      <head><style dangerouslySetInnerHTML={{ __html: brandingToCss(PLATFORM_BRANDING) }} /></head>
      <body><Suspense fallback={null}><NavProgress /></Suspense><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body>
    </html>
  )
}
