import { requireCommunity } from '@/lib/session'
import FindForm from '@/components/FindForm'

export default async function My({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireCommunity(slug)
  return (
    <main>
      <h1>Find my registration</h1>
      <p className="muted">Lost your link? Enter your reference and the mobile number you gave when you registered. You will go straight to your registration and QR ticket.</p>
      <FindForm slug={slug} />
    </main>
  )
}
