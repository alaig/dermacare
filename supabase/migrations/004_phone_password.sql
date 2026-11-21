-- DermaCare: clients sign up with phone + password (derived from their 4-digit PIN), no SMS and no email.
-- Requires: Authentication -> Sign In / Providers -> Phone -> "Enable phone confirmations" turned OFF.
-- Run after 003_pin_login.sql. Safe to run more than once.

-- Phone of the signed-in user, as 05XXXXXXXX (auth stores it as 9725XXXXXXXX)
create or replace function public.phone_from_auth_email() returns text
language sql stable security definer set search_path = public as $$
  select '0' || substr(regexp_replace(u.phone, '\D', '', 'g'), 4)
  from auth.users u where u.id = auth.uid() and u.phone is not null and u.phone <> '';
$$;

-- New 4-digit PIN for a client (forgot PIN / signed up before PINs existed)
create or replace function public.admin_reset_pin(p_client uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v clients;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin must be 4 digits'; end if;
  select * into v from clients where id = p_client;
  if not found then raise exception 'not found'; end if;
  if v.user_id is null then raise exception 'no_account'; end if;
  update auth.users
     set encrypted_password = crypt(p_pin || '#dermacare#' || v.phone, gen_salt('bf')),
         phone_confirmed_at = coalesce(phone_confirmed_at, now()),
         updated_at = now()
   where id = v.user_id;
end $$;

revoke execute on function public.admin_reset_pin(uuid, text) from anon;
