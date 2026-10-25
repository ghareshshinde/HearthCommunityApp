import { NextResponse, type NextRequest } from 'next/server'
import { audit, getCommunityBySlug } from '@/lib/repo'
import { makeStaffSession, staffByInvite } from '@/lib/staff'
import { staffCookieName } from '@/lib/session'

/** Opens a staff session from an expiring invite link, so nobody has to type credentials on a phone at the gate. */
/** Redirects are relative: behind Cloud Run the server's own origin is 0.0.0.0, not the public address. */
const redirectTo = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const c = getCommunityBySlug(slug)
  const s = c && staffByInvite(c.id, token)
  if (!c || !s) return redirectTo(`/c/${slug}/staff/login?expired=1`)
  const res = redirectTo(`/c/${slug}/staff`)
  res.cookies.set(staffCookieName(slug), makeStaffSession(slug, s.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 })
  audit(c.id, s.name, 'staff.invite_used', s.username)
  return res
}
