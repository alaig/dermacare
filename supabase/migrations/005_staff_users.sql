-- DermaCare: dashboard users with a username (no email) + manage them from the dashboard.
-- A username is stored as the sign-in email  <username>@staff.dermacare.local  (never mailed).
-- Run after the earlier migrations. Safe to run more than once.

alter table public.admins add column if not exists username text unique;
alter table public.admins add column if not exists display_name text;
alter table public.admins add column if not exists created_at timestamptz not null default now();

create or replace function public.staff_email(p_username text) returns text
language sql immutable as $$ select lower(p_username) || '@staff.dermacare.local' $$;

create or replace function public.check_username(p_username text) returns text
language plpgsql immutable as $$
begin
  if p_username is null or lower(p_username) !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'bad_username';
  end if;
  return lower(p_username);
end $$;

-- List dashboard users
create or replace function public.admin_list_users()
returns table (user_id uuid, username text, display_name text, email text, is_me boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query
    select a.user_id, a.username, a.display_name,
           case when u.email like '%@staff.dermacare.local' then null else u.email end::text,
           a.user_id = auth.uid(), a.created_at
    from admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end $$;

-- Create a dashboard user
create or replace function public.admin_create_user(p_username text, p_password text, p_display text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user text := check_username(p_username);
  v_email text := staff_email(v_user);
  v_id uuid := gen_random_uuid();
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'short_password'; end if;
  if exists (select 1 from admins where username = v_user) or exists (select 1 from auth.users where email = v_email) then
    raise exception 'username_taken';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          crypt(p_password, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', p_display),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now(), now());

  insert into admins (user_id, username, display_name) values (v_id, v_user, nullif(trim(p_display), ''));
  return v_id;
end $$;

-- Change a user's password
create or replace function public.admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from admins where user_id = p_user) then raise exception 'not_staff'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'short_password'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- Give a user a username (also switches an email account to username sign-in)
create or replace function public.admin_set_username(p_user uuid, p_username text, p_display text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user text := check_username(p_username);
  v_email text := staff_email(v_user);
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from admins where user_id = p_user) then raise exception 'not_staff'; end if;
  if exists (select 1 from admins where username = v_user and user_id <> p_user)
     or exists (select 1 from auth.users where email = v_email and id <> p_user) then
    raise exception 'username_taken';
  end if;
  update auth.users set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
   where id = p_user;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_email)
   where user_id = p_user and provider = 'email';
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), p_user, p_user::text, 'email',
         jsonb_build_object('sub', p_user::text, 'email', v_email, 'email_verified', true), now(), now(), now()
  where not exists (select 1 from auth.identities where user_id = p_user and provider = 'email');
  update admins set username = v_user, display_name = coalesce(nullif(trim(p_display), ''), display_name) where user_id = p_user;
end $$;

-- Remove a user (never yourself, never the last one)
create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'cannot_delete_self'; end if;
  if (select count(*) from admins) <= 1 then raise exception 'last_admin'; end if;
  delete from admins where user_id = p_user;
  delete from auth.users where id = p_user and email like '%@staff.dermacare.local';
end $$;

revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.admin_create_user(text, text, text) from anon;
revoke execute on function public.admin_set_password(uuid, text) from anon;
revoke execute on function public.admin_set_username(uuid, text, text) from anon;
revoke execute on function public.admin_delete_user(uuid) from anon;
