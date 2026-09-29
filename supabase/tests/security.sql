-- Security tests for supabase/migrations/001_workspaces.sql.
-- Run on a scratch PostgreSQL database after local_auth_stub.sql and the migration:
--   psql -d scratch -f supabase/tests/local_auth_stub.sql -f supabase/migrations/001_workspaces.sql -f supabase/tests/security.sql
-- Every check prints PASS; any failure stops the script with FAIL.
\set ON_ERROR_STOP 1
insert into auth.users values
 ('11111111-1111-1111-1111-111111111111','alice@shop.co'),
 ('22222222-2222-2222-2222-222222222222','bob@store.co'),
 ('99999999-9999-9999-9999-999999999999','owner@tokuma.co');
insert into public.admins (user_id) values ('99999999-9999-9999-9999-999999999999');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
end $$;

-- 1. Alice and Bob each create their own workspace; Alice can't create one for Bob.
begin; select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.workspaces (owner_id, data, business_name) values ('11111111-1111-1111-1111-111111111111', '{"products":[{"id":"p1"}],"transactions":[{"id":"t1"},{"id":"t2"}]}', 'Alice Goods');
do $$ begin
  insert into public.workspaces (owner_id) values ('22222222-2222-2222-2222-222222222222');
  raise exception 'FAIL 1: Alice created a workspace for Bob';
exception when insufficient_privilege then raise notice 'PASS 1: cannot create a workspace for someone else'; end $$;
commit;
begin; select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
insert into public.workspaces (owner_id, data, business_name) values ('22222222-2222-2222-2222-222222222222', '{"secret":"bob-only"}', 'Bob Store');
commit;

-- 2. Bob cannot see, change or delete Alice's data.
begin; select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ declare n int; begin
  select count(*) into n from public.workspaces; if n <> 1 then raise exception 'FAIL 2a: Bob sees % workspaces', n; end if;
  update public.workspaces set data = '{}' where business_name = 'Alice Goods'; get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL 2b: Bob updated Alice'; end if;
  delete from public.workspaces where business_name = 'Alice Goods'; get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL 2c: Bob deleted Alice'; end if;
  raise notice 'PASS 2: Bob sees only his own workspace and cannot change or delete Alice''s';
end $$;
-- Bob can't hand his row to Alice either.
do $$ begin
  update public.workspaces set owner_id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL 2d: Bob reassigned his workspace';
exception when insufficient_privilege then raise notice 'PASS 2d: cannot reassign a workspace to another user'; end $$;
commit;

-- 3. Signed-out visitors can read nothing.
begin; set local role anon;
do $$ begin
  perform * from public.workspaces; raise exception 'FAIL 3: anon read workspaces';
exception when insufficient_privilege then raise notice 'PASS 3: signed-out visitors cannot read workspaces'; end $$;
do $$ begin
  perform public.admin_list_workspaces(); raise exception 'FAIL 3b: anon ran admin function';
exception when insufficient_privilege then raise notice 'PASS 3b: signed-out visitors cannot call admin functions'; end $$;
commit;

-- 4. Regular users can't read the admins table, call admin functions, or write the access log.
begin; select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ begin perform * from public.admins; raise exception 'FAIL 4a';
exception when insufficient_privilege then raise notice 'PASS 4a: users cannot read the admins list'; end $$;
do $$ begin perform public.admin_list_workspaces(); raise exception 'FAIL 4b';
exception when insufficient_privilege then raise notice 'PASS 4b: non-admins cannot list businesses'; end $$;
do $$ begin perform public.admin_open_workspace((select id from public.workspaces limit 1), 'just looking'); raise exception 'FAIL 4c';
exception when insufficient_privilege then raise notice 'PASS 4c: non-admins cannot open workspaces'; end $$;
do $$ begin insert into public.support_access_log (workspace_id, admin_id, reason) select id, auth.uid(), 'fake' from public.workspaces limit 1; raise exception 'FAIL 4d';
exception when insufficient_privilege then raise notice 'PASS 4d: users cannot write fake access-log entries'; end $$;
do $$ begin if public.is_admin() then raise exception 'FAIL 4e'; end if; raise notice 'PASS 4e: is_admin() is false for Bob'; end $$;
commit;

