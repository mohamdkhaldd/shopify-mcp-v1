-- دفتر البنيان — سكيمة Supabase (Postgres) للمزامنة بين الموبايل واللاب،
-- زائد نظام تسجيل الدخول والصلاحيات (staff / partner).
-- شغّل الملف ده كامل مرة واحدة في Supabase → SQL Editor → New query → Run.

-- ============ الجداول المشتركة ============
create table if not exists partners (
  id bigint generated always as identity primary key,
  name text not null unique,
  opening_balance numeric not null default 0
);

create table if not exists contractors (
  id bigint generated always as identity primary key,
  name text not null unique,
  opening_balance numeric not null default 0
);

create table if not exists employees (
  id bigint generated always as identity primary key,
  name text not null unique,
  wage_type text not null check (wage_type in ('daily','monthly')),
  rate numeric not null default 0,
  fixed_salary boolean not null default false
);

create table if not exists expense_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  counts_as_commission boolean not null default false
);

create table if not exists equipment (
  id bigint generated always as identity primary key,
  name text not null unique,
  purchase_price numeric not null default 0
);

create table if not exists equipment_partner_shares (
  equipment_id bigint not null references equipment(id) on delete cascade,
  partner_id bigint not null references partners(id) on delete cascade,
  percentage numeric not null,
  primary key (equipment_id, partner_id)
);

create table if not exists daily_logs (
  id bigint generated always as identity primary key,
  equipment_id bigint not null references equipment(id) on delete cascade,
  date text not null,
  role text not null check (role in ('driver','contractor','market')),
  person_name text not null default '',
  actual_hours numeric,
  base_hours numeric,
  day_rate numeric,
  is_day_off boolean not null default false,
  fixed_value numeric,
  hassan_commission numeric,
  note text,
  unique (equipment_id, date, role)
);

create table if not exists monthly_expenses (
  id bigint generated always as identity primary key,
  equipment_id bigint not null references equipment(id) on delete cascade,
  month text not null,
  date text,
  category_id bigint references expense_categories(id),
  amount numeric not null default 0,
  payment_method text,
  note text
);

create table if not exists payroll_entries (
  id bigint generated always as identity primary key,
  employee_id bigint not null references employees(id) on delete cascade,
  kind text not null check (kind in ('advance','bonus','deduction')),
  month text not null,
  date text not null,
  amount numeric not null default 0,
  payment_method text,
  reason text
);

create table if not exists salary_payments (
  id bigint generated always as identity primary key,
  employee_id bigint not null references employees(id) on delete cascade,
  month text not null,
  date text not null,
  amount numeric not null default 0,
  payment_method text not null default 'cash',
  note text
);

-- ============ صلاحيات المستخدمين ============
-- كل مستخدم مسجل دخول (staff أو partner) له سطر هنا. الـ id بيربطه
-- بحساب الدخول بتاعه (auth.users)، partner_id متعبى بس لو role = partner.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null check (role in ('staff','partner')),
  partner_id bigint references partners(id)
);

-- ============ تفعيل RLS على كل جدول ============
alter table partners enable row level security;
alter table contractors enable row level security;
alter table employees enable row level security;
alter table expense_categories enable row level security;
alter table equipment enable row level security;
alter table equipment_partner_shares enable row level security;
alter table daily_logs enable row level security;
alter table monthly_expenses enable row level security;
alter table payroll_entries enable row level security;
alter table salary_payments enable row level security;
alter table profiles enable row level security;

create or replace function is_staff() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'staff');
$$;

-- staff (حسن + المحاسبين) بس هو اللي يشوف/يعدّل الجداول التشغيلية دي —
-- الشركاء بياخدوا أرقامهم من فانكشن get_partner_summary تحت، مش من هنا.
create policy "staff full access" on partners for all using (is_staff()) with check (is_staff());
create policy "staff full access" on contractors for all using (is_staff()) with check (is_staff());
create policy "staff full access" on employees for all using (is_staff()) with check (is_staff());
create policy "staff full access" on expense_categories for all using (is_staff()) with check (is_staff());
create policy "staff full access" on equipment for all using (is_staff()) with check (is_staff());
create policy "staff full access" on equipment_partner_shares for all using (is_staff()) with check (is_staff());
create policy "staff full access" on daily_logs for all using (is_staff()) with check (is_staff());
create policy "staff full access" on monthly_expenses for all using (is_staff()) with check (is_staff());
create policy "staff full access" on payroll_entries for all using (is_staff()) with check (is_staff());
create policy "staff full access" on salary_payments for all using (is_staff()) with check (is_staff());

create policy "see own profile or staff sees all" on profiles for select using (id = auth.uid() or is_staff());
create policy "staff creates profiles" on profiles for insert with check (is_staff());
create policy "staff updates profiles" on profiles for update using (is_staff());

-- ============ رقم الشريك الشهري — الشريك بياخد أرقامه هو بس، محسوبة
-- جاهزة (دخل، مصروف، صافي ربح، حصته) من غير ما يشوف أي داتا تشغيلية خام. ============
create or replace function get_partner_summary(p_month text)
returns table (
  equipment_name text,
  percentage numeric,
  income numeric,
  manual_expense numeric,
  net_profit numeric,
  partner_share numeric
)
language plpgsql security definer stable as $$
declare
  v_partner_id bigint;
begin
  select partner_id into v_partner_id from profiles where id = auth.uid() and role = 'partner';
  if v_partner_id is null then
    raise exception 'الحساب ده مش شريك مسجل';
  end if;

  return query
  with income as (
    select dl.equipment_id,
           sum(
             case
               when dl.is_day_off then 0
               when dl.role = 'market' then coalesce(dl.fixed_value,0) - coalesce(dl.hassan_commission,0)
               else coalesce(dl.day_rate,0)
                    + (coalesce(dl.actual_hours, dl.base_hours, 0) - coalesce(dl.base_hours, 0))
                      * (coalesce(dl.day_rate,0) / nullif(coalesce(dl.base_hours,8),0))
             end
           ) as total_income
    from daily_logs dl
    where dl.role in ('driver','market') and dl.date like p_month || '%'
    group by dl.equipment_id
  ),
  expense as (
    select me.equipment_id, sum(me.amount) as total_expense
    from monthly_expenses me
    where me.month = p_month
    group by me.equipment_id
  )
  select e.name,
         eps.percentage,
         coalesce(i.total_income, 0),
         coalesce(x.total_expense, 0),
         coalesce(i.total_income, 0) - coalesce(x.total_expense, 0) as net_profit,
         (coalesce(i.total_income, 0) - coalesce(x.total_expense, 0)) * eps.percentage / 100 as partner_share
  from equipment_partner_shares eps
  join equipment e on e.id = eps.equipment_id
  left join income i on i.equipment_id = eps.equipment_id
  left join expense x on x.equipment_id = eps.equipment_id
  where eps.partner_id = v_partner_id;
end;
$$;
