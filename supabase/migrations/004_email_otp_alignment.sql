alter table users add column if not exists email text;
alter table users add column if not exists normalized_phone text;
alter table users add column if not exists country_code text default '+1';
alter table users add column if not exists area_code text;
alter table users add column if not exists date_of_birth date;
alter table users add column if not exists zodiac text;
alter table users add column if not exists contact_method text default 'instagram';

drop policy if exists "users insert own" on users;
drop policy if exists "users read own" on users;
drop policy if exists "users update own" on users;

create policy "users insert own" on users
  for insert with check (auth.uid() = id);

create policy "users read own" on users
  for select using (auth.uid() = id);

create policy "users update own" on users
  for update using (auth.uid() = id);
