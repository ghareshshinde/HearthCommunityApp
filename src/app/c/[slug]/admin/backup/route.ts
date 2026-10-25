import { cookies } from 'next/headers'
import { checkSession } from '@/lib/auth'
import { audit, getCommunityBySlug } from '@/lib/repo'
import { backupBuffer } from '@/lib/persist'
import { cookieName } from '@/lib/session'

/** Whole-database snapshot for the admin to keep. It holds every community, so only the admin session may fetch it. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = getCommunityBySlug(slug)
  if (!c || !checkSession((await cookies()).get(cookieName(slug))?.value, slug)) return new Response('Unauthorised', { status: 401 })
  audit(c.id, 'admin', 'backup.download')
  return new Response(new Uint8Array(backupBuffer()), {
    headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="hearth-backup-${new Date().toISOString().slice(0, 10)}.db"` },
  })
}
