-- MK-Tech: باسورد الشركة + الخروج من جهاز
-- انسخ الملف ده كله، وفي Supabase: SQL Editor ← New query ← الصق ← Run.
--
-- A company password (set by the customer from the app) asked when its code is
-- entered on a new device; signing out of a device frees its place. Devices
-- already signed in keep checking in without it, and copies installed before
-- this (5-argument activate) work unchanged.

alter table public.licenses add column if not exists password_hash text;
comment on column public.licenses.password_hash is 'باسورد الشركة (متشفّر) — بيتطلب لما الكود يتدخّل على جهاز جديد. امسحه (فاضي) لو العميل نسيه';

create or replace function licensing.activate(p_key text, p_device text, p_name text, p_platform text, p_version text, p_password text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'licensing'
as $function$
declare
  k text := licensing.normalize_key(p_key);
  lic public.licenses;
  dev public.license_devices;
  rc licensing.tenant_creds;
  oc licensing.ops_creds;
  used int;
  exp_at timestamptz;
  by_product jsonb := '{}'::jsonb;
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
    -- a device already signed in keeps checking in without the password
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

  if 'rental' = any(lic.products) then
    rc := licensing.tenant_creds_for(lic.id);
    by_product := by_product || jsonb_build_object('rental', jsonb_build_object('email', rc.email, 'password', rc.password));
  end if;
  if 'operations' = any(lic.products) then
    oc := licensing.ops_creds_for(lic.id);
    by_product := by_product || jsonb_build_object('operations', jsonb_build_object('email', oc.email, 'password', oc.password));
  end if;

  exp_at := now() + interval '14 days';
  if lic.expires_at is not null then
    exp_at := least(exp_at, ((lic.expires_at + 1)::timestamp at time zone 'Africa/Cairo'));
  end if;
  return jsonb_build_object('ok', true, 'licenseId', lic.id, 'customer', lic.customer,
    'name', coalesce(nullif(lic.display_name, ''), lic.customer), 'logoUrl', lic.logo_url, 'expiresAt', lic.expires_at,
    'products', to_jsonb(lic.products), 'hasPassword', lic.password_hash is not null,
    'iat', floor(extract(epoch from now()))::bigint, 'exp', floor(extract(epoch from exp_at))::bigint,
    -- copies installed before the suite read "sync" (the rental space)
    'sync', by_product -> 'rental',
    'syncByProduct', by_product);
end$function$;

-- copies installed before the password existed call it without one
create or replace function licensing.activate(p_key text, p_device text, p_name text, p_platform text, p_version text)
 returns jsonb
 language sql
 security definer
 set search_path to 'public', 'licensing'
as $function$ select licensing.activate(p_key, p_device, p_name, p_platform, p_version, null) $function$;

-- signing out of a device: its place on the code is free again
create or replace function licensing.release(p_key text, p_device text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'licensing'
as $function$
declare
  lic public.licenses;
begin
  select * into lic from public.licenses where key = licensing.normalize_key(p_key);
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  delete from public.license_devices where license_id = lic.id and device_id = p_device and not revoked;
  return jsonb_build_object('ok', true);
end$function$;

-- the company password, set from a signed-in device
create or replace function licensing.set_password(p_key text, p_device text, p_current text, p_next text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'licensing'
as $function$
declare
  lic public.licenses;
begin
  select * into lic from public.licenses where key = licensing.normalize_key(p_key);
  if not found or lic.revoked then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not exists (select 1 from public.license_devices where license_id = lic.id and device_id = p_device and not revoked) then
    return jsonb_build_object('ok', false, 'error', 'device_removed');
  end if;
  if lic.password_hash is not null and extensions.crypt(coalesce(p_current, ''), lic.password_hash) <> lic.password_hash then
    return jsonb_build_object('ok', false, 'error', 'wrong_password');
  end if;
  if coalesce(p_next, '') = '' then
    update public.licenses set password_hash = null where id = lic.id;
  elsif length(p_next) < 4 then
    return jsonb_build_object('ok', false, 'error', 'too_short');
  else
    update public.licenses set password_hash = extensions.crypt(p_next, extensions.gen_salt('bf')) where id = lic.id;
  end if;
  return jsonb_build_object('ok', true, 'hasPassword', coalesce(p_next, '') <> '');
end$function$;

-- the lock screen: is this the company password? (from a signed-in device)
create or replace function licensing.check_password(p_key text, p_device text, p_password text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'licensing'
as $function$
declare
  lic public.licenses;
begin
  select * into lic from public.licenses where key = licensing.normalize_key(p_key);
  if not found or lic.revoked then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not exists (select 1 from public.license_devices where license_id = lic.id and device_id = p_device and not revoked) then
    return jsonb_build_object('ok', false, 'error', 'device_removed');
  end if;
  if lic.password_hash is null then return jsonb_build_object('ok', true, 'hasPassword', false); end if;
  if extensions.crypt(coalesce(p_password, ''), lic.password_hash) <> lic.password_hash then
    return jsonb_build_object('ok', false, 'error', 'wrong_password');
  end if;
  return jsonb_build_object('ok', true, 'hasPassword', true);
end$function$;

-- only the license function (server side) calls these
revoke all on function licensing.activate(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function licensing.release(text, text) from public, anon, authenticated;
revoke all on function licensing.set_password(text, text, text, text) from public, anon, authenticated;
revoke all on function licensing.check_password(text, text, text) from public, anon, authenticated;

select 'تمام — اتطبق' as result;
