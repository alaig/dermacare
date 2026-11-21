-- DermaCare schema
create extension if not exists btree_gist;

-- ---------- tables ----------
create table public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table public.admin_secrets (
  id int primary key default 1 check (id = 1),
  calendar_token text not null default md5(random()::text || clock_timestamp()::text)
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_min int not null check (duration_min between 5 and 480),
  price numeric,
  active boolean not null default true,
  sort int not null default 0
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text not null unique check (phone ~ '^05[0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  treatment_id uuid not null references public.treatments(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked','completed','cancelled','no_show')),
  prepaid boolean not null default false,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  -- one treatment room: no two booked appointments may overlap
  constraint no_overlap exclude using gist (tstzrange(start_at, end_at) with &&) where (status = 'booked')
);
create index on public.appointments (client_id);
create index on public.appointments (start_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade, -- null = everyone
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from clients where user_id = auth.uid();
$$;

-- Busy time only, no client details: lets anyone see which slots are taken.
create or replace function public.busy_intervals(p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.start_at, a.end_at from appointments a
  where a.status = 'booked' and a.start_at < p_to and a.end_at > p_from;
$$;

-- After phone OTP: link (or create) the client row for this phone number.
create or replace function public.claim_client(p_name text) returns public.clients
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_row clients;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select '0' || substr(regexp_replace(phone, '\D', '', 'g'), 4) into v_phone
    from auth.users where id = auth.uid();
  select * into v_row from clients where phone = v_phone;
  if found then
    update clients set user_id = auth.uid(),
      name = coalesce(nullif(trim(p_name), ''), name)
    where id = v_row.id returning * into v_row;
  else
    insert into clients (user_id, name, phone)
    values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'زبونة'), v_phone)
    returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.book_appointment(p_treatment uuid, p_start timestamptz)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid := my_client_id();
  v_dur int;
  v_row appointments;
begin
  if v_client is null then raise exception 'not signed in'; end if;
  if p_start < now() + interval '1 hour' then raise exception 'too late to book this slot'; end if;
  select duration_min into v_dur from treatments where id = p_treatment and active;
  if v_dur is null then raise exception 'unknown treatment'; end if;
  insert into appointments (client_id, treatment_id, start_at, end_at)
  values (v_client, p_treatment, p_start, p_start + make_interval(mins => v_dur))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.cancel_appointment(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update appointments set status = 'cancelled'
  where id = p_id and client_id = my_client_id() and status = 'booked' and start_at > now();
$$;

create or replace function public.admin_book(p_name text, p_phone text, p_treatment uuid, p_start timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_dur int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select id into v_client from clients where phone = p_phone;
  if v_client is null then
    insert into clients (name, phone) values (p_name, p_phone) returning id into v_client;
  end if;
  select duration_min into v_dur from treatments where id = p_treatment;
  insert into appointments (client_id, treatment_id, start_at, end_at)
  values (v_client, p_treatment, p_start, p_start + make_interval(mins => v_dur));
end $$;

create or replace function public.save_push_subscription(p_sub jsonb) returns void
language sql security definer set search_path = public as $$
  insert into push_subscriptions (endpoint, client_id, subscription)
  select p_sub->>'endpoint', my_client_id(), p_sub where my_client_id() is not null
  on conflict (endpoint) do update set client_id = excluded.client_id, subscription = excluded.subscription;
$$;

-- ---------- row level security ----------
alter table public.settings enable row level security;
alter table public.admin_secrets enable row level security;
alter table public.admins enable row level security;
alter table public.treatments enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.messages enable row level security;
alter table public.push_subscriptions enable row level security;

create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for all using (is_admin()) with check (is_admin());

create policy secrets_admin on public.admin_secrets for select using (is_admin());

create policy admins_self on public.admins for select using (user_id = auth.uid());

create policy treatments_read on public.treatments for select using (active or is_admin());
create policy treatments_admin on public.treatments for all using (is_admin()) with check (is_admin());

create policy clients_read on public.clients for select using (user_id = auth.uid() or is_admin());
create policy clients_admin on public.clients for all using (is_admin()) with check (is_admin());

create policy appts_read on public.appointments for select using (client_id = my_client_id() or is_admin());
create policy appts_admin on public.appointments for all using (is_admin()) with check (is_admin());

create policy messages_read on public.messages for select
  using (client_id is null or client_id = my_client_id() or is_admin());
create policy messages_admin on public.messages for all using (is_admin()) with check (is_admin());

create policy push_admin on public.push_subscriptions for select using (is_admin());

-- ---------- seed ----------
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict do nothing;
insert into public.admin_secrets (id) values (1) on conflict do nothing;
insert into public.treatments (name, duration_min, price, sort) values
  ('إزالة شعر بالليزر', 30, 250, 1),
  ('تنظيف بشرة عميق', 60, 300, 2),
  ('تقشير كيميائي', 45, 350, 3),
  ('علاج حب الشباب', 45, 280, 4),
  ('استشارة أولى', 15, 0, 5);

-- To make a user an admin (after they sign up with email in Supabase Auth):
-- insert into public.admins (user_id) select id from auth.users where email = 'owner@example.com';
