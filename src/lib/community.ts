import { cache } from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { resolveBranding } from '@/lib/branding/resolve'

export const getCommunity = cache(async (slug: string) => {
  const sb = await supabaseServer()
  const { data } = await sb.from('community').select('*').eq('slug', slug).maybeSingle()
  return data ? { ...data, brand: resolveBranding(data.branding) } : null
})

export const getSessionUser = cache(async () => {
  const sb = await supabaseServer()
  const { data } = await sb.auth.getUser()
  return data.user
})

export const ADMIN_ROLES = ['owner', 'committee', 'treasurer'] as const

export const getMyRoles = cache(async (communityId: string): Promise<string[]> => {
  const user = await getSessionUser()
  if (!user) return []
  const sb = await supabaseServer()
  const { data } = await sb.from('membership').select('roles')
    .eq('community_id', communityId).eq('user_id', user.id).eq('status', 'active').maybeSingle()
  return data?.roles ?? []
})

/** True when the session has completed TOTP (aal2). Admin roles need this before any admin action. */
export async function hasMfa() {
  const sb = await supabaseServer()
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === 'aal2'
}
