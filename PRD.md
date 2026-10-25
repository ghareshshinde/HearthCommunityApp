# Hearth Platform PRD

Oct 25, 2026 · @Gharesh

Hearth (working name, chosen 25 Oct 2026) is a multi-tenant web platform where any community group runs its membership, committees and events: NGOs and social groups like JSG, kitty party groups, professional communities like The Product Folks, alumni groups, clubs and associations. Each group gets its own subdomain, member roster, approval workflow, donation or payment account and photo-verified event check-in. JSG's December 2026 Sports Fiesta is the launch tenant. Claude builds it fresh; no prior codebase is assumed. This document says "community" for any such group (an NGO, a kitty party, a professional community); each community can rename the terms its members see.

## Decisions log

| # | Decision (25 Oct 2026) | Effect on the product |
| --- | --- | --- |
| 1 | Payment gateway for an NGO | Razorpay as default, with each community connecting its own account (see Payments). For JSG, every payment is a donation to the NGO. |
| 2 | Build scope = what can be completed in 2 hours | A defined 2-hour build ships first; everything else is backlog (see Build plan) |
| 3 | Google SSO mandatory; member roster uploaded first | No password or OTP login. Roster upload is the first admin task, so members are recognised at sign-in and register free. |
| 4 | Minors live on the family record | Parents add children to the family once; children are picked as participants per event. Children get no login, profile or chat. |
| 5 | Gender: Male / Female only | Kept as a required two-option field |
| 6 | Email + in-app notifications; WhatsApp deferred | Push arrives with the mobile app. Default diet is vegetarian (Jain community), so the diet options are Jain, Chauvihar, Vegan, Other. |
| 7 | Soft warning above 8 participants; feedback always open to checked-in attendees | Feedback works like past-ride ratings, with no closing date. Social sharing to WhatsApp and Instagram uses the phone's share sheet. |
| 8 | Check-in shows every registered person's photo | The volunteer ticks each face before admitting; the system blocks proxies and resale (see Check-in verification) |
| 9 | Multi-tenant: many communities on one parent domain | Community directory, per-community admins, roles, eligibility rules, referral-backed membership approval, re-engagement emails to past guests |

## Phases

Every requirement in this PRD is labelled with one phase. MVP is everything needed for Sports Fiesta to succeed; nothing else is built before the Fiesta. A requirement changes phase only by editing this PRD. Windows are proposals.

| Phase | Goal | Window (proposed) | Scope |
| --- | --- | --- | --- |
| MVP | Sports Fiesta succeeds end to end | Now to the Fiesta, Dec 2026 | Tenancy and branding, Google SSO with MFA for admins, roster import, family records, tabular registration, registrations workspace with Excel download, donations and receipts, photo-verified QR check-in, spot desk, sports operations and podium, live event board, feedback, Hindi and Gujarati |
| Phase 2 | Run JSG year-round and onboard the next communities | Jan to Mar 2027 | Membership applications and referrals, tiers, dues and renewals, federation structure, profiles and privacy, directory, ID cards, announcements, ticket types, sponsors, certificates, houses, 80G receipts, expenses, multi-community membership, event visibility and discovery |
| Phase 3 | Networking, benefits and platform revenue | Apr to Sep 2027 | Networking pack (referrals, one-to-ones, engagement scorecards), talent, vendor and venue marketplace, ratings, help requests, chat, gallery, polls and elections, member benefits, health cover pilot, platform plans |
| Phase 4 | Breadth | Oct 2027 onward | Other event types and seating, mobile app and push, WhatsApp, scholarships and assistance, matrimony, emergency help fund, startup showcase, recurring events |

## Product

NGOs, kitty party groups, professional communities and clubs run members on Excel sheets, events on Google Forms, money on UPI screenshots and communication on WhatsApp groups. The platform replaces that stack with one place to recognize members, approve new ones, run events and stay in touch.

| Layer | What it does | Who uses it |
| --- | --- | --- |
| Parent site (e.g. `platform.org`) | Community directory, community sign-up, platform admin | Public, community founders |
| Community site (e.g. `jsg.platform.org`) | Community profile, events, membership application, member directory | Members, applicants, guests |
| Community admin console | Roster upload, member approval, committee roles, events, check-in, donations, exports, announcements | Community admins and committee |
| Member space | Family record, event registrations, tickets, profile, privacy, networking, feedback | Members and guests |

`platform.org` is a placeholder until a domain is chosen.

## Users, roles and success metrics

Roles are per community: one person can be a committee member in one community and a guest in another.

| Role | Scope | Can do |
| --- | --- | --- |
| Platform admin | Whole platform | Approve or suspend communities, view platform health and logs |
| Community owner | One community | Everything in the community, including assigning roles and connecting the payment account |
| Committee member | One community | Approve members, create and publish events, view registrations and donations, send announcements |
| Treasurer | One community | Donations, refunds, expenses, finance exports |
| Check-in volunteer | One community, event day | Scan tickets, verify faces, admit; nothing else. Sport coordinators (members or invited umpires and coaches) get time-limited access to one sport only |
| Member (head of family) | One community | Manage family record, register family and guests, network, give feedback |
| Family member (adult) | One community | Own profile, networking, own tickets |
| Family member (minor) | Record only | Picked as a participant by a parent; no login |
| Guest | Per event | Register and donate for an event; can later apply for membership |

| Metric | Proposed target | Measured by |
| --- | --- | --- |
| Communities onboarded and live with one event | 5 in the first 3 months after JSG | Tenant records |
| Registration completion (started vs confirmed) | Above 80% | Funnel events |
| Time to register a family of 4 | Under 3 minutes | Form timing |
| Members wrongly asked to pay | 0 | Roster vs payment audit |
| Proxy or resale attempts caught at gate | All flagged mismatches logged | Check-in audit log |
| Gate throughput | Under 20 seconds per family | Scan-to-admit timestamps |
| Feedback from checked-in attendees | Above 30% | Responses |

Targets are proposals for the JSG committee to confirm.

## Tenancy and membership

Every record carries its community's id, and a community's subdomain decides which community a visitor sees. Data never crosses communities except a person's own Google identity.

| Requirement | Detail | Acceptance criterion |
| --- | --- | --- |
| Community sign-up | Founder signs in with Google, gives name, slug, type (registered NGO as Trust, Society or Section 8; or an unregistered group such as a kitty party or professional community), city, logo, about | Platform admin approves; slug becomes `slug.platform.org` |
| Community directory | Parent site lists approved communities with logo, city, focus, upcoming events, "Apply to join" | Search by name and city |
| Roster upload | Owner uploads Excel/CSV of existing members: family id, name, email, mobile, relation | Preview, duplicate check on email and mobile, row-level errors, commit |
| Member recognition | On Google sign-in, the email is matched against the roster | Matched person lands as Member with family pre-filled; unmatched lands as Guest |
| Eligibility rules | Community defines application questions and which answers are required (e.g. self-declaration "I follow the Jain faith") | Applicants failing a required answer cannot submit |
| Referrals | Applicant names 1 to 3 existing members | Each referee gets an email to vouch or decline; vouches shown to committee |
| Approval | Committee approves or rejects with a note; community sets how many approvals are needed (default 1) | Applicant notified by email; approved applicant joins the roster |
| Committee roles | Owner assigns Committee, Treasurer, Volunteer to any member | Role change logged and emailed to the person |
| Re-engagement | Committee emails past guests and members about a new event | Sent only to people who opted in; every email has unsubscribe |
| Family record | Head of family adds spouse, children, parents, with photo, age, gender, diet, accessibility | Minors need the parent's consent tick; adults can be invited to claim their own login |

## Event types and modules

