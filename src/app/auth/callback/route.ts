import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const raw = req.nextUrl.searchParams.get('next') ?? '/'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/' // no open redirects
  if (code) {
    const sb = await supabaseServer()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data } = await sb.auth.getUser()
      const u = data.user
      if (u?.email) {
        await sb.from('app_user').upsert({
          id: u.id, email: u.email, google_sub: u.user_metadata?.provider_id ?? u.user_metadata?.sub ?? null,
          name: u.user_metadata?.full_name ?? null, photo_url: u.user_metadata?.avatar_url ?? null,
        }, { onConflict: 'id' })
        await audit(null, 'auth.sign_in', u.id)
      }
    }
  }
  return NextResponse.redirect(new URL(next, req.nextUrl.origin))
}
