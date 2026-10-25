import { requireCommunity } from '@/lib/session'
import EventForm from '@/components/EventForm'

export default async function NewEvent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireCommunity(slug, true)
  return <main><h1>New event</h1><EventForm slug={slug} /></main>
}
