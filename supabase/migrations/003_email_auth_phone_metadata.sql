alter table users
  add column if not exists email text,
  add column if not exists normalized_phone text,
  add column if not exists country_code text,
  add column if not exists area_code text;

alter table users
  drop constraint if exists users_phone_key;

update users
set
  email = coalesce(email, concat(id::text, '@placeholder.invalid')),
  normalized_phone = coalesce(normalized_phone, regexp_replace(phone, '\D', '', 'g')),
  country_code = coalesce(country_code, '+1'),
  area_code = coalesce(area_code, left(regexp_replace(phone, '\D', '', 'g'), 3))
where email is null
   or normalized_phone is null
   or country_code is null
   or area_code is null;

alter table users
  alter column email set not null,
  alter column phone set not null,
  alter column normalized_phone set not null,
  alter column country_code set not null,
  alter column area_code set not null;

drop index if exists users_normalized_phone_key;
create unique index if not exists users_normalized_phone_key on users(normalized_phone);

drop index if exists users_email_key;
create unique index if not exists users_email_key on users(email);
