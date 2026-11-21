-- DermaCare: sign-up without SMS (phone + 4-digit PIN), new clients need one-time approval by the center.
-- Requires: Authentication -> Sign In / Providers -> Email -> "Confirm email" turned OFF.
-- Safe to run more than once.

-- 1) Client approval state
alter table public.clients add column if not exists approved boolean not null default true;  -- existing clients stay approved
alter table public.clients add column if not exists registered_at timestamptz;

-- 2) New appointment status 'pending' (booked by a client the center has not confirmed yet). It still holds the slot.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('pending','booked','completed','cancelled','no_show'));
alter table public.appointments drop constraint if exists no_overlap;
alter table public.appointments add constraint no_overlap
  exclude using gist (tstzrange(start_at, end_at) with &&) where (status in ('booked','pending'));

create or replace function public.busy_intervals(p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.start_at, a.end_at from appointments a
  where a.status in ('booked','pending') and a.start_at < p_to and a.end_at > p_from;
$$;

-- 3) Helpers
-- Clients sign in with a synthetic email built from the phone: p0521234567@clients.dermacare.app
create or replace function public.phone_from_auth_email() returns text
language sql stable security definer set search_path = public as $$
  select substring(u.email from '^p(05[0-9]{8})@clients\.dermacare\.app$')
  from auth.users u where u.id = auth.uid();
$$;

create or replace function public.my_client_row() returns public.clients
language sql stable security definer set search_path = public as $$
  select * from clients where user_id = auth.uid();
$$;

-- 4) Register after auth sign-up
create or replace function public.register_client(p_name text, p_birth date default null) returns public.clients
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := phone_from_auth_email();
  v_row clients;
begin
  if auth.uid() is null or v_phone is null then raise exception 'not signed in'; end if;
  select * into v_row from clients where phone = v_phone;
  if found and v_row.user_id is not null and v_row.user_id <> auth.uid() then
    -- number already belongs to another account: remove the auth user just created
    delete from auth.users where id = auth.uid();
    raise exception 'phone_taken';
  end if;
  if found then
    -- the center already knew this number: link it, but the center must confirm it is really her
    update clients set user_id = auth.uid(), approved = false, registered_at = now(),
      name = coalesce(nullif(trim(p_name), ''), name),
      birth_date = coalesce(p_birth, birth_date)
    where id = v_row.id returning * into v_row;
  else
    insert into clients (user_id, name, phone, birth_date, approved, registered_at)
    values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'زبونة'), v_phone, p_birth, false, now())
    returning * into v_row;
  end if;
  return v_row;
end $$;

-- 5) Booking: unconfirmed clients get 'pending'
create or replace function public.book_appointment(p_treatment uuid, p_start timestamptz)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_client clients := my_client_row();
  v_dur int;
  v_row appointments;
begin
  if v_client.id is null then raise exception 'not signed in'; end if;
  if p_start < now() + interval '1 hour' then raise exception 'too late to book this slot'; end if;
  select duration_min into v_dur from treatments where id = p_treatment and active;
  if v_dur is null then raise exception 'unknown treatment'; end if;
  insert into appointments (client_id, treatment_id, start_at, end_at, status)
  values (v_client.id, p_treatment, p_start, p_start + make_interval(mins => v_dur),
          case when v_client.approved then 'booked' else 'pending' end)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.cancel_appointment(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update appointments set status = 'cancelled'
  where id = p_id and client_id = my_client_id() and status in ('booked','pending') and start_at > now();
$$;

-- 6) Until approved, a client sees only what she booked herself after registering
drop policy if exists appts_read on public.appointments;
create policy appts_read on public.appointments for select using (
  is_admin() or (
    client_id = my_client_id()
    and ((my_client_row()).approved or created_at >= (my_client_row()).registered_at)
  )
);

-- 7) Admin actions
create or replace function public.admin_approve_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update clients set approved = true where id = p_client;
  update appointments set status = 'booked' where client_id = p_client and status = 'pending';
end $$;

create or replace function public.admin_reject_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v clients;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into v from clients where id = p_client;
  if not found then return; end if;
  if v.user_id is not null then delete from auth.users where id = v.user_id; end if;
  if v.registered_at is not null and v.created_at < v.registered_at - interval '1 minute' then
    -- an existing client of the center: keep her history, drop only the bad registration
    update appointments set status = 'cancelled'
      where client_id = v.id and status = 'pending' and created_at >= v.registered_at;
    update clients set user_id = null, approved = true, registered_at = null where id = v.id;
  else
    delete from clients where id = v.id;
  end if;
end $$;

-- New 4-digit PIN for a client (forgot PIN / registered before PINs existed)
create or replace function public.admin_reset_pin(p_client uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v clients;
  v_email text;
  v_pass text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin must be 4 digits'; end if;
  select * into v from clients where id = p_client;
  if not found then raise exception 'not found'; end if;
  v_email := 'p' || v.phone || '@clients.dermacare.app';
  v_pass := p_pin || '#dermacare#' || v.phone;
  if v.user_id is null then
    raise exception 'no_account';
  end if;
  update auth.users
     set email = v_email,
         encrypted_password = crypt(v_pass, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = v.user_id;
  -- an email/password user also needs an email identity row to sign in
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), v.user_id, v.user_id::text, 'email',
         jsonb_build_object('sub', v.user_id::text, 'email', v_email, 'email_verified', true),
         now(), now(), now()
  where not exists (select 1 from auth.identities i where i.user_id = v.user_id and i.provider = 'email');
end $$;

revoke execute on function public.admin_approve_client(uuid) from anon;
revoke execute on function public.admin_reject_client(uuid) from anon;
revoke execute on function public.admin_reset_pin(uuid, text) from anon;
