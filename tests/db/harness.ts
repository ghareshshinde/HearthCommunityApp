import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(__dirname, '../../supabase/migrations')

// Minimal stand-in for Supabase's auth schema and the `authenticated` role,
// so the real migrations and RLS policies run unchanged.
const SUPABASE_SHIM = `
create schema auth;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create role authenticated nologin;
create role anon nologin;
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated, anon;
`

export async function freshDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_SHIM)
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  }
  return db
}

export type Db = Awaited<ReturnType<typeof freshDb>>

/** Run `fn` as an authenticated user. aal2 simulates a session that completed MFA. */
export async function asUser<T>(db: Db, userId: string, fn: () => Promise<T>, aal: 'aal1' | 'aal2' = 'aal2') {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, aal })}', false)`)
  await db.exec('set role authenticated')
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.exec(`select set_config('request.jwt.claims', '', false)`)
  }
}
