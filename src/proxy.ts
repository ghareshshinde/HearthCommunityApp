import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { slugFromHost } from '@/lib/tenancy/resolve'

/** Tenancy routing plus session refresh. `slug.ROOT_DOMAIN/x` is rewritten to `/c/slug/x`; `/c/slug` always works. */
export async function proxy(req: NextRequest) {
  const slug = slugFromHost(req.headers.get('host') ?? '', process.env.ROOT_DOMAIN)
  const url = req.nextUrl.clone()
  if (slug && !url.pathname.startsWith('/c/') && !url.pathname.startsWith('/auth')) {
    url.pathname = `/c/${slug}${url.pathname === '/' ? '' : url.pathname}`
  }
  let res = slug && url.pathname !== req.nextUrl.pathname ? NextResponse.rewrite(url) : NextResponse.next()

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    })
    await supabase.auth.getUser() // refreshes the session cookie
  }
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)'] }
