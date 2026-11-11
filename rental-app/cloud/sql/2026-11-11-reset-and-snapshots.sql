-- تصفير بيانات التأجير لشركة + نسخ محفوظة على السحابة تقدر MK ترجّعها.
--  - قبل أي مسح بتتاخد نسخة كاملة (صفوف المزامنة + سجل التعديلات) في data_snapshots.
--  - المسح بيزوّد data_epoch: كل جهاز للشركة بيعرف من رد الترخيص إن الداتا اتصفّرت،
--    فبيمسح نسخته ويسحب من جديد (فاضي، أو النسخة اللي رجعت).
--  - tenant_resets: أي صف قديم (قبل التصفير) جاي من جهاز لسه معرفش بيترفض.
-- Applied with the Supabase MCP tool (apply_migration).

alter table public.licenses add column if not exists data_epoch int not null default 0;

create table if not exists licensing.data_snapshots (
  id bigserial primary key,
  owner_id bigint not null,
  created_at timestamptz not null default now(),
  reason text,
  rows_count int not null default 0,
  log_count int not null default 0
);
create index if not exists data_snapshots_owner on licensing.data_snapshots (owner_id, created_at desc);

create table if not exists licensing.data_snapshot_rows (
  snapshot_id bigint not null references licensing.data_snapshots (id) on delete cascade,
  src text not null check (src in ('rows', 'log')),
  data jsonb not null
);
create index if not exists data_snapshot_rows_snapshot on licensing.data_snapshot_rows (snapshot_id, src);

create table if not exists licensing.tenant_resets (
  tenant_id bigint primary key,
  reset_at timestamptz not null
);