An event is a common core (details, registration, donations, tickets, check-in, feedback) plus modules switched on by the event type the admin picks. The type pre-selects modules; the admin can add or remove any. New types are new templates, not new code paths. The MVP ships the core and the Sports Tournament type; the other types arrive in Phase 4 and plug into the same structure.

| Event type | Example | Modules switched on | Type-specific needs |
| --- | --- | --- | --- |
| Sports tournament | Sports Fiesta | Competition (rounds, brackets, podium), waivers, catering, volunteer roster | Per-sport coordinators, age and gender categories |
| Concert or performance | Bhakti sandhya, music night | Seating, ticket tiers, catering | Seat allocation by priority rules (below) |
| Talk or seminar | Pravachan, guest lecture | Sessions and speakers, seating | Q&A, speaker profiles, recordings link |
| Cultural competition | Dance, quiz, rangoli | Competition with judges' scores, podium | Judges score on a rubric; average decides rank |
| Dinner or gala | Annual dinner | Table allocation, catering, ticket tiers | Seat families together; Chauvihar timing |
| Trip or yatra | Pilgrimage, picnic | Transport seats, room allocation, documents | Bus seat map, rooming list, ID collection |
| Workshop or class | Health talk, skill class | Capacity, materials, certificates | Attendance across multiple sessions |
| Fundraiser | Charity drive | Donation goal and progress, pledges | 80G receipts, donor wall (opt-in) |
| Service or camp | Health camp, blood donation | Time-slot booking, volunteer shifts | Slot per person; medical consent where needed |
| Meetup | Networking evening | Directory, chat, connections | Opt-in visibility |

### Seating module (Phase 4)

| ID | Requirement | When | Acceptance criterion |
| --- | --- | --- | --- |
| ST1 | Admin draws a seat map: rows, blocks, seat numbers, or simple zones (Front, Middle, Back) | Phase 4 | Map reusable across events at the same venue |
| ST2 | Priority rules decide who gets which zone, applied in order: reserved (chief guests, committee, elders, accessibility), ticket tier, member before guest, donation level, then first come | Phase 4 | Admin reorders rules; each rule shows how many seats it consumed |
| ST3 | Families seated together by default | Phase 4 | No family split across zones unless the admin allows it |
| ST4 | Allocation run by admin before the event, or auto at registration | Phase 4 | Seat shown on ticket and in check-in grid |
| ST5 | Manual move and swap by admin, logged | Phase 4 | Attendee notified of change |
| ST6 | Lottery option for oversubscribed front rows | Phase 4 | Draw logged and reproducible |

## Payments and donations

Decision: Razorpay is the default gateway. Each community connects its own Razorpay account, so money settles directly to the community and receipts carry its name. A direct UPI QR option covers communities not yet approved by a gateway, including unregistered groups that may not pass gateway KYC (to verify with Razorpay). The platform never holds a community's money. Registered NGOs record payments as donations; other communities, such as kitty parties and professional groups, record them as fees or contributions.

Rules:

- Every payment is recorded against the community (a donation for registered NGOs, a fee or contribution for others), linked to the event and the registration.
- Members never see a payment screen unless they choose to donate.
- Guests see a suggested donation (INR 499 for JSG Sports Fiesta) set by the community per event.
- Confirmation happens only on the gateway's signed webhook, never on the browser redirect.
- Tax caveat: a payment made to get event entry may not qualify as an 80G donation, because the donor receives a benefit. The NGO's CA should decide whether guest contributions get 80G receipts.
- KYC per NGO: registration certificate, PAN, bank proof in the NGO's name, 12A and 80G certificates if issuing tax receipts; FCRA account only for foreign donations.

## Functional requirements

Every requirement carries its phase (MVP, Phase 2, Phase 3 or Phase 4; see Phases). Brief item numbers are in brackets.

### Core: tabular multi-member registration (MVP; the reason Hearth exists)

One person registers a whole family and its guests in a single editable table, one row per participant, instead of filling one form per person. This is the first thing built and the last thing cut.

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| TR1 | Registration form is an editable grid: one row per participant; columns Name, Age, Gender (Male/Female), Mobile, Email, Sports (multi-select), Skill level, Diet, T-shirt size, Accessibility needs, Member or Guest, Amount | MVP | Every cell editable in place with the right input (text, number, dropdown, multi-select, phone, email) |
| TR2 | Rows for family members pre-filled from the family record; head of family ticks who is participating | MVP | No re-typing of known family details |
| TR3 | "Add row" for more family members or guests; delete row; duplicate row (e.g. same sports for siblings) | MVP | Soft warning above 8 rows |
| TR4 | Columns shown are configured per event by the event admin (add, hide, reorder, mark required, custom columns such as school or house) | MVP | Same grid works for any multi-member event |
| TR5 | Inline validation per cell: email format, 10-digit mobile, age range per sport category, required fields; errors shown in the cell | MVP | Submit blocked until all rows valid, with the first error scrolled into view |
| TR6 | Keyboard use on desktop: Tab and arrow keys move between cells, Enter adds a row; paste a block of rows copied from Excel or Google Sheets | MVP | A family of 6 entered without a mouse |
| TR7 | Phone layout: the same rows shown as stacked cards with the same fields, swipe or tap to the next person | MVP | Works on a 360 px wide screen |
| TR8 | Live summary under the grid: participants, members, guests, sports count, amount due | MVP | Updates as cells change |
| TR9 | Save draft and resume; edit after submit until the admin's cut-off | MVP | Draft kept 7 days |

### Core: registrations workspace for event admins (MVP)

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| RW1 | One grid of all participants across all registrations, grouped or flat, with the head of family and registration timestamp per row | MVP | Loads 2,000 rows smoothly |
| RW2 | Search, filter (sport, category, age, gender, member or guest, payment status, check-in status, diet) and sort on any column | MVP | Filters combine; counts update |
| RW3 | Inline edit by admins (correct a name, move a sport, fix age) with an audit trail of who changed what | MVP | Every edit logged with before and after |
| RW4 | Bulk actions on selected rows: mark paid (UPI or cash), assign category, cancel, send email | MVP | Confirmation before bulk change |
| RW5 | Column chooser and saved views (e.g. "Badminton U-14 girls", "Unpaid guests") | Phase 2 | Views shared with other admins |
| RW6 | Download to Excel: all rows or the current filtered view, every column including per-participant timestamps, payment and check-in status \[4\] | MVP | Opens in Excel with Hindi and Gujarati names intact |
| RW7 | Per-sport sheets in the same Excel file for teams that run the rest offline | MVP | One tab per sport |
| RW8 | Import corrections back from the edited Excel file with a preview of changes | Phase 2 | Nothing applied without preview |

### Accounts and families

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| A1 | Google SSO is the only login \[19\] | MVP | No password or OTP screens exist |
| A2 | MFA (TOTP) for owners, committee and treasurers \[30\] | MVP | Admin actions blocked until MFA set up |
| A3 | Family record: head adds members with name, age, gender (Male/Female), mobile, email, photo, relation \[2, 4\] | MVP | Minors saved only after parent consent tick |
| A4 | Diet per person: Jain, Chauvihar, Vegan, Other; accessibility as free text \[9\] | MVP | Default is vegetarian; options counted on dashboard |
| A5 | Adult family members can claim their own login by Google email | Phase 2 | Claimed person keeps family link |
| A6 | Profile: hometown, education, work, tags, bio, social links \[21\] | Phase 2 | Adults only |
| A7 | Privacy: email and mobile hidden by default; public, or shared with chosen people \[27\] | Phase 2 | Hidden fields never sent to other users' browsers |

