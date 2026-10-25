import { requireCommunity } from '@/lib/session'
import AdminLoginForm from '@/components/AdminLoginForm'

export default async function Login({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireCommunity(slug)
  return <main><h1>Admin sign-in</h1><AdminLoginForm slug={slug} /></main>
}