-- نسخة كاملة من داتا التأجير بتاعة الشركة دي
create or replace function licensing.snapshot_tenant(p_owner bigint, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare sid bigint; nr int; nl int;
begin
  insert into licensing.data_snapshots (owner_id, reason) values (p_owner, p_reason) returning id into sid;
  insert into licensing.data_snapshot_rows (snapshot_id, src, data)
    select sid, 'rows', to_jsonb(r) from public.sync_rows r where r.tenant_id = p_owner;
  get diagnostics nr = row_count;
  insert into licensing.data_snapshot_rows (snapshot_id, src, data)
    select sid, 'log', to_jsonb(l) from public.sync_log l where l.tenant_id = p_owner;
  get diagnostics nl = row_count;
  update licensing.data_snapshots set rows_count = nr, log_count = nl where id = sid;
  return sid;
end $$;

-- مسح داتا التأجير من السحابة + كل الأجهزة تعرف (data_epoch)
create or replace function licensing.wipe_tenant(p_owner bigint)
returns int language plpgsql security definer set search_path = '' as $$
declare epoch int;
begin
  delete from public.sync_rows where tenant_id = p_owner;
  delete from public.sync_log where tenant_id = p_owner;
  insert into licensing.tenant_resets (tenant_id, reset_at) values (p_owner, now())
    on conflict (tenant_id) do update set reset_at = excluded.reset_at;
  update public.licenses set data_epoch = data_epoch + 1 where id = p_owner returning data_epoch into epoch;
  return epoch;
end $$;

-- من البرنامج: "صفّر البرنامج" — بباسورد الشركة بس
create or replace function licensing.reset_company(p_key text, p_device text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lic public.licenses; owner bigint; sid bigint; epoch int;
begin
  select * into lic from public.licenses where key = licensing.normalize_key(p_key);
  if not found or lic.revoked then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not exists (select 1 from public.license_devices where license_id = lic.id and device_id = p_device and not revoked) then
    return jsonb_build_object('ok', false, 'error', 'device_removed');
  end if;
  if lic.password_hash is null then return jsonb_build_object('ok', false, 'error', 'password_needed'); end if;
  if extensions.crypt(coalesce(p_password, ''), lic.password_hash) <> lic.password_hash then
    return jsonb_build_object('ok', false, 'error', 'wrong_password');
  end if;
  owner := coalesce(lic.data_from, lic.id);
  sid := licensing.snapshot_tenant(owner, 'قبل التصفير من البرنامج');
  epoch := licensing.wipe_tenant(owner);
  return jsonb_build_object('ok', true, 'snapshotId', sid, 'dataEpoch', epoch);
end $$;

-- من لوحة MK: رجّع نسخة محفوظة (الداتا الحالية بتتحفظ نسخة الأول، فالرجوع نفسه بيترجع)
create or replace function licensing.restore_snapshot(p_owner bigint, p_snapshot bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pre bigint; epoch int; nr int; nl int;
begin
  if not exists (select 1 from licensing.data_snapshots where id = p_snapshot and owner_id = p_owner) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  pre := licensing.snapshot_tenant(p_owner, 'قبل الرجوع لنسخة #' || p_snapshot);
  epoch := licensing.wipe_tenant(p_owner);
  -- op = initial: مبتتكررش في سجل التعديلات (السجل نفسه راجع من النسخة)
  insert into public.sync_rows (tbl, gid, data, deleted, op, updated_at, device_id, device_name, tenant_id)
    select data->>'tbl', data->>'gid', coalesce(data->'data', '{}'::jsonb), coalesce((data->>'deleted')::boolean, false), 'initial', now(), data->>'device_id', data->>'device_name', p_owner
    from licensing.data_snapshot_rows where snapshot_id = p_snapshot and src = 'rows'
    order by (data->>'seq')::bigint nulls first;
  get diagnostics nr = row_count;
  insert into public.sync_log (tbl, gid, op, data, device_id, device_name, at, tenant_id)
    select data->>'tbl', data->>'gid', data->>'op', data->'data', data->>'device_id', data->>'device_name', (data->>'at')::timestamptz, p_owner
    from licensing.data_snapshot_rows where snapshot_id = p_snapshot and src = 'log'
    order by (data->>'id')::bigint;
  get diagnostics nl = row_count;
  return jsonb_build_object('ok', true, 'savedFirst', pre, 'rows', nr, 'log', nl, 'dataEpoch', epoch);
end $$;

revoke all on function licensing.snapshot_tenant(bigint, text) from public, anon, authenticated;
revoke all on function licensing.wipe_tenant(bigint) from public, anon, authenticated;
revoke all on function licensing.reset_company(text, text, text) from public, anon, authenticated;
revoke all on function licensing.restore_snapshot(bigint, bigint) from public, anon, authenticated;

-- صفوف قديمة (قبل آخر تصفير) جاية من جهاز لسه معرفش: بتترفض
create or replace function public.sync_rows_before()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare t bigint;
begin
  t := case when tg_op = 'UPDATE' then old.tenant_id else coalesce(new.tenant_id, public.current_tenant()) end;
  if exists (select 1 from licensing.tenant_resets r where r.tenant_id = t and new.updated_at < r.reset_at) then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then return null; end if;
    new.tenant_id := old.tenant_id;
  elsif new.tenant_id is null then
    new.tenant_id := public.current_tenant();
  end if;
  new.seq := nextval('public.sync_seq');
  return new;
end$function$;
revoke execute on function public.sync_rows_before() from public, anon, authenticated;

-- رد التفعيل فيه data_epoch بتاع الشركة: الجهاز بيقارنه باللي عنده
CREATE OR REPLACE FUNCTION licensing.activate(p_key text, p_device text, p_name text, p_platform text, p_version text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'licensing'
AS $function$
declare
  k text := licensing.normalize_key(p_key);
  lic public.licenses;
  dev public.license_devices;
  rc licensing.tenant_creds;
  oc licensing.ops_creds;
  used int;
  exp_at timestamptz;
  by_product jsonb := '{}'::jsonb;
  owner_id bigint;
begin
  select * into lic from public.licenses where key = k;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if lic.revoked then return jsonb_build_object('ok', false, 'error', 'revoked'); end if;
  if lic.expires_at is not null and lic.expires_at < (now() at time zone 'Africa/Cairo')::date then
    return jsonb_build_object('ok', false, 'error', 'expired', 'expiresAt', lic.expires_at);
  end if;
  if coalesce(p_device, '') = '' then return jsonb_build_object('ok', false, 'error', 'bad_device'); end if;

  select * into dev from public.license_devices where license_id = lic.id and device_id = p_device;
  if found then
    if dev.revoked then return jsonb_build_object('ok', false, 'error', 'device_removed'); end if;
    update public.license_devices set last_seen_at = now(), device_name = coalesce(p_name, device_name), app_version = p_version where id = dev.id;
  else
    if lic.password_hash is not null then
      if coalesce(p_password, '') = '' then return jsonb_build_object('ok', false, 'error', 'password_required'); end if;
      if extensions.crypt(p_password, lic.password_hash) <> lic.password_hash then
        return jsonb_build_object('ok', false, 'error', 'wrong_password');
      end if;
    end if;
    select count(*) into used from public.license_devices where license_id = lic.id and not revoked;
    if used >= lic.max_devices then
      return jsonb_build_object('ok', false, 'error', 'full', 'maxDevices', lic.max_devices);
    end if;
    insert into public.license_devices (license_id, device_id, device_name, platform, app_version) values (lic.id, p_device, p_name, p_platform, p_version);
  end if;

  -- كود بيستخدم بيانات كود تاني من نفس الشركة (تأجير بس / تشغيل بس / الاتنين)
  owner_id := coalesce(lic.data_from, lic.id);
  if 'rental' = any(lic.products) then
    rc := licensing.tenant_creds_for(owner_id);
    by_product := by_product || jsonb_build_object('rental', jsonb_build_object('email', rc.email, 'password', rc.password));
  end if;
  if 'operations' = any(lic.products) then
    oc := licensing.ops_creds_for(owner_id);
    by_product := by_product || jsonb_build_object('operations', jsonb_build_object('email', oc.email, 'password', oc.password));
  end if;

  exp_at := now() + interval '14 days';
  if lic.expires_at is not null then
    exp_at := least(exp_at, ((lic.expires_at + 1)::timestamp at time zone 'Africa/Cairo'));
  end if;
  return jsonb_build_object('ok', true, 'licenseId', owner_id, 'customer', lic.customer,
    'name', coalesce(nullif(lic.display_name, ''), lic.customer), 'logoUrl', lic.logo_url, 'expiresAt', lic.expires_at,
    'products', to_jsonb(lic.products), 'plan', lic.plan, 'maxEquipment', lic.max_equipment, 'hasPassword', lic.password_hash is not null,
    'dataEpoch', (select o.data_epoch from public.licenses o where o.id = owner_id),
    'iat', floor(extract(epoch from now()))::bigint, 'exp', floor(extract(epoch from exp_at))::bigint,
    'sync', by_product -> 'rental',
    'syncByProduct', by_product);
end$function$;
