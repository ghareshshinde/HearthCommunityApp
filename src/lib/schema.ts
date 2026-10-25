// Every table except `community` carries community_id; all access goes through repo.ts, which always filters by it.
export const SCHEMA = `
create table if not exists community (
  id integer primary key autoincrement,
  slug text not null unique,
  name text not null,
  type text not null default 'trust',
  city text,
  about text,
  branding text not null default '{}',
  admin_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create table if not exists event (
  id integer primary key autoincrement,
  community_id integer not null references community(id),
  title text not null,
  description text not null default '',
  starts_at text,            -- ISO UTC
  ends_at text,
  venue text not null default '',
  map_url text not null default '',
  sports text not null default '[]',      -- JSON array of sport names
  config text not null default '{}',      -- JSON column switches
  cutoff_at text,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create table if not exists registration (
  id integer primary key autoincrement,
  community_id integer not null references community(id),
  event_id integer not null references event(id),
  ref text not null,
  token text not null unique,
  registrant_name text not null,
  registrant_mobile text not null,
  registrant_email text not null default '',
  emergency_name text not null,
  emergency_mobile text not null,
  waiver_at text not null,
  source text not null default 'online',
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  unique (community_id, ref)
);
create table if not exists participant (
  id integer primary key autoincrement,
  community_id integer not null references community(id),
  event_id integer not null references event(id),
  registration_id integer not null references registration(id),
  name text not null,
  age integer not null,
  gender text not null check (gender in ('Male','Female')),
  mobile text not null default '',
  email text not null default '',
  sports text not null default '[]',
  waitlist text not null default '[]',   -- sports this person is waitlisted for (capacity reached)
  skill text not null default '',
  diet text not null default 'Vegetarian',
  tshirt text not null default '',
  accessibility text not null default '',
  kind text not null check (kind in ('member','guest')),
  source text not null default 'online',   -- online registration or added at the spot desk
  checked_in_at text,
  checked_in_by text,
  checked_in_gate text,
  verified integer not null default 0,
  registered_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create index if not exists participant_event on participant(community_id, event_id);
create table if not exists staff (
  id integer primary key autoincrement,
  community_id integer not null references community(id),
  name text not null,
  role text not null check (role in ('sport','sports_all','gate')),
  sport text,
  username text not null,
  password_hash text not null,
  invite_hash text,
  invite_expires_at text,
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  unique (community_id, username)
);
create table if not exists audit_log (
  id integer primary key autoincrement,
  community_id integer references community(id),
  actor text not null,
  action text not null,
  target text,
  meta text not null default '{}',
  at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create trigger if not exists audit_no_update before update on audit_log begin select raise(abort,'audit_log is append-only'); end;
create trigger if not exists audit_no_delete before delete on audit_log begin select raise(abort,'audit_log is append-only'); end;
create table if not exists outbox (
  id integer primary key autoincrement,
  community_id integer not null references community(id),
  to_email text not null,
  subject text not null,
  body text not null,
  sent integer not null default 0,
  at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
`