-- 5. Admin: directory shows names and counts, not data. Opening needs consent + reason.
begin; select pg_temp.act_as('99999999-9999-9999-9999-999999999999');
do $$ declare r record; n int := 0; begin
  if not public.is_admin() then raise exception 'FAIL 5a: owner not admin'; end if;
  for r in select * from public.admin_list_workspaces() loop n := n + 1;
    if r.business_name = 'Alice Goods' and (r.products <> 1 or r.transactions <> 2 or r.owner_email <> 'alice@shop.co') then raise exception 'FAIL 5b: wrong summary %', r; end if;
  end loop;
  if n <> 2 then raise exception 'FAIL 5c: admin sees % businesses', n; end if;
  raise notice 'PASS 5a-c: admin directory lists both businesses with counts and emails only';
  if exists (select 1 from public.workspaces) then raise exception 'FAIL 5d: admin can read workspaces table directly'; end if;
  raise notice 'PASS 5d: admin has no direct table access (only via logged functions)';
end $$;
do $$ begin perform public.admin_open_workspace((select id from public.admin_list_workspaces() where business_name = 'Alice Goods'), 'debugging import');
  raise exception 'FAIL 5e: opened without consent';
exception when insufficient_privilege then raise notice 'PASS 5e: cannot open a business that has not allowed support access'; end $$;
commit;

-- Alice turns on support access.
begin; select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
update public.workspaces set allow_support = true;
commit;

begin; select pg_temp.act_as('99999999-9999-9999-9999-999999999999');
do $$ declare ws uuid := (select id from public.admin_list_workspaces() where business_name = 'Alice Goods'); d jsonb; begin
  begin perform public.admin_open_workspace(ws, 'hi'); raise exception 'FAIL 6a';
  exception when invalid_parameter_value then raise notice 'PASS 6a: a reason is required'; end;
  d := public.admin_open_workspace(ws, 'Investigating import error');
  if jsonb_array_length(d -> 'transactions') <> 2 then raise exception 'FAIL 6b: wrong data'; end if;
  raise notice 'PASS 6b: admin opens Alice''s data after she allowed it';
  begin perform public.admin_open_workspace((select id from public.admin_list_workspaces() where business_name = 'Bob Store'), 'curious about bob'); raise exception 'FAIL 6c';
  exception when insufficient_privilege then raise notice 'PASS 6c: Bob (not allowed) stays locked'; end;
end $$;
commit;

-- 7. Alice sees the view in her access history; Bob does not.
begin; select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
do $$ declare n int; r text; begin
  select count(*), max(reason) into n, r from public.support_access_log;
  if n <> 1 or r <> 'Investigating import error' then raise exception 'FAIL 7a: Alice sees % entries', n; end if;
  raise notice 'PASS 7a: Alice sees the logged view and its reason';
end $$;
commit;
begin; select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ declare n int; begin select count(*) into n from public.support_access_log;
  if n <> 0 then raise exception 'FAIL 7b: Bob sees Alice''s log'; end if; raise notice 'PASS 7b: Bob cannot see Alice''s access log'; end $$;
commit;

-- 8. Conflict check: an update based on a stale updated_at matches nothing.
begin; select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
do $$ declare before timestamptz; after timestamptz; n int; begin
  select updated_at into before from public.workspaces;
  update public.workspaces set data = data || '{"x":1}' where updated_at = before; get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 8a'; end if;
  select updated_at into after from public.workspaces;
  if after <= before then raise exception 'FAIL 8b: updated_at did not advance'; end if;
  update public.workspaces set data = '{}' where updated_at = before; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 8c: stale save overwrote newer data'; end if;
  raise notice 'PASS 8: stale saves are rejected so another tab''s changes are not overwritten';
end $$;
commit;
\echo ALL SECURITY TESTS FINISHED
