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
  note text,
  sync_key text unique
);

create table if not exists payroll_entries (
  id bigint generated always as identity primary key,
  employee_id bigint not null references employees(id) on delete cascade,
  kind text not null check (kind in ('advance','bonus','deduction')),
  month text not null,
  date text not null,
  amount numeric not null default 0,
  payment_method text,
  reason text,
  sync_key text unique
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
-- (drop if exists قبل كل create عشان تقدر تشغّل السكريبت أكتر من مرة
-- من غير ما يطلع خطأ "already exists".)
drop policy if exists "staff full access" on partners;
create policy "staff full access" on partners for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on contractors;
create policy "staff full access" on contractors for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on employees;
create policy "staff full access" on employees for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on expense_categories;
create policy "staff full access" on expense_categories for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on equipment;
create policy "staff full access" on equipment for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on equipment_partner_shares;
create policy "staff full access" on equipment_partner_shares for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on daily_logs;
create policy "staff full access" on daily_logs for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on monthly_expenses;
create policy "staff full access" on monthly_expenses for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on payroll_entries;
create policy "staff full access" on payroll_entries for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on salary_payments;
create policy "staff full access" on salary_payments for all using (is_staff()) with check (is_staff());

drop policy if exists "see own profile or staff sees all" on profiles;
create policy "see own profile or staff sees all" on profiles for select using (id = auth.uid() or is_staff());
drop policy if exists "staff creates profiles" on profiles;
create policy "staff creates profiles" on profiles for insert with check (is_staff());
drop policy if exists "staff updates profiles" on profiles;
create policy "staff updates profiles" on profiles for update using (is_staff());

-- ============ رقم الشريك الشهري — الشريك بياخد أرقامه هو بس، محسوبة
-- جاهزة (دخل، مصروف، مرتب السواق، صافي ربح، حصته) من غير ما يشوف أي داتا
-- تشغيلية خام. لازم يتطابق مع equipmentMonthNetProfit في اللاب بالظبط —
-- يعني برضو بيخصم مرتب السواق الفعلي (سلف+حوافز+دفعات) على المعدة ده،
-- مقسوم على المعدات حسب أيام الشغل، مش بس المصروفات اليدوية. ============
create or replace function get_partner_summary(p_month text)
returns table (
  equipment_name text,
  percentage numeric,
  income numeric,
  manual_expense numeric,
  driver_salary_expense numeric,
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
  ),
  driver_days as (
    select e.id as employee_id, dl.equipment_id, count(*) as days
    from daily_logs dl
    join employees e on e.name = dl.person_name
    where dl.role = 'driver' and dl.date like p_month || '%'
    group by e.id, dl.equipment_id
  ),
  employee_totals as (
    select employee_id, sum(days) as total_days
    from driver_days
    group by employee_id
  ),
  employee_taken as (
    select distinct dd.employee_id,
      coalesce((select sum(amount) from payroll_entries pe where pe.employee_id = dd.employee_id and pe.month = p_month and pe.kind in ('advance','bonus')), 0)
      + coalesce((select sum(amount) from salary_payments sp where sp.employee_id = dd.employee_id and sp.month = p_month), 0) as total_taken
    from driver_days dd
  ),
  driver_salary as (
    select dd.equipment_id,
           sum(et.total_taken * dd.days::numeric / etot.total_days) as total_driver_salary
    from driver_days dd
    join employee_totals etot on etot.employee_id = dd.employee_id
    join employee_taken et on et.employee_id = dd.employee_id
    group by dd.equipment_id
  )
  select e.name,
         eps.percentage,
         coalesce(i.total_income, 0),
         coalesce(x.total_expense, 0),
         coalesce(ds.total_driver_salary, 0),
         coalesce(i.total_income, 0) - coalesce(x.total_expense, 0) - coalesce(ds.total_driver_salary, 0) as net_profit,
         (coalesce(i.total_income, 0) - coalesce(x.total_expense, 0) - coalesce(ds.total_driver_salary, 0)) * eps.percentage / 100 as partner_share
  from equipment_partner_shares eps
  join equipment e on e.id = eps.equipment_id
  left join income i on i.equipment_id = eps.equipment_id
  left join expense x on x.equipment_id = eps.equipment_id
  left join driver_salary ds on ds.equipment_id = eps.equipment_id
  where eps.partner_id = v_partner_id;
end;
$$;

-- ============ دفعات الشركاء (فلوس فعليًا اتدفعت للشريك) — بتتبعت من اللاب
-- بس، عشان نحسب "الباقي لسه مدفعش". ============
create table if not exists partner_payments (
  id bigint generated always as identity primary key,
  partner_id bigint not null references partners(id) on delete cascade,
  date text not null,
  amount numeric not null default 0,
  method text,
  note text,
  sync_key text unique
);

alter table partner_payments enable row level security;
drop policy if exists "staff full access" on partner_payments;
create policy "staff full access" on partner_payments for all using (is_staff()) with check (is_staff());

-- ============ شيت السركي بتاع الشريك — أيام العمل الخام للمعدات اللي ليه
-- نصيب فيها بس (اسم السائق، الساعات، القيمة المحسوبة لكل يوم). ============
create or replace function get_partner_daily_logs(p_month text)
returns table (
  equipment_name text,
  log_date text,
  person_name text,
  actual_hours numeric,
  base_hours numeric,
  day_rate numeric,
  is_day_off boolean,
  day_value numeric
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
  select e.name,
         dl.date,
         dl.person_name,
         dl.actual_hours,
         dl.base_hours,
         dl.day_rate,
         dl.is_day_off,
         case
           when dl.is_day_off then 0
           else coalesce(dl.day_rate,0)
                + (coalesce(dl.actual_hours, dl.base_hours, 0) - coalesce(dl.base_hours, 0))
                  * (coalesce(dl.day_rate,0) / nullif(coalesce(dl.base_hours,8),0))
         end as day_value
  from daily_logs dl
  join equipment e on e.id = dl.equipment_id
  join equipment_partner_shares eps on eps.equipment_id = dl.equipment_id and eps.partner_id = v_partner_id
  where dl.role = 'driver' and dl.date like p_month || '%'
  order by dl.date;
end;
$$;

-- ============ تفصيل مصروفات الشهر بتاعة معدات الشريك. ============
create or replace function get_partner_expenses(p_month text)
returns table (
  equipment_name text,
  expense_date text,
  category_name text,
  amount numeric,
  payment_method text,
  note text
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
  select e.name,
         me.date,
         coalesce(c.name, ''),
         me.amount,
         me.payment_method,
         me.note
  from monthly_expenses me
  join equipment e on e.id = me.equipment_id
  join equipment_partner_shares eps on eps.equipment_id = me.equipment_id and eps.partner_id = v_partner_id
  left join expense_categories c on c.id = me.category_id
  where me.month = p_month
  order by me.date;
end;
$$;

-- ============ الباقي للشريك من كل الشهور (مش بس الشهر الحالي) — نفس منطق
-- اللاب بالظبط: كل الأرباح المستحقة من الأول لحد دلوقتي ناقص كل الدفعات
-- الفعلية اللي استلمها. ============
create or replace function get_partner_balance()
returns table (
  total_due numeric,
  total_paid numeric,
  remaining numeric
)
language plpgsql security definer stable as $$
declare
  v_partner_id bigint;
  v_opening numeric;
  v_due numeric;
  v_paid numeric;
begin
  select partner_id into v_partner_id from profiles where id = auth.uid() and role = 'partner';
  if v_partner_id is null then
    raise exception 'الحساب ده مش شريك مسجل';
  end if;

  select p.opening_balance into v_opening from partners p where p.id = v_partner_id;

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
    where dl.role in ('driver','market')
    group by dl.equipment_id
  ),
  expense as (
    select me.equipment_id, sum(me.amount) as total_expense
    from monthly_expenses me
    group by me.equipment_id
  ),
  driver_days as (
    select e.id as employee_id, dl.equipment_id, left(dl.date,7) as month, count(*) as days
    from daily_logs dl
    join employees e on e.name = dl.person_name
    where dl.role = 'driver'
    group by e.id, dl.equipment_id, left(dl.date,7)
  ),
  employee_totals as (
    select employee_id, month, sum(days) as total_days
    from driver_days
    group by employee_id, month
  ),
  employee_taken as (
    select distinct dd.employee_id, dd.month,
      coalesce((select sum(amount) from payroll_entries pe where pe.employee_id = dd.employee_id and pe.month = dd.month and pe.kind in ('advance','bonus')), 0)
      + coalesce((select sum(amount) from salary_payments sp where sp.employee_id = dd.employee_id and sp.month = dd.month), 0) as total_taken
    from driver_days dd
  ),
  driver_salary as (
    select dd.equipment_id,
           sum(et.total_taken * dd.days::numeric / etot.total_days) as total_driver_salary
    from driver_days dd
    join employee_totals etot on etot.employee_id = dd.employee_id and etot.month = dd.month
    join employee_taken et on et.employee_id = dd.employee_id and et.month = dd.month
    group by dd.equipment_id
  )
  select coalesce(v_opening, 0) + coalesce(sum((coalesce(i.total_income,0) - coalesce(x.total_expense,0) - coalesce(ds.total_driver_salary,0)) * eps.percentage / 100), 0)
  into v_due
  from equipment_partner_shares eps
  left join income i on i.equipment_id = eps.equipment_id
  left join expense x on x.equipment_id = eps.equipment_id
  left join driver_salary ds on ds.equipment_id = eps.equipment_id
  where eps.partner_id = v_partner_id;

  select coalesce(sum(amount), 0) into v_paid from partner_payments where partner_id = v_partner_id;

  return query select v_due, v_paid, v_due - v_paid;
end;
$$;

-- ============ باقي جداول اللاب: خزنة حسن، الهالك، الموردين — staff بس
-- (مش داتا شركاء)، بنفس نمط sync_key للجداول اللي معندهاش مفتاح طبيعي. ============
create table if not exists hassan_ledger (
  id bigint generated always as identity primary key,
  date text not null,
  type text not null check (type in ('loan','repayment','due','collection')),
  amount numeric not null default 0,
  party_name text,
  description text,
  note text,
  sync_key text unique
);

create table if not exists hassan_treasury_expenses (
  id bigint generated always as identity primary key,
  date text not null,
  amount numeric not null default 0,
  description text not null,
  sync_key text unique
);

create table if not exists waste_entries (
  id bigint generated always as identity primary key,
  date text not null,
  amount numeric not null default 0,
  payment_method text,
  note text,
  sync_key text unique
);

create table if not exists suppliers (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists supplier_purchases (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references suppliers(id) on delete cascade,
  date text not null,
  description text,
  amount numeric not null default 0,
  note text,
  sync_key text unique
);

create table if not exists supplier_payments (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references suppliers(id) on delete cascade,
  date text not null,
  amount numeric not null default 0,
  method text,
  note text,
  sync_key text unique
);

alter table hassan_ledger enable row level security;
alter table hassan_treasury_expenses enable row level security;
alter table waste_entries enable row level security;
alter table suppliers enable row level security;
alter table supplier_purchases enable row level security;
alter table supplier_payments enable row level security;

drop policy if exists "staff full access" on hassan_ledger;
create policy "staff full access" on hassan_ledger for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on hassan_treasury_expenses;
create policy "staff full access" on hassan_treasury_expenses for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on waste_entries;
create policy "staff full access" on waste_entries for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on suppliers;
create policy "staff full access" on suppliers for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on supplier_purchases;
create policy "staff full access" on supplier_purchases for all using (is_staff()) with check (is_staff());
drop policy if exists "staff full access" on supplier_payments;
create policy "staff full access" on supplier_payments for all using (is_staff()) with check (is_staff());

-- بيخلي Postgres يبعت الصف كامل (مش الـ id بس) في إشعارات الحذف —
-- محتاجينها عشان اللاب يعرف يمسح صف السركي الصح لما يتمسح من الموبايل.
alter table daily_logs replica identity full;

-- ============ دفعات المقاولين (فلوس المقاول دفعها للشركة) — كانت موجودة
-- في اللاب بس (contractor_payments في SQLite) ومكانتش متزامنة خالص، ده اللي
-- كان بيمنع شاشة "المقاولين" والصادر/الوارد يظهروا صح على الموبايل. ============
create table if not exists contractor_payments (
  id bigint generated always as identity primary key,
  contractor_id bigint not null references contractors(id) on delete cascade,
  date text not null,
  amount numeric not null default 0,
  method text,
  note text,
  sync_key text unique
);

alter table contractor_payments enable row level security;
drop policy if exists "staff full access" on contractor_payments;
create policy "staff full access" on contractor_payments for all using (is_staff()) with check (is_staff());

-- بيخلي Postgres يبعت الصف القديم كامل (مش الـ id بس) في إشعارات التعديل —
-- محتاجينها عشان أي جهاز يعرف "اتغيّر اسم مين" لما حد يعيد تسمية سائق أو نوع
-- مصروف، فيعدّل نفس السجل محليًا بدل ما يعمل واحد جديد مكرر بالاسم الجديد.
alter table partners replica identity full;
alter table contractors replica identity full;
alter table employees replica identity full;
alter table equipment replica identity full;
alter table expense_categories replica identity full;

-- ============ حساب دخول محصور لحسن بس (زي حساب الشريك بالظبط) — بيشوف
-- كوميشنه مقسّم لكل معدة وخزنته الشخصية، من غير أي وصول لباقي بيانات
-- الشركة. كوميشن أي معدة = فرق سعر المقاول عن السركي، بنفس اليوم، + أي
-- أوفر تايم، بلا استثناءات — زي ما بقى في اللاب والموبايل بالظبط. ============
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('staff', 'partner', 'hassan'));

create or replace function get_hassan_commission_by_equipment(p_month text)
returns table (equipment_name text, commission numeric)
language plpgsql security definer stable as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'hassan') then
    raise exception 'الحساب ده مش حساب حسن';
  end if;

  return query
  with paired as (
    select c.equipment_id,
      (coalesce(c.day_rate, 0) - coalesce(d.day_rate, 0))
      * (1 + greatest(0, coalesce(c.actual_hours, 0) - coalesce(c.base_hours, 0)) / coalesce(nullif(c.base_hours, 0), 8))
      as commission
    from daily_logs c
    join daily_logs d on d.equipment_id = c.equipment_id and d.date = c.date and d.role = 'driver'
    where c.role = 'contractor' and c.date like p_month || '%'
  ),
  market as (
    select d.equipment_id, coalesce(d.hassan_commission, 0) as commission
    from daily_logs d
    where d.role = 'market' and d.hassan_commission is not null and d.date like p_month || '%'
  ),
  expenses as (
    select me.equipment_id, me.amount as commission
    from monthly_expenses me
    join expense_categories ec on ec.id = me.category_id
    where ec.counts_as_commission and me.month = p_month
  ),
  all_rows as (
    select * from paired
    union all
    select * from market
    union all
    select * from expenses
  )
  select e.name, sum(r.commission)
  from all_rows r
  join equipment e on e.id = r.equipment_id
  group by e.name
  order by sum(r.commission) desc;
end;
$$;

create or replace function get_hassan_treasury_balance(p_month text)
returns table (balance numeric, all_time_commission numeric, all_time_spent numeric, month_commission numeric, month_spent numeric)
language plpgsql security definer stable as $$
declare
  v_all_time_commission numeric;
  v_month_commission numeric;
  v_all_time_spent numeric;
  v_month_spent numeric;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'hassan') then
    raise exception 'الحساب ده مش حساب حسن';
  end if;

  select coalesce(sum(commission), 0) into v_all_time_commission from (
    select (coalesce(c.day_rate, 0) - coalesce(d.day_rate, 0))
      * (1 + greatest(0, coalesce(c.actual_hours, 0) - coalesce(c.base_hours, 0)) / coalesce(nullif(c.base_hours, 0), 8)) as commission
    from daily_logs c
    join daily_logs d on d.equipment_id = c.equipment_id and d.date = c.date and d.role = 'driver'
    where c.role = 'contractor'
    union all
    select coalesce(hassan_commission, 0) from daily_logs where role = 'market' and hassan_commission is not null
    union all
    select me.amount from monthly_expenses me join expense_categories ec on ec.id = me.category_id where ec.counts_as_commission
  ) t;

  select coalesce(sum(commission), 0) into v_month_commission from (
    select (coalesce(c.day_rate, 0) - coalesce(d.day_rate, 0))
      * (1 + greatest(0, coalesce(c.actual_hours, 0) - coalesce(c.base_hours, 0)) / coalesce(nullif(c.base_hours, 0), 8)) as commission
    from daily_logs c
    join daily_logs d on d.equipment_id = c.equipment_id and d.date = c.date and d.role = 'driver'
    where c.role = 'contractor' and c.date like p_month || '%'
    union all
    select coalesce(hassan_commission, 0) from daily_logs where role = 'market' and hassan_commission is not null and date like p_month || '%'
    union all
    select me.amount from monthly_expenses me join expense_categories ec on ec.id = me.category_id where ec.counts_as_commission and me.month = p_month
  ) t;

  select coalesce(sum(amount), 0) into v_all_time_spent from hassan_treasury_expenses;
  select coalesce(sum(amount), 0) into v_month_spent from hassan_treasury_expenses where date like p_month || '%';

  return query select v_all_time_commission - v_all_time_spent, v_all_time_commission, v_all_time_spent, v_month_commission, v_month_spent;
end;
$$;

-- ============ باج قديم: monthly_expenses وpayroll_entries وsalary_payments
-- اتعملوا من غير عمود sync_key من الأول (على عكس كل الجداول التانية اللي
-- بتتزامن بنفس الطريقة) — يعني أي مصروف أو سلفة أو دفعة مرتب جديدة كانت
-- بتفشل في المزامنة بصمت من أول ما الميزات دي اتعملت، والداتا القديمة
-- بس (اللي دخلت قبل المزامنة) هي اللي كانت شكلها سليم. ============
alter table monthly_expenses add column if not exists sync_key text unique;
alter table payroll_entries add column if not exists sync_key text unique;
alter table salary_payments add column if not exists sync_key text unique;

-- بيجبر PostgREST يعمل تحديث فوري لكاش الشكل (schema cache) بدل ما ينتظر
-- الدورة التلقائية — من غيره ممكن ياخد شوية دقايق لحد ما الأعمدة الجديدة
-- تتعرف عليها فعليًا.
notify pgrst, 'reload schema';
