import { NextResponse, type NextRequest } from 'next/server'
import { slugFromHost } from '@/lib/tenancy/resolve'

/** Tenancy routing: `slug.ROOT_DOMAIN/x` is rewritten to `/c/slug/x`; `/c/slug` always works. */
export function proxy(req: NextRequest) {
  const slug = slugFromHost(req.headers.get('host') ?? '', process.env.ROOT_DOMAIN)
  if (!slug || req.nextUrl.pathname.startsWith('/c/')) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = `/c/${slug}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)'] }
