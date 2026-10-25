# Hearth

Multi-tenant community platform. Source of truth: `PRD.md`, including its **Alternative MVP track** (no Google sign-in, no payments, no Supabase).

## Run
```
npm install
npm run dev          # http://localhost:3000, demo data and admin password "change-me" in dev
```
Production: set `ADMIN_PASSWORD` and `SESSION_SECRET` (see `.env.example`), mount a volume for the SQLite file (`DATABASE_PATH`), or use the Dockerfile:
`docker build -t hearth . && docker run -p 3000:3000 -v hearth-data:/data -e ADMIN_PASSWORD=... -e SESSION_SECRET=... hearth`
SQLite means a single instance with a persistent disk (Fly volume, Railway volume, a VPS). It will not work on Vercel's ephemeral filesystem.

## Checks
`npm run typecheck && npm run lint && npm test` then `npm run e2e` (set `PW_CHROMIUM=/path/to/chromium` if the bundled browser is missing).

## Demo script
1. `/c/jsg` > Sports Fiesta (demo) > Register. Fill your details, paste or type six rows, mark two as Guest, accept the waiver, submit. Keep the reference link.
2. `/c/jsg/admin` (password above). Dashboard shows counts. Registrations: search, filter, click a cell to edit, tick rows and apply Verify or Confirm, then Download Excel (one tab per sport).
3. Admin > Branding: change primary colour; public pages update immediately. Low-contrast choices are refused.
4. Admin > Audit log shows registrations, edits, exports and sign-ins. Emails go to the outbox until SMTP is added.

## Registration journey (complete)
Event page with sports tiles, then the family grid (paste from Excel, keyboard, phone cards, draft saved 7 days), per-cell errors, age limits per sport, capacity per sport with automatic waitlist, soft warning above 8, waiver, honeypot against bots. After submit the registrant gets a reference and a secret link to edit or cancel until the cut-off, plus Google Calendar and .ics links. Admins set capacity, age limits, columns and waiver wording per event, verify, filter, edit inline with an audit trail, move people off the waitlist and export to Excel.

## What is built
Tenancy by `/c/slug` (and `slug.ROOT_DOMAIN`), branding tokens, English/Hindi/Gujarati scaffold, event admin, tabular registration grid, edit/cancel by secret link, registrations workspace with inline edit, bulk actions, Excel export, dashboard, audit log.
Not yet built: photo-verified check-in and spot desk, sports operations and podium, live board, feedback, catering and volunteer screens, roster import, full Hindi and Gujarati translations, offline PWA, real email sending.
