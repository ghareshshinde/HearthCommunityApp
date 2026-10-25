import { afterEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_PATH = ':memory:'
process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import * as repo from '@/lib/repo'

afterEach(() => { resetDbForTests(); vi.unstubAllEnvs() })

describe('first run', () => {
  it('a live site gets only the real community and no demo data', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SEED_DEMO_EVENT', 'false')
    expect(repo.listCommunities().map((c) => c.slug)).toEqual(['jsg'])
    const jsg = repo.getCommunityBySlug('jsg')!
    expect(repo.listEvents(jsg.id)).toHaveLength(0)
  })
  it('a live site with no settings at all still starts: the admin password is chosen on first visit and a session secret is generated and kept', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_PASSWORD', '')
    vi.stubEnv('SESSION_SECRET', '')
    const jsg = repo.getCommunityBySlug('jsg')!
    expect(jsg.admin_hash).toBe('')
    const { verifyPassword, makeSession, checkSession, resetGeneratedSecretForTests } = await import('@/lib/auth')
    expect(verifyPassword('', jsg.admin_hash)).toBe(false)
    expect(verifyPassword('anything', jsg.admin_hash)).toBe(false)
    const cookie = makeSession('jsg')
    expect(checkSession(cookie, 'jsg')).toBe(true)
    // After a restart the same secret is read back from the database, so signed-in admins stay signed in.
    resetGeneratedSecretForTests()
    expect(checkSession(cookie, 'jsg')).toBe(true)
    expect(checkSession(cookie, 'other')).toBe(false)
  })
  it('development and tests still get the demo community', () => {
    expect(repo.listCommunities().map((c) => c.slug)).toEqual(['jsg', 'kitty-demo'].sort((a, b) => a.localeCompare(b)))
  })
})
