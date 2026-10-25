import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import PasswordForm from '@/components/PasswordForm'

export default async function Password({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireCommunity(slug, true)
  return <main><p><Link href={`/c/${slug}/admin`}>Back</Link></p><h1>Change admin password</h1><PasswordForm slug={slug} /></main>
}
