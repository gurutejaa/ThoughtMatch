alter table users
  add column if not exists contact_method text check (contact_method in ('instagram', 'phone')),
  add column if not exists date_of_birth date,
  add column if not exists zodiac text;
