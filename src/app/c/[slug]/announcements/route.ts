import { NextResponse } from 'next/server'
import { getCommunityBySlug } from '@/lib/repo'
import { liveAnnouncements } from '@/lib/announcements'

export const dynamic = 'force-dynamic'

/** Public: the live messages shown in the ticker. Messages are written for everyone to read, so nothing private is here. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = getCommunityBySlug((await params).slug)
  if (!c) return NextResponse.json([], { status: 404 })
  const list = liveAnnouncements(c.id).map(({ id, message, level, created_at }) => ({ id, message, level, at: created_at }))
  return NextResponse.json(list, { headers: { 'Cache-Control': 'no-store' } })
}