### Events and registration

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| E1 | Committee creates an event: title, dates, venue, Google Maps link, sports list, suggested guest donation, capacity \[18\] | MVP | Publish makes it visible on the community site |
| E2 | Registration picks participants from the family record, then adds guests as rows \[2, 23\] | MVP | Members INR 0; guests at the suggested donation |
| E3 | Per participant: sports multi-select (Chess, Carrom, Cricket, Badminton, Table Tennis, Pickleball) \[2\] | MVP | At least one sport per participant |
| E4 | Soft warning when participants exceed 8 | MVP | Warning, not a block |
| E5 | Per-participant registration timestamp stored \[4\] | MVP | Appears in Excel export |
| E6 | Add to Calendar: Google Calendar link + .ics \[11\] | MVP | Correct time zone (IST) |
| E7 | Edit or cancel until an admin cut-off | MVP | Donation refund decided by treasurer |
| E8 | Event schedule with changes highlighted \[14\] | MVP | Change triggers notification |

### Donations

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| D1 | Razorpay checkout on the community's own keys \[6, 15\] | MVP (test mode) | Confirmed only on verified webhook |
| D2 | Direct UPI QR fallback with treasurer confirmation | MVP | Registration stays Pending until confirmed |
| D3 | Donation receipt email; 80G section when the NGO has 80G and the CA approves \[24\] | MVP (payment receipt); Phase 2 (80G section) | Receipt number unique per community per financial year |
| D4 | Optional extra donation from members | Phase 2 | Recorded separately |

### Notifications and sharing

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| N1 | Confirmation email to registrant with copy to the community's address (jsghyd@gmail.com for JSG) \[5, 10\] | MVP | Sent for every confirmed registration |
| N2 | In-app notification centre: registrations, approvals, schedule changes, connection requests, privacy changes \[28\] | Phase 2 | Unread badge updates live |
| N3 | Announcements and re-engagement emails to opted-in members and past guests | Phase 2 | Unsubscribe honoured |
| N4 | Share button using the phone's share sheet (WhatsApp, Instagram) with an event image card \[17\] | MVP | Shared link opens the event page |
| N5 | Mobile push and WhatsApp | Phase 4 | With mobile app |

### Event day and after

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| C1 | One QR ticket per registration, signed so it cannot be forged \[12\] | MVP | Tampered or reused code rejected |
| C2 | Photo-verified check-in (see Check-in verification) | MVP | Each person ticked individually |
| C3 | Offline tickets and schedule (installable web app) \[16\] | MVP | Ticket opens without network |
| F1 | Feedback open at any time to people checked in to that event \[13\] | MVP | One editable response per person per event |
| M1 | 1:1 and event group chat for checked-in adults \[20\] | Phase 3 | Locked until check-in |
| M2 | Connection requests | Phase 3 | Accept, decline, block |
| G1 | Gallery: upload public or private; JSG watermark on shared images; share links land on the site \[26\] | Phase 3 | Private photos visible only to uploader and admins |

### Spot registration and payment at the venue (MVP)

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| S1 | Desk mode for committee and volunteers: register walk-ins on the spot (member lookup by name or mobile, or new guest) | MVP | Walk-in registered in under 60 seconds |
| S2 | Photo taken with the desk phone's camera for each walk-in | MVP | No photo, no admission |
| S3 | Spot payment by Razorpay payment link or QR on screen (attendee pays from own phone), UPI to the community's account, or cash | MVP | Razorpay confirms by webhook; UPI and cash recorded by the volunteer, then confirmed by treasurer |
| S4 | Ticket issued and checked in in the same step | MVP | Walk-in appears in check-in counts and export |
| S5 | Walk-ins flagged as "Spot" with collector name and payment method | MVP | Cash per volunteer totals shown to treasurer for end-of-day reconciliation |
| S6 | Admin switch to open or close spot registration and cap walk-in numbers | MVP | Closed desk mode hides the button |

### Admin and analytics

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| R1 | Excel export: one row per participant with family, member/guest, sports, diet, accessibility, donation, check-in time, registration timestamp \[4\] | MVP | Hindi and Gujarati names display correctly |
| R2 | Live dashboard: registrations, members vs guests, sport counts, diet counts, donations, check-ins \[8, 25\] | MVP | Refreshes within 1 minute |
| R3 | Expense entry and income vs expense view \[25\] | Phase 2 | Treasurer only |
| R4 | Audit and error logs \[29\] | MVP | Logins, exports, uploads, role changes, check-ins logged |

### Language

| ID | Requirement | Build | Acceptance criterion |
| --- | --- | --- | --- |
| L1 | English, Hindi, Gujarati across member-facing screens and emails \[7\] | MVP | Native-speaker review before launch |

## Registration flow

&#91;embedded content: registration flow · Google sign-in to confirmed ticket\]

The roster match at Google sign-in decides pricing. A member family with no guests never sees a donation screen, and confirmation waits for the gateway webhook or the treasurer's UPI confirmation.

## Check-in verification

The volunteer admits people, not tickets: a scan opens the registration's photo grid, and each person is ticked only after their face is matched. Anyone not ticked stays unadmitted, so a ticket cannot be passed to someone else.

1. Volunteer signs in with Google; their Volunteer role for this event unlocks the scanner on a phone browser.
2. Scan the family's QR (or search by name or mobile if the phone is dead).
3. Screen shows the head of family and every registered participant: photo, name, age, gender, member or guest, donation status.
4. Volunteer ticks each person standing at the desk after comparing face to photo; untick allowed until submit.
5. Admit submits the ticked set with time and volunteer id. People not present can be admitted later from the same ticket.
6. A second scan of the same ticket shows who is already in, when, and by which volunteer.

| Rule | Behaviour |
| --- | --- |
| Photo required | Every adult needs a photo before the event; parents add children's photos with consent. Missing photo shows a warning and asks the volunteer to check ID. |
| Guest photo | Guests upload a selfie at registration; no photo, no QR issued |
| Unpaid guest | Shown in red; admit blocked until donation confirmed or treasurer overrides |
| Mismatch | "Face does not match" button records the attempt and alerts the committee lead |
| Offline gate | Scanner caches the event's participant list and photos; scans sync when the network returns |
| No automated face recognition | Matching is human only; no biometric templates are stored |

## Data model

Every table except `user` and `community` carries `community_id`, and every query is filtered by it; PostgreSQL row-level security enforces the filter as a second line of defence.

| Entity | Key fields | Notes |
| --- | --- | --- |
| user | google\_sub, email, name, photo | One per real person across all communities |
| community | slug, name, type, city, about, logo, status, payment\_config, eligibility\_questions | status: pending, live, suspended |
| membership | community, user or roster\_person, role(s), status, approved\_by | Roles: owner, committee, treasurer, volunteer, member |
| roster\_person | community, family\_id, name, email, mobile, source (upload or approved) | Matched to user on Google email |
| family | community, head (membership) | Holds people |
| person | family, name, age, gender, mobile, email, photo, diet, accessibility, is\_minor, consent\_at, user (optional) | Minors have no user |
| application | community, user, answers, referees, status, decisions | Referee vouches stored per referee |
| event | community, title, starts\_at, ends\_at, venue, map\_url, sports, suggested\_donation, capacity, status |  |
| registration | event, family or guest user, status, created\_at |  |
| participant | registration, person or guest details, type (member, guest), sports, registered\_at, checked\_in\_at, checked\_in\_by | Guests store their own photo |
| donation | community, registration (optional), amount, method, gateway\_ref, status, receipt\_no | Community-owned money only |
| ticket | registration, signed\_token | One per registration |
| checkin\_attempt | participant, volunteer, result (admitted, mismatch), at | Audit trail for proxies |
| feedback | event, person, rating, comment, updated\_at | Editable, no closing date |
| notification, audit\_log | community, actor, action, target, at | Append-only audit |
| expense, profile, connection, room, message, photo | community-scoped | Phase 2 and later |

