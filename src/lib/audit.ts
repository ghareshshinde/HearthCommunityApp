import { supabaseServer } from '@/lib/supabase/server'

/** Append to the audit log as the signed-in user. RLS ensures actor and community match the session. */
export async function audit(communityId: string | null, action: string, target?: string, meta: Record<string, unknown> = {}) {
  const sb = await supabaseServer()
  const { data } = await sb.auth.getUser()
  if (!data.user) return
  await sb.from('audit_log').insert({ community_id: communityId, actor_id: data.user.id, action, target, meta })
}
