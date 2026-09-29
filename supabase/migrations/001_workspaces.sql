-- Tokuma: accounts, per-business data, and consent-based support access.
--
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
--
-- Security model
--   * Every business's data lives in one row of `workspaces`, owned by the signed-in user.
--     Row Level Security lets a user read and write only their own row.
--   * Support access is OFF by default. A user turns it on in Settings (allow_support).
--   * Admins never get table access. They go through admin_* functions that check the caller
--     is an admin, refuse data from businesses that haven't allowed support, and log every view.
--   * Users can see their own support-access log.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.workspaces (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references auth.users (id) on delete cascade,
  data          jsonb not null default '{}'::jsonb,
  business_name text not null default '',
  allow_support boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.support_access_log (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  admin_id     uuid not null references auth.users (id) on delete cascade,
  reason       text not null,
  accessed_at  timestamptz not null default now()
);
create index if not exists support_access_log_workspace_idx on public.support_access_log (workspace_id, accessed_at desc);

-- updated_at is always set by the database, so clients can use it for conflict checks.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security

alter table public.workspaces enable row level security;
alter table public.admins enable row level security;            -- no policies: not readable by clients
alter table public.support_access_log enable row level security;

drop policy if exists "own workspace: select" on public.workspaces;
drop policy if exists "own workspace: insert" on public.workspaces;
drop policy if exists "own workspace: update" on public.workspaces;
drop policy if exists "own workspace: delete" on public.workspaces;
create policy "own workspace: select" on public.workspaces for select to authenticated using (owner_id = auth.uid());
create policy "own workspace: insert" on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy "own workspace: update" on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own workspace: delete" on public.workspaces for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "own support log: select" on public.support_access_log;
create policy "own support log: select" on public.support_access_log for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- Supabase grants every privilege on new tables to anon and authenticated by default.
-- Start from nothing, then grant only what the app needs (RLS still applies on top).
revoke all on public.workspaces, public.admins, public.support_access_log from anon, authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select on public.support_access_log to authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------- admin functions

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Directory of businesses: names and counts only, never the data itself.
create or replace function public.admin_list_workspaces()
returns table (
  id uuid, business_name text, owner_email text, allow_support boolean,
  products integer, transactions integer, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select w.id, w.business_name, u.email::text, w.allow_support,
           coalesce(jsonb_array_length(w.data -> 'products'), 0),
           coalesce(jsonb_array_length(w.data -> 'transactions'), 0),
           w.created_at, w.updated_at
    from public.workspaces w
    join auth.users u on u.id = w.owner_id
    order by w.updated_at desc;
end $$;

-- Opens one business's data for support. Requires a reason, requires the business to have
-- allowed support access, and records the view in support_access_log.
create or replace function public.admin_open_workspace(target uuid, reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  result jsonb;
  allowed boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(length(trim(reason)), 0) < 5 then
    raise exception 'a reason of at least 5 characters is required' using errcode = '22023';
  end if;
  select w.data, w.allow_support into result, allowed from public.workspaces w where w.id = target;
  if not found then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;
  if not allowed then
    raise exception 'this business has not allowed support access' using errcode = '42501';
  end if;
  insert into public.support_access_log (workspace_id, admin_id, reason) values (target, auth.uid(), trim(reason));
  return result;
end $$;

revoke all on function public.is_admin(), public.admin_list_workspaces(), public.admin_open_workspace(uuid, text) from public, anon;
grant execute on function public.is_admin(), public.admin_list_workspaces(), public.admin_open_workspace(uuid, text) to authenticated;

-- ---------------------------------------------------------------- making yourself an admin
-- After you've signed up in the app with your own email, run (with your email):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
