import { requireCommunity } from '@/lib/session'
import AdminLoginForm from '@/components/AdminLoginForm'
import AdminSetupForm from '@/components/AdminSetupForm'

export const dynamic = 'force-dynamic'

export default async function Login({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await requireCommunity(slug)
  return c.admin_hash
    ? <main><h1>Admin sign-in</h1><AdminLoginForm slug={slug} /></main>
    : <main><h1>Set the admin password</h1><AdminSetupForm slug={slug} /></main>
}
