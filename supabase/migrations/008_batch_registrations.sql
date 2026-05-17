create table if not exists batch_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  email text not null,
  normalized_phone text not null,
  registered_at timestamptz not null default now()
);

create unique index if not exists batch_registrations_batch_user_idx
  on batch_registrations (batch_id, user_id);

create unique index if not exists batch_registrations_batch_email_idx
  on batch_registrations (batch_id, lower(email));

create unique index if not exists batch_registrations_batch_phone_idx
  on batch_registrations (batch_id, normalized_phone);

alter table answers
  add column if not exists batch_id uuid references batches(id);

update answers
set batch_id = users.batch_id
from users
where answers.user_id = users.id
  and answers.batch_id is null;

alter table answers
  drop constraint if exists answers_user_id_question_id_key;

create unique index if not exists answers_user_batch_question_idx
  on answers (user_id, batch_id, question_id)
  where batch_id is not null;

insert into batch_registrations (user_id, batch_id, email, normalized_phone, registered_at)
select
  users.id,
  users.batch_id,
  users.email,
  users.normalized_phone,
  coalesce(users.created_at, now())
from users
where users.batch_id is not null
on conflict do nothing;

alter table batch_registrations enable row level security;

drop policy if exists "batch registrations read own" on batch_registrations;
create policy "batch registrations read own"
  on batch_registrations for select
  using (auth.uid() = user_id);

drop policy if exists "batch registrations insert own" on batch_registrations;
create policy "batch registrations insert own"
  on batch_registrations for insert
  with check (auth.uid() = user_id);
