# Hearth

Multi-tenant community platform. Source of truth: `PRD.md` (drop the Markdown export in the repo root; not yet committed).

## Setup
1. `cp .env.example .env.local` and fill in Supabase, Resend and secrets.
2. Apply `supabase/migrations/*.sql` (Supabase CLI `supabase db push`, or paste into the SQL editor).
3. Supabase Auth: enable Google provider and TOTP MFA.
4. `npm run dev`, open `/c/<slug>`.

## Checks
`npm run typecheck && npm run lint && npm test` (DB policy tests run in-process on PGlite), `npm run e2e` (set `PW_CHROMIUM` if the bundled browser is missing).

## Slice 1 demo
1. Sign in with Google at `/login`.
2. Insert a community (see `supabase/seed.sql`), approve it as platform admin (`status='live'`).
3. Open `/c/jsg`: change `community.branding` to `{"colors":{"primary":"#0b3d91"}}`; reload, no deploy needed.
4. Open `/c/jsg/admin` as owner: redirected to `/mfa` until TOTP is verified.
