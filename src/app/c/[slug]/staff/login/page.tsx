import { requireCommunity } from '@/lib/session'
import StaffLoginForm from '@/components/StaffLoginForm'

export default async function StaffLogin({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ expired?: string }> }) {
  const { slug } = await params
  const { expired } = await searchParams
  await requireCommunity(slug)
  return (
    <main>
      <h1>Staff sign-in</h1>
      <p className="muted">For sport admins and gate volunteers. Use the link or the username and password you were given.</p>
      {expired && <p className="warn" role="alert">That invite link has expired or was replaced. Sign in with your username and password, or ask the organisers for a new link.</p>}
      <StaffLoginForm slug={slug} />
    </main>
  )
}
