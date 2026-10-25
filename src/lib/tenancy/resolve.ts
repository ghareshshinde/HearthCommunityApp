const RESERVED = new Set(['www', 'app', 'api', 'admin', 'c', 'auth', 'login'])

/** `jsg.platform.org` -> `jsg`. Returns null for the apex domain, localhost and reserved names. */
export function slugFromHost(host: string, rootDomain: string | undefined): string | null {
  if (!rootDomain) return null
  const h = host.split(':')[0].toLowerCase()
  const root = rootDomain.toLowerCase()
  if (h === root || !h.endsWith(`.${root}`)) return null
  const sub = h.slice(0, -(root.length + 1))
  return /^[a-z0-9][a-z0-9-]*$/.test(sub) && !RESERVED.has(sub) ? sub : null
}
