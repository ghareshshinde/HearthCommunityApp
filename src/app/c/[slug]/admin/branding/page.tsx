import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import BrandingForm from '@/components/BrandingForm'

export default async function Branding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug, true)
  return <main><p><Link href={`/c/${slug}/admin`}>Back</Link></p><h1>Branding</h1><BrandingForm slug={slug} brand={c.brand} /></main>
}