## Security, privacy and compliance

The platform holds children's details, family photos and payment records for many communities, so tenant isolation and consent are built in from the first version. DPDP obligations bind from May 2027.

| Area | Requirement | Basis |
| --- | --- | --- |
| Tenant isolation | `community_id` on every row, enforced in queries and by row-level security; cross-tenant tests in CI | One community must never see another's members |
| Children | Records only, under a parent; consent tick with timestamp; no login, profile, chat or gallery tagging | DPDP Rules require verifiable parental consent for under-18s ([AMS Shardul](https://www.amsshardul.com/wp-content/uploads/2025/11/Regulatory-Alert-Enforcement-of-DPDP-Act-and-Notification-of-DPDP-Rules.pdf)) |
| Photos | Stored privately, served by short-lived signed links, shown only to the person's family, the community's volunteers on event day, and admins | Photos exist for check-in, not for browsing |
| Faith-based eligibility | Self-declaration answer only; no proof documents collected | Collect the minimum needed |
| Notice and consent | Plain notice in English, Hindi and Gujarati at sign-up and roster import; marketing emails opt-in | DPDP notice requirement ([EY](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025)) |
| Deletion | Person can delete their account and family data; donation records kept for accounting | DPDP erasure right |
| Authentication | Google SSO for all members and admins; TOTP MFA for roles with admin powers. Only exception: invited sport coordinators without Google sign in by one-time email code on a scoped, expiring invite; no shared passwords | Decision 3 plus admin protection |
| Payments | Gateway-hosted checkout; webhook signatures verified; community keys encrypted at rest | No card data on platform servers |
| Logging | Error tracking plus append-only audit log of sign-ins, roster uploads, exports, role changes, approvals, check-ins and mismatches | Brief item 29 |
| Breach response | Named owner and 72-hour notification runbook | DPDP Rules breach timeline ([EY](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025)) |

## Branding and configuration (MVP, mandatory)

Nothing about the look, name or wording is hard-coded. The platform has defaults, each community overrides them, and each event can add its own cover art. All values are design tokens stored per tenant and applied as CSS variables at runtime, so a rebrand needs no deploy.

| Area | Configurable items | Level | Rule |
| --- | --- | --- | --- |
| Identity | Platform or community name, short name, tagline, about text | Platform, community | Name appears in title bar, emails, tickets, board |
| Logos | Primary logo, logo for dark backgrounds, square mark, favicon (32 and 16 px), app icon for home-screen install (192 and 512 px), email header logo | Platform, community | Upload validates size and format; missing items fall back to platform default |
| Colours | Primary, secondary, accent, background, surface (cards), text primary, text secondary, border, success, warning, error, link | Platform, community | Contrast checked against WCAG AA before save; failing pairs blocked |
| Dark mode | Separate colour set for dark mode, or off | Platform, community | Projector board can force light or dark |
| Typography | Primary font (headings), secondary font (body), Indic fallback fonts for Hindi and Gujarati, base size, type scale | Platform, community | Pick from Google Fonts or upload; Devanagari and Gujarati coverage checked |
| Shape and density | Corner radius, button style (filled, outline), spacing density | Platform, community | Applied across all components |
| Imagery | Default event cover, share card (Open Graph) image, login background, board background, email banner | Community, event | Share card auto-generated from event cover if absent |
| Documents | Ticket layout (logo, colours, fields shown), certificate template, receipt header and footer, signatory image | Community | Preview before publish |
| Board theme | Projector or TV colours, logo position, sponsor slide set, rotation speed | Event | Readable from the back of a hall (minimum text size enforced) |
| Email | Sender display name, reply-to address, header, footer, signature | Community | Reply-to is the community's email (jsghyd@gmail.com for JSG) |
| Locale | Default language, enabled languages, date and time format, time zone, currency | Platform, community | IST and INR defaults |
| Contact and legal | Address, phone, email, social links, footer text, privacy policy and terms links | Community | Footer and emails pull from here |
| Labels | Rename terms per community (Member, Committee, Donation, Event) and override any UI string per language | Community | Overrides survive app updates |
| Feature switches | Turn modules on or off per community and per event (spot registration, board, feedback, networking) | Community, event | Hidden modules leave no empty menus |

Acceptance: a brand-settings screen with live preview of a page, a ticket, an email and the board; changes apply within one minute without a deploy; every value has a platform default, so a new community looks finished on day one.

## Architecture

Next.js on Vercel with Supabase (Postgres, Google auth, private storage, row-level security, realtime) gives the 2-hour build one backend instead of five, with subdomain tenancy handled in middleware.

| Concern | Choice | Why | Alternative |
| --- | --- | --- | --- |
| App | Next.js (App Router, TypeScript), installable PWA | One codebase for public pages, member app and admin; SEO for community pages | React + Express |
| Tenancy routing | Middleware maps `slug.platform.org` to the community; `platform.org/c/slug` fallback before wildcard DNS is ready | Works on day one without DNS | Custom domains per community later |
| Database | Supabase Postgres with row-level security on `community_id` | Isolation enforced in the database | Neon + app-level filters |
| Auth | Supabase Auth, Google provider only; TOTP for admin roles | Decision 3; MFA built in | Auth.js |
| Files | Supabase Storage, private buckets, signed URLs | Family photos stay private | S3 |
| Payments | Razorpay Orders + webhooks, per-community keys encrypted | Money to the community directly | Cashfree adapter later |
| Email | Resend on a platform domain, reply-to set to the community's email | Deliverability; Gmail SMTP will hit limits | Amazon SES |
| QR | HMAC-signed ticket token; scanner via camera in browser | Forgery-proof, no app install | Native scanner app later |
| Excel | ExcelJS server-side | Typed columns, Unicode names | CSV |
| Language | next-intl with en, hi, gu files | Standard i18n | i18next |
| Real-time (Next phase) | Supabase Realtime for chat, notifications and live dashboard | Already in the stack | Socket.IO |
| Logs | Sentry for errors; audit\_log table for activity | Item 29 | Grafana Cloud |
| Mobile app (Later) | Expo React Native on the same API | Push notifications | PWA push only |

## Additional requirements

Requirements added after the original brief, each labelled with its phase.

### Events

| ID | Missing feature | Why it matters | When |
| --- | --- | --- | --- |
| X1 | Sports draws: categories by age and gender, team formation, fixtures, match schedule, scores, winners | A sports fiesta runs on brackets; without them the committee falls back to paper | MVP |
| X2 | Emergency contact and injury waiver per participant | Physical sports carry injury risk; parent signs for minors | MVP |
| X3 | Catering counts by diet and meal slot (Jain, Chauvihar dinner before sunset, Vegan) | Caterer needs numbers; Chauvihar changes meal timing | MVP |
| X4 | Capacity per sport and waitlist | Courts and boards are limited | MVP |
| X5 | Volunteer duty roster (desk, court, food, first aid) | Volunteers know where to be | MVP |
| X6 | Event-day announcements to registered attendees (schedule change, next match) | Brief item 14 needs a send screen | MVP |
| X7 | Prizes and e-certificates for winners and participants | Common in community sports days | Phase 2 |
| X8 | Sponsors: logos on event page and tickets, sponsor list in reports | Most community events have sponsors | Phase 2 |
| X9 | Ticket types and promo codes (male, female, couple, kids, early bird) | Already in backlog | Phase 2 |
| X10 | Cancellation, refunds, no-show tracking | Clean finance and future planning | Phase 2 |
| X11 | Post-event report: attendance, donations, expenses, feedback | Committee handover and next-year planning | Phase 2 |
| X12 | Recurring and multi-day events, agenda by session | Weekly or monthly gatherings | Phase 4 |

### Sports competition management (MVP, expands X1)

Each sport is run by its own Sport Coordinator, who sees only that sport's players, builds the rounds, records results, and publishes a podium. The event admin oversees all sports and locks final results.

| ID | Requirement | When | Acceptance criterion |
| --- | --- | --- | --- |
| SP1 | Sport Coordinator, assigned by a community admin or committee member per sport per event. Can be a member or an invited outsider (umpire, coach, referee) with no community membership. Access is an emailed invite link scoped to one sport in one event, expiring 24 hours after the event ends (admin can revoke or extend) | MVP | Coordinator sees only their sport's players (name, photo, age band, gender, skill level, check-in status), never contact details, other sports or member data; access ends automatically |
| SP2 | Coordinator's live roster for their sport: every registrant with D-Day check-in status (Arrived with time, Not yet arrived, Withdrawn), filterable by age band, gender and status, with an "arrived only" toggle on by default | MVP | Only arrived players can be placed in a round; not-yet-arrived shown greyed; status updates within 5 seconds of gate check-in; coordinator can mark a no-show as walkover |
| SP3 | Categories per sport (e.g. Under-12, Women's, Men's, Open) and format: knockout, round robin, or groups then knockout | MVP | Format chosen before the draw |
| SP4 | Singles, doubles and teams; coordinator pairs players or forms teams (Cricket, doubles Badminton, Pickleball) | MVP | A player sits in one team per category |
| SP5 | Pairing decided by the coordinator: drag players into matches per round, using age, gender and skill level shown beside each name. Optional "suggest pairings" helper and a bye button; nothing auto-published | MVP | Round published only when the coordinator confirms; clash warning if a player is already on another court |
| SP6 | Rounds and matches with court/board and time slot | MVP | Players see their next match on their ticket page |
| SP7 | Result entry per match (winner, score, walkover, retired); winners advance automatically | MVP | Bracket updates live for everyone |
| SP8 | Final standings 1st, 2nd, 3rd (third-place match or joint bronze, chosen per sport) | MVP | Podium ready when the final is entered |
| SP9 | Victory podium page per sport and an event-wide winners wall, shareable as an image card | MVP | Works on a projector screen and phones |
| SP10 | Optional overall championship: points per position across sports, totalled by family or team | Phase 2 | Points table set by event admin |
| SP11 | Result corrections logged; event admin locks results after the final | MVP | Locked results need event admin to reopen |
| SP12 | Certificates for podium finishers and participants | Phase 2 | PDF per person |

### Live event board (MVP)

One live view of the whole event, in three modes from the same data: a broadcast loop on the venue's projector or big TV, and every attendee's phone via a QR on the screen. It only stays true if coordinators enter results within a minute, so result entry is designed first.

| ID | Requirement | When | Acceptance criterion |
| --- | --- | --- | --- |
| LB1 | Court grid: every court or board with match now playing, score, status (up next, live, done, delayed) | MVP | Updates within 5 seconds of a coordinator entry |
| LB2 | Up-next calling: "Court 2: A vs B, report in 5 minutes" on screen plus email or push to the players' families | MVP | Called players shown in a strip at the bottom |
| LB3 | Live brackets per sport; tap a sport to open it, tap a player to see their path | MVP | Works by touch and on phones |
| LB4 | Winners wall: 1st, 2nd and 3rd for every sport and category as results come in | MVP | Updates when a final is entered |
| LB5 | Podium moments: when a final is entered, the screen takes over with the 1-2-3 podium for 20 seconds | MVP | Then returns to the loop |
| LB6 | Broadcast mode: auto-rotates court grid, brackets, medal table, announcements, sponsor slides when nobody touches it | MVP | Returns to loop after 60 seconds idle |
| LB7 | "Find my family" search on phone: next matches, results, medals | MVP | Shows only names and results, no contact details |
| LB8 | Event pulse: checked-in count, matches done vs total, running delay per sport | MVP | Visible to committee view, summary on public screen |
| LB9 | Announcements ticker pushed from the admin console | MVP | Appears on all screens within 5 seconds |
| LB10 | Two-tap result entry for coordinators (pick winner, optional score) from the bracket | MVP | Usable one-handed on a phone at courtside |
| LB11 | Offline-tolerant: screen keeps last state and shows "reconnecting" | MVP | No blank screen on Wi-Fi drop |
| LB12 | Photo stream on the board from approved uploads | Phase 3 | Admin approves before display |

### Additional event features

| ID | Feature | Why | When |
| --- | --- | --- | --- |
| BF1 | Houses: families split into coloured houses for an overall championship | Turns 7 separate sports into one shared story; cousins cheer across courts | Phase 2 |
| BF2 | Self-rated skill level (beginner, casual, competitive) used for seeding | Stops a club player knocking out a 10-year-old in round 1 | MVP |
| BF3 | Partner finder for doubles and teams | Singles registrants who want to pair up | Phase 2 |
| BF4 | T-shirt size on registration | Kit ordering and identity | MVP |
| BF5 | Photo collection drive: nudge April registrants to upload photos before the day | Photo-verified check-in fails without photos | MVP |
| BF6 | Personal schedule per family: all their matches across sports, with clash warnings | Families with kids in three sports | MVP |
| BF7 | Clash-aware fixtures: no player scheduled on two courts at once | Multi-sport players | MVP |
| BF8 | First-aid and help button for coordinators that alerts the committee lead | Safety | MVP |
| BF9 | Shareable player card after the event: matches played, wins, medal | Organic reach for the next event | Phase 2 |
| BF10 | Kids' participation medals for everyone under 10 | Keeps young families coming back | Phase 2 |

### Community

| ID | Missing feature | Why it matters | When |
| --- | --- | --- | --- |
| Y1 | Membership dues and renewals with expiry and reminders | Most communities fund themselves through annual dues | Phase 2 |
| Y2 | Digital member ID card with QR | Doubles as event entry and identity at partner venues | Phase 2 |
| Y3 | Birthday and anniversary greetings | Core engagement ritual in social groups | Phase 2 |
| Y4 | Polls and committee elections | Decisions and annual elections without paper ballots | Phase 3 |
| Y5 | Member directory with search by city, profession, interests | Networking between events, within privacy settings | Phase 2 |
| Y6 | Announcements board and newsletter | Replaces WhatsApp forwards | Phase 2 |
| Y7 | Volunteer sign-ups for causes and events | Engagement beyond attending | Phase 3 |
| Y8 | Document library (minutes, bylaws, certificates) for committee | Continuity when committees change | Phase 3 |
| Y9 | Donation campaigns separate from events | Fundraising for causes | Phase 3 |
| Y10 | Inactive-member nudges and engagement score per member | Retention | Phase 3 |
| Y11 | Community data export and account closure | Communities must be able to leave with their data | Phase 2 |
| Y12 | Platform plans for communities (free tier, paid features) | Sustains the platform itself | Phase 3 |

### Talent and vendor marketplace (Phase 3)

Artists and service providers register once at platform level and any community can find and book them.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| T1 | Self-registration for talent: comedian, orchestra or band, singer, magician, mind reader, drama company, anchor, DJ, speaker, spiritual speaker | Profile goes live only after platform verification (ID, phone, sample work) |
| T2 | Profile: category, bio, photos, video links, languages, cities served, act duration, fee range, team size, technical needs (stage, sound, power), past events | Searchable by category, city, language, fee band, date |
| T3 | Availability calendar kept by the artist | Booked dates block automatically |
| T4 | Community admin shortlists and sends a booking request with event, date, slot, audience size and budget | Artist accepts, declines or sends a quote |
| T5 | Confirmed booking appears in the event's line-up and schedule, with the artist's tech needs in the committee checklist | Change or cancellation notifies both sides |
| T6 | Two kinds of rating: a review from the community that booked and held the event, and attendee ratings from the event feedback form (see F2) | One review per booking, artist can reply |
| T7 | Same marketplace for vendors: caterers (Jain and Chauvihar capable), decorators, sound and light, photographers, venues, umpires and coaches | Vendor categories configurable by platform admin |
| T8 | Fee settlement off-platform at first, with the agreed amount and status recorded | Holding money between community and artist needs payment-regulation review first |
| T9 | Platform revenue options: verified badge fee, featured listing, or a booking commission | Decided after 20+ bookings show willingness to pay |

### Venue directory (Phase 3)

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| V1 | Venues self-register at platform level: halls, banquet halls, community centres, sports complexes, farmhouses, temple halls, auditoriums | Live after verification (ownership or management proof, phone, photos) |
| V2 | Profile: address with Google Maps pin, spaces within the venue with capacity per layout (theatre, banquet, standing), sports courts and boards, photos, video tour | Searchable by city, area, capacity, date, type |
| V3 | Amenities: parking, wheelchair access, lifts, AV and projector, generator, kitchen (Jain and Chauvihar friendly), outside catering allowed, stay rooms | Filterable |
| V4 | Price bands (per day, per slot), deposit, house rules (timing, sound limit, decoration) | Shown before booking request |
| V5 | Availability calendar; community sends a booking request with date, slot, headcount | Venue accepts, declines or quotes; booked dates block |
| V6 | Confirmed venue fills the event's venue, map link and seat map automatically | One source of truth for venue details |
| V7 | Venue reviews from booking communities plus attendee ratings (F2) on the profile | Same rules as artists |

### Ratings from attendees (Phase 3)

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| F2 | Event feedback form includes a 1 to 5 star rating and optional comment for each booked artist, the venue, the caterer and other booked vendors, plus the event itself | Questions generated from the event's bookings; nothing to set up by hand |
| F3 | Only attendees checked in to that event can rate; one editable rating per provider per event | No ratings from non-attendees |
| F4 | Profiles show average rating, count, and recent comments, split into community reviews and attendee ratings | Average shown only after 5 ratings to avoid one-review swings |
| F5 | Providers get a dashboard of their ratings by event and can reply publicly once per comment | Reply visible under the comment |
| F6 | Abuse controls: report a comment, platform moderation, profanity filter in English, Hindi and Gujarati | Reported comments hidden until reviewed |
| F7 | Community admins see ratings when shortlisting artists, venues and vendors | Sort by rating and by number of events done |

### Help requests (Phase 3)

A request is a structured, time-bound need tied to an event, not a post. The platform finds the right people, nudges them until the need is filled or expires, and turns an accepted offer straight into a role or booking.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| H1 | Request builder: what (category from the marketplace list: umpire, coach, artist, venue, caterer, volunteer, photographer), how many, for which event (dates, venue and city fill in automatically), skills or language needed, paid with budget or honorarium or voluntary, respond-by deadline | No free-text-only requests; deadline required |
| H2 | Audience scope: own members, members of other groups on Hearth who opted in, verified marketplace providers, or public link | Admin picks scope; widening later keeps existing responses |
| H3 | Smart matching: ranks candidates by category, city, availability calendar free on those dates, ratings, events done, and member profile tags (e.g. "cricket coach") | Top matches invited directly; nobody busy on those dates is invited |
| H4 | One-tap response: Interested, Not available, or Quote (amount and note) | Respond from email or in-app without filling a form |
| H5 | Nudge engine: reminder to non-responders, then a wider audience as the deadline nears, then an alert to the admin with suggestions (raise budget, change dates, widen scope) | Nudges capped (max 2 per person per request), quiet hours 9 pm to 8 am respected |
| H6 | Shortlist and confirm: admin compares responders side by side with ratings and quotes, confirms one or more | Unpicked responders thanked automatically |
| H7 | Confirmation does the work: an umpire becomes Sport Coordinator for that sport with a scoped invite; an artist or venue becomes a booking; a volunteer joins the duty roster | No manual follow-up setup |
| H8 | Status on the request: open, partly filled (e.g. 2 of 3 umpires), filled, expired | Filled requests close and stop all nudges |
| H9 | After the event, the helper is rated through the feedback flow (F2) | Rating appears on their profile |
| H10 | Admin insight: time to fill, fill rate, which scopes and budgets work | Shown per community |

### Membership across multiple communities (Phase 2)

One person, one Hearth account, any number of community memberships. The MVP data model already separates `user` from `membership`, so this needs no rework, only the features below.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| MN1 | "My communities" home listing every community the person belongs to, with role and membership status in each | Switch between communities in one tap |
| MN2 | One family record owned by the person; they choose which family members are shared with each community | A community sees only the members shared with it |
| MN3 | Combined calendar of registered and upcoming events across all their communities, with clash warnings | One .ics feed covers all communities |
| MN4 | Roles, dues, donations and receipts kept separately per community | Treasurer of one community sees nothing of another |
| MN5 | Notifications grouped by community, with mute per community | Muting one community leaves others unaffected |
| MN6 | A community cannot see which other communities a member belongs to, unless the member chooses to show it on their profile | Memberships can reveal faith or community, so hidden by default |
| MN7 | Profile fields shared per community: the person picks what each community's members can see | Defaults to the privacy setting (A7) |
| MN8 | Discover other communities: opt-in suggestions based on city and interests, and "apply to join" reusing the existing profile and family | No re-entry of family details |
| MN9 | Leave a community: membership ends, that community's access to the person and family stops, and financial records stay for accounting | Rejoining needs fresh approval |
| MN10 | Co-hosted events by two or more communities: members of each register under their own community's pricing | Each community sees its own registrants and donations |

### Event visibility and discovery across communities (Phase 2)

Who can see an event and who can register for it are two separate settings, so a community can show an event to everyone while only members register.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| EV1 | Visibility levels set by the event admin: Private (invite link only), Members only, Members plus chosen partner communities, All Hearth users (signed in), Public (anyone, search-engine indexed) | Event appears only to the audience chosen |
| EV2 | Registration eligibility set separately: members only, members and guests, or anyone who can see it, with per-audience price (ties to ticket types) | A visitor who can see but not register sees why and how to join |
| EV3 | Platform-wide events page on the parent site, filterable by city, date, category, community, free or paid | Shows only events the viewer is allowed to see |
| EV4 | "Near me" and map view of upcoming visible events | Uses city or location the viewer allows |
| EV5 | Detail masking: exact address, schedule or attendee list can be limited to registrants | Public page shows area only until registration |
| EV6 | Share links respect visibility: a Members-only link asks a non-member to sign in or apply to join | No leak through forwarded links |
| EV7 | Changing visibility after registrations exist keeps existing registrations valid and warns the admin | Change logged |
| EV8 | Follow a community without joining: followers get new public events by email | Unfollow in one tap |
| EV9 | Public events get search-friendly pages with event details structured for Google | Indexed within days of publishing |

### Community health cover (Phase 3 pilot, needs legal review)

Group health insurance for members of registered communities, arranged through an IRDAI-licensed broker with the community as master policyholder and Hearth as the enrolment technology.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| HC1 | Platform partners with one IRDAI-licensed broker; Hearth is the technology partner and earns a flat fee, not commission (unless it later registers as a corporate agent) | Contract reviewed by insurance counsel before launch |
| HC2 | Community admin enables cover for their community; only registered communities (Trust, Society, Section 8) can be policyholders | Unregistered groups such as kitty parties see it as unavailable |
| HC3 | At membership registration or renewal, the member chooses cover with plan, family members covered and premium shown | Opt-in by an explicit tick; never pre-selected or silently added to the fee |
| HC4 | Premium paid straight to the broker's or insurer's collection account by a per-member link, shown as a separate line from the community fee | Neither Hearth nor the community holds premium money |
| HC5 | Member's consent authorising the community to arrange cover, stored with timestamp | Required by the group rules |
| HC6 | Fixed enrolment window and common start date per policy year; certificate of insurance and health card delivered in the app | Each covered person named |
| HC7 | Claims help: TPA contact, hospital list, claim intimation reminder (within 48 hours) | Links only; Hearth does not process claims |
| HC8 | Renewal reminders, and migration prompts to an individual policy when a member leaves or the policy ends | No member silently uncovered |
| HC9 | Group personal-accident cover for sports events, arranged through the same broker with the community as policyholder | Offered on Sports Tournament events. Phase: MVP only if JSG secures a broker before the Fiesta, otherwise Phase 3 |

### Networking, membership and benefits

Membership, networking and benefit features for communities that run as associations, chapters or business networks.

| ID | Feature | Phase | Notes |
| --- | --- | --- | --- |
| NB1 | Federation structure: federation, region or zone, group or chapter, wings (ladies, youth, business), with roll-up reports | Phase 2 | JSG Hyderabad sits inside JSGIF's South Region |
| NB2 | Membership tiers: annual, lifetime or long-term, spouse included, transferable to heir, wing memberships | Phase 2 | GST on fees |
| NB3 | Eligibility rules: age bands (e.g. youth 18 to 36), profession, faith self-declaration | Phase 2 | Faith collected only with explicit consent, visible to approvers only |
| NB4 | Dues invoicing from a roster snapshot, with per-member levy to the parent body | Phase 2 | Expands Y1 |
| NB5 | Renewal and lapse alerts; length-of-membership and sponsor reports | Phase 2 |  |
| NB6 | Office-bearer terms and elections | Phase 3 | Expands Y4 |
| NB7 | Attendance rules: absences in a rolling window, substitutes, automatic flag to committee | Phase 3 | For meeting-based communities |
| NB8 | Referral slips given and received, with status and thank-you | Phase 3 |  |
| NB9 | Closed-business ledger with community totals | Phase 3 | Self-reported, labelled unaudited |
| NB10 | One-to-one meeting scheduling and logging | Phase 3 |  |
| NB11 | One-per-profession option and a "missing professions" list for recruiting | Phase 3 | Off by default |
| NB12 | Visitor registration, visit limit, follow-up and conversion tracking | Phase 3 | Visitor consent recorded |
| NB13 | Meeting agenda builder: presenter rota, education slot, guest speaker | Phase 3 |  |
| NB14 | Business directory with ask and offer posts; members-only selling option | Phase 3 |  |
| NB15 | Personal engagement scorecard each member can see, weights set per community (attendance, events, referrals, volunteering) | Phase 3 | Opt-in visibility; never a public ranking of low scorers |
| NB16 | Community health dashboard: members, retention, visitors, conversion, business closed | Phase 3 |  |
| NB17 | Recognition: awards, top contributors, testimonials | Phase 3 |  |
| NB18 | Member discounts and partner offers card | Phase 3 |  |
| NB19 | Jobs board | Phase 3 |  |
| NB20 | Blood-donor directory | Phase 3 | Opt-in; blood group treated as sensitive |
| NB21 | Impact reporting for donors and CSR partners | Phase 3 |  |
| NB22 | Scholarship and interest-free assistance applications, committee review, repayment tracking | Phase 4 | Registered trusts only; lending needs legal review |
| NB23 | Matrimony listings | Phase 4 | Adults only, consent-first |
| NB24 | Emergency medical help fund | Phase 4 | Discretionary charity only; never a promised payout |
| NB25 | Startup and pitch showcase | Phase 4 | Hearth never handles investments |
| NB26 | Sponsor packages, stall bookings, sponsor lead capture | Phase 2 | Expands X8 |
| NB27 | Inter-chapter events with regional roll-up | Phase 2 | Expands MN10 |
| NB28 | Platform pricing: tiers by active members, free tier for small groups, annual billing timed to event seasons | Phase 3 | Expands Y12 |
| NB29 | Disclosed convenience fee on payments, passed on or absorbed by the community | Phase 2 |  |
| NB30 | Commission on a sponsorship marketplace | Phase 3 |  |
| NB31 | Flat technology fee from the insurance broker partner | Phase 3 | With HC1 |
| NB32 | Premium networking module for business communities | Phase 3 |  |

## Build plan

MVP = everything needed to run Sports Fiesta, and nothing labelled Phase 2, 3 or 4. It is built in ten slices across about three Claude Code sessions; the first session (about 2 hours) delivers slices 1 to 5. Session estimates are rough.

| Slice | Session | Includes (requirement IDs) | Done when |
| --- | --- | --- | --- |
| 1. Foundation | 1 | Next.js + Supabase, path tenancy `/c/[slug]`, Google SSO, roles, row-level security, audit log, MFA for admin roles (A2), branding token engine with platform defaults and community overrides, i18n scaffold (A1, R4, Branding) | Two test communities cannot see each other's data; changing JSG's primary colour changes the app without a deploy |
| 2. Members | 1 | Roster import (April 2026 file), recognition at sign-in, family record with photos, diet, T-shirt size, emergency contact, minor consent; owner assigns roles by email (A3, A4, BF4, X2) | A rostered Google account lands as Member with family pre-filled |
| 3. Events | 1 | Sports Tournament event type, event form (all details entered by admin), sports, categories, capacity per sport, publish, calendar link, map link, share card (E1, E6, X4, N4) | JSG admin publishes Sports Fiesta without code changes |
| 4. Registration | 1 | Tabular registration grid (TR1 to TR8), admin registrations grid with search, filters and Excel download (RW1, RW2, RW6), guests at INR 499, sports per person, skill level, waiver, soft warning above 8, per-person timestamps, drafts and edit or cancel until cut-off (TR9, E7), confirmation email with copy to JSG (E2 to E5, BF2, N1) | Family of 4 plus 2 guests registers in under 3 minutes |
| 5. Donations | 1 | Razorpay test checkout + verified webhook, UPI QR with treasurer confirmation, payment receipt email (D1, D2, D3) | Guest registration confirms only after webhook or treasurer |
| 6. Gate and spot desk | 2 | Signed QR tickets, photo-grid check-in, mismatch log, spot registration with camera photo and Razorpay, UPI or cash (C1, C2, S1 to S6) | Ticket reuse and unticked people blocked; cash totals per volunteer shown |
| 7. Sports operations | 2 | Coordinator invites (scoped, expiring, email-code fallback), live roster with arrival status, manual pairing per round, result entry, podium, results lock (SP1 to SP9, SP11, LB10) | A coordinator runs a full knockout on a phone with test players |
| 8. Live board | 3 | Projector/TV broadcast mode, phone view, court grid, up-next calling, brackets, winners wall, podium takeover, announcements ticker, reconnect state (LB1 to LB11 except kiosk) | Board readable from 10 m; updates within 5 seconds |
| 9. Admin | 3 | Registrations workspace inline edit with audit and per-sport Excel sheets (RW3, RW7), live dashboard, bulk actions (RW4), feedback form (F1), catering counts by diet and meal slot, volunteer roster, event-day announcements, brand settings screen with live preview (R1, R2, X3, X5, X6, BF8) | Export opens in Excel with Hindi and Gujarati names intact |
| 10. Hardening | 3 | Hindi and Gujarati strings, offline tickets and schedule (C3), scanner and board offline caching, load test of 300 concurrent users, security review, photo-drive emails (L1, BF5) | Go-live checklist below passes |

Everything not labelled MVP is out of scope until Sports Fiesta is done; see Phases for what follows.

Go-live checklist for JSG:

- [ ] Domain bought and wildcard DNS pointed
- [ ] JSG's own Razorpay account live (KYC done) and keys entered
- [ ] Member roster from the three previous iterations cleaned and uploaded
- [ ] Hindi and Gujarati strings reviewed by a native speaker
- [ ] Volunteers rehearse check-in with 20 test families
- [ ] CA confirms 80G treatment of guest contributions

## Claude Code build handoff

This PRD is the single source of truth for the build. Claude Code works from a Markdown export of it and never from separate spec files; changes are made here first, then re-exported.

### How the PRD reaches Claude Code

1. Export this doc as Markdown and save it in the repo root as `PRD.md`.
2. After any PRD change, export again and overwrite `PRD.md`, then tell Claude Code "PRD.md updated, re-read the changed sections".
3. Claude Code never edits `PRD.md`. When it needs to deviate (a library fails, a requirement conflicts), it stops, explains, and waits; the PRD is updated here first.

### One-time setup (you, about 20 minutes)

| Item | Where | What to note |
| --- | --- | --- |
| Node.js 20 or later, Git, Claude Code | Your laptop | `node -v` works |
| GitHub repo `hearth` (private) | github.com | Clone it locally; run Claude Code in that folder |
| Supabase project (Mumbai region) | supabase.com | Project URL, anon key, service role key |
| Google OAuth client (Web) | Google Cloud Console | Client ID and secret, entered in Supabase Auth > Google; redirect URL is the one Supabase shows |
| Razorpay test mode keys | Razorpay dashboard (test mode) | Key ID, key secret, webhook secret |
| Resend account | resend.com | API key; sender can be Resend's test domain until a domain exists |
| Vercel project linked to the repo | vercel.com | Preview URL used for Razorpay webhooks, since webhooks cannot reach localhost without a tunnel |

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL (localhost or Vercel preview) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client access to Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin tasks (roster import, webhooks); never sent to the browser |
| `APP_ENCRYPTION_KEY` | Encrypts each community's Razorpay keys at rest |
| `TICKET_SIGNING_SECRET` | Signs QR tickets and coordinator invites |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email |
| `SENTRY_DSN` | Error tracking (optional in session 1) |

JSG's Razorpay test keys are entered in JSG's admin settings in the app, not in environment variables, because each community brings its own account.

### Rules Claude Code must follow

1. Build only items labelled MVP (Build plan slices 1 to 10). Anything labelled Phase 2, 3 or 4 is out of scope, even if easy.
2. Every table except `user` and `community` has `community_id`, protected by row-level security. Every slice adds a test proving one community cannot read another's rows.
3. Nothing visual or textual is hard-coded: colours, fonts, logos, names and labels come from the branding tokens and i18n files (Branding and configuration section).
4. Minors never get a login, profile or chat. Contact details never reach another user's browser unless the owner allows it.
5. Payments confirm only from a verified Razorpay webhook or a treasurer action, never from a browser redirect.
6. Secrets live only in environment variables or encrypted columns; never in code, logs or Git.
7. Each slice ends with: typecheck clean, lint clean, unit tests for business rules, one Playwright end-to-end test of the slice's main flow, and a short demo script of what to click.
8. Commit after each slice with a message naming the slice and requirement IDs. No work continues on a failing slice.
9. Use seed data for two communities (JSG and a dummy kitty party group) and fake families, including minors and guests; never real member data in seeds.
10. When a requirement is ambiguous, ask in one question with a recommended answer, rather than guessing silently.

### Kickoff prompt for session 1

```text
Read PRD.md fully. You are building the Hearth platform MVP described there.
Work through Build plan slices 1 to 5 in order, following "Rules Claude Code must follow".
Before writing code, reply with: your folder structure, the database tables for slices 1 to 5,
and any requirement you find ambiguous (one question each, with your recommended answer).
Then build slice by slice. After each slice, run all checks, commit, and give me the demo script.
Create CLAUDE.md containing only: "Source of truth: PRD.md. Follow its rules section."
```

### Prompts for later sessions

```text
Session 2: Re-read PRD.md (it may have changed). Build slices 6 and 7 following the same rules.
Session 3: Re-read PRD.md. Build slices 8 to 10, then run the go-live checklist and report each item as pass, fail or needs-you.
```

## Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Roster emails missing or not Gmail | Members not recognised at Google sign-in, asked to donate as guests | Match on mobile too after sign-in; "I'm a member" claim routed to committee for one-tap approval |
| Older members without a Google account | Cannot log in (Google SSO is mandatory) | Head of family registers everyone; committee can register a family on someone's behalf |
| Missing photos at the gate | Slow check-in, weak proxy control | Photo reminder emails a week before; volunteers fall back to ID check |
| Razorpay KYC delay for a community | No online donations | UPI QR fallback with treasurer confirmation |
| One community sees another's data | Trust destroyed | Row-level security plus automated cross-tenant tests |
| 2-hour scope is tight | Rough edges in the pilot | Slices ship in order; anything unfinished moves to Next, never half-merged |

Answers from JSG (25 Oct 2026):

| Question | Answer | Effect on build |
| --- | --- | --- |
| Sports Fiesta date, venue, schedule | Admin enters them in the app | Event form must cover all fields; nothing hard-coded |
| Is JSG registered? | Yes | Razorpay KYC can start; MVP is built for Sports Fiesta first, multi-community features after |
| Roster source | Members who registered in April 2026, bulk-uploadable | Roster import matches that file's columns |
| Guest donation | INR 499 fixed for now | Single guest price in MVP |
| Committee, treasurer, volunteers | Owner adds their emails through the admin console | Role assignment by email is in MVP |
| Domain | Not needed for now | MVP runs on the hosting URL with path-based community routing (`/c/jsg`) |
| Platform name | Open | Shortlist in chat |

## Alternative MVP track (26 Oct 2026, agreed with @Gharesh in the Claude Code session)

The amendments below define an alternative MVP that is built now. For this track they take precedence over the sections they name. The original text above is kept unchanged, and the whole track is to be revisited when work moves beyond this PRD (for example when payments, Google sign-in or a hosted backend are reconsidered).

| # | Change | Supersedes | Effect on the build |
| --- | --- | --- | --- |
| AM1 | No Google OAuth. Public registration needs no login. Admins sign in with a per-community admin password; admins verify registrations manually. TOTP MFA is deferred. | Decision 3, A1, A2, Auth rows in Architecture and Security | Edit and cancel use a secret link (token) emailed or shown after submit. Roster upload and sign-in recognition are deferred; "Member or Guest" is chosen on the form and an admin ticks "Verified" per participant. |
| AM2 | No payments in the MVP. No Razorpay, UPI QR, donations, receipts or amounts. | Decision 1, Payments and donations, D1 to D3, S3, Slice 5, amount columns | The registrant marks each row Member or Guest. Payment status filters and "unpaid guest blocks admission" are removed. Payments can return later as their own slice. |
| AM3 | No Supabase. The app is self-contained: Next.js with an embedded SQLite database, deployed from a private GitHub repository (Dockerfile included). | Architecture rows for Database, Auth, Files, Real-time | Row-level security is replaced by `community_id` on every row, queried only through a scoped repository, with cross-community tests. Photos (later slices) are stored on the app's data volume and served through checked routes. |
| AM4 | Email is optional infrastructure. Without SMTP configured, confirmation emails are written to an outbox table the admin can see. | N1 | Confirmation page shows the reference and edit link either way. |
| AM5 | Build order now: registration grid, event admin, registrations workspace with Excel export, dashboard, audit log, branding, i18n. Gate and spot desk, sports operations and the live board follow. | Build plan slices 2 to 5 | Slice 1 branding, tenancy and i18n stay as built. |
