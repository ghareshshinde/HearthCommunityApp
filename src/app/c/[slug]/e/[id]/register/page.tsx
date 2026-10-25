import { notFound, redirect } from 'next/navigation'
import { requireCommunity } from '@/lib/session'
import { getEvent, isOpen, seatsLeft } from '@/lib/repo'
import RulesView from '@/components/RulesView'
import Pic from '@/components/Pic'
import { sportIcon } from '@/lib/sports'
import { columnConfig, eventSettings } from '@/lib/registration/rules'
import { submitRegistration } from '@/app/actions'
import RegistrationForm from '@/components/RegistrationForm'

export default async function Register({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const c = await requireCommunity(slug)
  const ev = getEvent(c.id, Number(id))
  if (!ev || ev.status === 'draft') notFound()
  if (!isOpen(ev)) redirect(`/c/${slug}/e/${id}`)
  const settings = eventSettings(ev.config)
  const sports = JSON.parse(ev.sports) as string[]
  return (
    <>
      <section className="hero">
        <Pic className="bg" src="/img/hero.svg" width={1200} height={460} />
        <div className="inner" style={{ padding: '1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', flex: '1 1 16rem' }}>Register for {ev.title}</h1>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>{sports.map((s) => <Pic key={s} src={sportIcon(s)} size={44} alt={s} />)}</div>
        </div>
      </section>
      <main className="wide">
        <RulesView rules={settings.rules} sports={sports} title="Read the rules before you register" />
        <RegistrationForm
          slug={slug} eventId={ev.id} sports={sports} columns={columnConfig(ev.config)} ages={settings.ages} diets={settings.diets} questions={settings.questions} waiver={settings.waiver} emailRequired={settings.contactEmailRequired} seatsLeft={seatsLeft(ev)}
          submit={submitRegistration.bind(null, slug, ev.id)} submitLabel="Submit registration"
        />
      </main>
    </>
  )
}
