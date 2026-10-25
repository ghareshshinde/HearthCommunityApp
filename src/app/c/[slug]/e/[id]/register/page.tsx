import { notFound, redirect } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, isOpen } from '@/lib/repo'
import { columnConfig } from '@/lib/registration/rules'
import { submitRegistration } from '@/app/actions'
import RegistrationForm from '@/components/RegistrationForm'

export default async function Register({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug)
  const ev = getEvent(c.id, Number(id))
  if (!ev || ev.status === 'draft') notFound()
  if (!isOpen(ev)) redirect(`/c/${slug}/e/${id}`)
  return (
    <main className="wide">
      <h1>Register for {ev.title}</h1>
      <RegistrationForm
        slug={slug} eventId={ev.id} sports={JSON.parse(ev.sports)} columns={columnConfig(ev.config)}
        submit={submitRegistration.bind(null, slug, ev.id)} submitLabel="Submit registration"
      />
    </main>
  )
}
