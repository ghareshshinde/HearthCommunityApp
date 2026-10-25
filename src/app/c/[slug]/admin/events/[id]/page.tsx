import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireCommunity } from '@/lib/session'
import { getEvent } from '@/lib/repo'
import EventForm from '@/components/EventForm'

export default async function EditEvent({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug, true)
  const ev = getEvent(c.id, Number(id))
  if (!ev) notFound()
  return <main><p><Link href={`/c/${slug}/admin`}>Back</Link></p><h1>Edit event</h1><EventForm slug={slug} ev={ev} /></main>
}
