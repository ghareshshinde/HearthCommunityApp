-- Slice 1: foundation. Tenancy, roles, audit log, branding. RLS on every tenant table.
-- Assumes Supabase's auth schema (auth.uid(), auth.jwt()).

create table app_user (
  id uuid primary key,                       -- = auth.users.id
  google_sub text unique,
  email text not null unique,
  name text,
  photo_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table community (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null,
  type text not null check (type in ('trust','society','section8','unregistered')),
  city text,
  about text,
  status text not null default 'pending' check (status in ('pending','live','suspended')),
  owner_id uuid not null references app_user(id),
  branding jsonb not null default '{}'::jsonb,   -- design tokens, validated in app
  labels jsonb not null default '{}'::jsonb,     -- renamed terms / string overrides
  settings jsonb not null default '{}'::jsonb,   -- locale, feature switches
  payment_config jsonb,                          -- encrypted at rest by the app (slice 5)
  created_at timestamptz not null default now()
);

create table membership (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  user_id uuid not null references app_user(id),
  roles text[] not null default '{member}'
    check (roles <@ array['owner','committee','treasurer','volunteer','member']),
  status text not null default 'active' check (status in ('active','removed')),
  approved_by uuid references app_user(id),
  created_at timestamptz not null default now(),
  unique (community_id, user_id)
);
create index on membership (user_id);

create table audit_log (
  id bigint generated always as identity primary key,
  community_id uuid references community(id) on delete cascade,
  actor_id uuid references app_user(id),
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index on audit_log (community_id, at desc);

-- Append-only: block UPDATE and DELETE even for privileged roles.
create function audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- ---------- helpers (security definer so policies do not recurse) ----------
create function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from app_user where id = auth.uid()), false)
$$;

create function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership
    where community_id = cid and user_id = auth.uid() and status = 'active')
$$;

-- Admin-level roles need MFA: the session must be aal2 (A2).
create function has_admin_role(cid uuid, variadic wanted text[] default array['owner','committee','treasurer'])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' and exists (
    select 1 from membership
    where community_id = cid and user_id = auth.uid() and status = 'active' and roles && wanted)
$$;

create function has_role(cid uuid, wanted text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership
    where community_id = cid and user_id = auth.uid() and status = 'active' and wanted = any(roles))
$$;

-- Creating a community makes its founder the owner, and the community starts pending.
create function community_bootstrap() returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into membership (community_id, user_id, roles, approved_by)
  values (new.id, new.owner_id, array['owner','member'], new.owner_id);
  insert into audit_log (community_id, actor_id, action, target)
  values (new.id, new.owner_id, 'community.created', new.slug);
  return new;
end $$;
create trigger community_after_insert after insert on community
  for each row execute function community_bootstrap();

-- Only a platform admin may move a community out of pending or change its status.
create function community_guard() returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.status := 'pending'; new.owner_id := auth.uid(); end if;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and not is_platform_admin() then
      raise exception 'only a platform admin can change community status';
    end if;
    if new.slug is distinct from old.slug or new.owner_id is distinct from old.owner_id then
      raise exception 'slug and owner are immutable';
    end if;
  end if;
  return new;
end $$;
create trigger community_before_write before insert or update on community
  for each row execute function community_guard();

-- ---------- row-level security ----------
alter table app_user  enable row level security;
alter table community enable row level security;
alter table membership enable row level security;
alter table audit_log enable row level security;
alter table app_user  force row level security;
alter table community force row level security;
alter table membership force row level security;
alter table audit_log force row level security;

-- app_user: yourself, platform admins, and committee of a community you both belong to.
create policy app_user_self on app_user for select using (id = auth.uid());
create policy app_user_insert_self on app_user for insert with check (id = auth.uid() and is_platform_admin = false);
create policy app_user_update_self on app_user for update using (id = auth.uid())
  with check (id = auth.uid() and is_platform_admin = is_platform_admin());
create policy app_user_platform on app_user for select using (is_platform_admin());
create policy app_user_committee on app_user for select using (
  exists (select 1 from membership m where m.user_id = app_user.id and has_admin_role(m.community_id)));

-- community: live ones are public (directory); members see their own; owner edits.
create policy community_public on community for select using (status = 'live');
create policy community_member on community for select using (is_member(id) or owner_id = auth.uid());
create policy community_platform on community for all using (is_platform_admin()) with check (is_platform_admin());
create policy community_insert on community for insert with check (owner_id = auth.uid());
create policy community_owner_update on community for update
  using (has_admin_role(id, 'owner')) with check (has_admin_role(id, 'owner'));

-- membership: see your own rows; committee sees the community's; only owner assigns roles.
create policy membership_self on membership for select using (user_id = auth.uid());
create policy membership_admin on membership for select using (has_admin_role(community_id));
create policy membership_owner_write on membership for all
  using (has_admin_role(community_id, 'owner')) with check (has_admin_role(community_id, 'owner'));

-- audit_log: append by an authenticated actor inside their own community; admins read.
create policy audit_insert on audit_log for insert
  with check (actor_id = auth.uid() and (community_id is null or is_member(community_id)));
create policy audit_read on audit_log for select using (has_admin_role(community_id) or is_platform_admin());
