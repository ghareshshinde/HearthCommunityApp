const store = new Map<string, { at: number; value: unknown }>()

/** Shares one computed answer between visitors for a couple of seconds, so a crowd watching the same board costs one database read, not hundreds. */
export function memo<T>(key: string, ttlMs: number, compute: () => T, now = Date.now()): T {
  const hit = store.get(key)
  if (hit && now - hit.at < ttlMs) return hit.value as T
  const value = compute()
  store.set(key, { at: now, value })
  if (store.size > 200) for (const [k, v] of store) if (now - v.at > ttlMs) store.delete(k)
  return value
}
