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
  it('production refuses to start without an admin password', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_PASSWORD', '')
    expect(() => repo.listCommunities()).toThrow(/ADMIN_PASSWORD/)
  })
  it('development and tests still get the demo community', () => {
    expect(repo.listCommunities().map((c) => c.slug)).toEqual(['jsg', 'kitty-demo'].sort((a, b) => a.localeCompare(b)))
  })
})
