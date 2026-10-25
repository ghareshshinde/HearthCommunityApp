import { expect, it } from 'vitest'
import { slugFromHost } from './resolve'

it('maps subdomains to slugs and ignores everything else', () => {
  expect(slugFromHost('jsg.platform.org', 'platform.org')).toBe('jsg')
  expect(slugFromHost('jsg.platform.org:443', 'platform.org')).toBe('jsg')
  expect(slugFromHost('platform.org', 'platform.org')).toBeNull()
  expect(slugFromHost('www.platform.org', 'platform.org')).toBeNull()
  expect(slugFromHost('evil.com', 'platform.org')).toBeNull()
  expect(slugFromHost('a.b.platform.org', 'platform.org')).toBeNull()
  expect(slugFromHost('localhost:3000', undefined)).toBeNull()
})
