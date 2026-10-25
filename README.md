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

## Google Cloud (Cloud Run)
The app saves a snapshot to a Cloud Storage bucket after every change and restores it on start, so it works without a persistent disk. Run one instance. Steps, settings and checks are in [docs/DEPLOY_GOOGLE_CLOUD.md](docs/DEPLOY_GOOGLE_CLOUD.md).

## Admin sign-in
`/c/<slug>/admin` with the single admin password (`ADMIN_PASSWORD` the first time the database is created, `change-me` in development). Change it under Admin > Change password. Forgotten: start once with `RESET_ADMIN_PASSWORD=true` and a new `ADMIN_PASSWORD`.

## Checks
`npm run typecheck && npm run lint && npm test` then `npm run e2e` (set `PW_CHROMIUM=/path/to/chromium` if the bundled browser is missing).

## Demo script
1. `/c/jsg` > Sports Fiesta (demo) > Register. Fill your details, paste or type six rows, mark two as Guest, accept the waiver, submit. Keep the reference link.
2. `/c/jsg/admin` (password above). Dashboard shows counts. Registrations: search, filter, click a cell to edit, tick rows and apply Verify or Confirm, then Download Excel (one tab per sport).
3. Admin > Branding: change primary colour; public pages update immediately. Low-contrast choices are refused.
4. Admin > Audit log shows registrations, edits, exports and sign-ins. Emails go to the outbox until SMTP is added.

## Registration journey (complete)
Event page with sports tiles, then the family grid (paste from Excel, keyboard, phone cards, draft saved 7 days), per-cell errors, age limits per sport, capacity per sport with automatic waitlist, soft warning above 8, waiver, honeypot against bots. After submit the registrant gets a reference and a secret link to edit or cancel until the cut-off, plus Google Calendar and .ics links. Admins set capacity, age limits, columns and waiver wording per event, verify, filter, edit inline with an audit trail, move people off the waitlist and export to Excel.

## Registration safeguards
Every registration is re-validated on the server (the browser check is only a convenience), malformed or oversized requests are refused without errors, a repeated submit makes one registration, repeated sports count once, a hidden field and a per-connection limit slow bots, and a lost link is recovered with the reference plus the registrant's mobile number (`/c/<slug>/my`). Failed entries keep what was typed.

## Getting back into a registration (no Google, no OTP)
1. The secret link shown after registering and emailed to the registrant. It is the credential: anyone holding it can edit or cancel.
2. `/c/<slug>/my`: reference plus the registrant's mobile number leads back to the registration and QR ticket.
3. Same page, "Email me my links": when email is switched on (`SMTP_URL`), links for every registration made with that address are emailed. The page answers the same way whether or not the address is known.
4. At the venue: `/c/<slug>/venue` is a printable poster with a QR to the page above and a QR to register. Gate volunteers can also find anyone by name, mobile or reference.

## Event day
Registrants get a QR ticket (`/c/<slug>/t/<code>`, works offline once opened). Admin > Staff and check-in creates the standard set of logins (2 per sport, 2 common sports admins, 2 gate volunteers) with expiring invite links and passwords shown once, and sets gate names and the spot desk (open/closed, walk-in limit). Gate volunteers scan the QR with the phone camera or search by name, mobile or reference, tick who is present and admit; walk-ins are added to a family or as a separate entry. Admin > Approve (also from each event on the dashboard) lists registrations waiting for a decision: approve, or reject with a reason. Rejecting or cancelling turns the QR off and frees the seats; reinstating turns it back on; an event setting can make tickets work only after approval. Sport admins see a live roster of their sport (arrivals update every 5 seconds, no contact details).

## What is built
Tenancy by `/c/slug` (and `slug.ROOT_DOMAIN`), branding tokens, English/Hindi/Gujarati scaffold, event admin, tabular registration grid, edit/cancel by secret link, registrations workspace with inline edit, bulk actions, Excel export, dashboard, audit log.
Not yet built: photos, pairing and results with the podium, live board, feedback, catering and volunteer screens, roster import, full Hindi and Gujarati translations, offline PWA, real email sending.
