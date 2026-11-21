-- DermaCare: birthdays + automatic birthday greetings
-- Safe to run more than once.

-- 1) New columns
alter table public.clients add column if not exists birth_date date;
alter table public.messages add column if not exists kind text not null default 'manual';

-- 2) Sign-up now also saves the birth date
drop function if exists public.claim_client(text);
create or replace function public.claim_client(p_name text, p_birth date default null) returns public.clients
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
      name = coalesce(nullif(trim(p_name), ''), name),
      birth_date = coalesce(p_birth, birth_date)
    where id = v_row.id returning * into v_row;
  else
    insert into clients (user_id, name, phone, birth_date)
    values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'زبونة'), v_phone, p_birth)
    returning * into v_row;
  end if;
  return v_row;
end $$;

-- 3) A signed-in client can add/change her own birth date
create or replace function public.set_my_birth_date(p_birth date) returns void
language sql security definer set search_path = public as $$
  update clients set birth_date = p_birth where user_id = auth.uid();
$$;

-- 4) Send today's birthday greetings (once per client per year)
create or replace function public.send_birthday_messages() returns int
language plpgsql security definer set search_path = public as $$
declare
  s jsonb;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_leap boolean;
  v_gift text;
  v_title text;
  v_body text;
  v_count int;
begin
  select data into s from settings where id = 1;
  s := coalesce(s, '{}'::jsonb);
  if coalesce((s->>'birthdayEnabled')::boolean, true) = false then return 0; end if;

  v_gift  := coalesce(nullif(s->>'birthdayGift', ''),  'جلسة تنظيف بشرة مجانية');
  v_title := coalesce(nullif(s->>'birthdayTitle', ''), 'عيد ميلاد سعيد يا {الاسم} 🎂');
  v_body  := coalesce(nullif(s->>'birthdayBody', ''),
    'كل عام وأنتِ بخير! بمناسبة عيد ميلادك، هديتك من DermaCare: {الهدية}.' || chr(10) ||
    'الهدية صالحة لمدة شهر، احجزي موعدك من التطبيق.');
  v_leap := extract(day from (make_date(extract(year from v_today)::int, 3, 1) - 1)) = 29;

  insert into messages (client_id, title, body, kind)
  select c.id,
         replace(replace(v_title, '{الاسم}', split_part(trim(c.name), ' ', 1)), '{الهدية}', v_gift),
         replace(replace(v_body,  '{الاسم}', split_part(trim(c.name), ' ', 1)), '{الهدية}', v_gift),
         'birthday'
  from clients c
  where c.birth_date is not null
    and (
      (extract(month from c.birth_date) = extract(month from v_today)
        and extract(day from c.birth_date) = extract(day from v_today))
      or (not v_leap and extract(month from c.birth_date) = 2 and extract(day from c.birth_date) = 29
        and extract(month from v_today) = 2 and extract(day from v_today) = 28)
    )
    and not exists (
      select 1 from messages m
      where m.client_id = c.id and m.kind = 'birthday'
        and m.created_at >= date_trunc('year', now() at time zone 'Asia/Jerusalem')
    );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Only the scheduler (and the admin wrapper below) may run it
revoke execute on function public.send_birthday_messages() from public, anon, authenticated;

create or replace function public.admin_send_birthdays() returns int
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return send_birthday_messages();
end $$;

-- 5) Run it automatically every morning (06:00 UTC = 08:00/09:00 Israel time)
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'dermacare-birthdays';
select cron.schedule('dermacare-birthdays', '0 6 * * *', 'select public.send_birthday_messages()');
