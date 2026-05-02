create extension if not exists pgcrypto;

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  status text default 'open' check (status in ('open', 'locked', 'active', 'complete')),
  start_date date,
  registration_closes_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id),
  name text not null,
  email text unique not null,
  phone text not null,
  normalized_phone text unique not null,
  country_code text not null,
  area_code text not null,
  instagram_handle text,
  gender text,
  interested_in text,
  contact_method text check (contact_method in ('instagram', 'phone')),
  date_of_birth date,
  zodiac text,
  verified boolean default false,
  batch_id uuid references batches(id),
  preferred_type text,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text check (category in ('mindset', 'emotional', 'lifestyle', 'money', 'habits', 'relationship')),
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  day_number integer check (day_number in (1, 2, 3)),
  order_in_day integer
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  question_id uuid references questions(id),
  answer_index integer check (answer_index between 0 and 3),
  answered_at timestamptz default now(),
  unique(user_id, question_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id),
  user_a uuid references users(id),
  user_b uuid references users(id),
  total_score float,
  category_scores jsonb,
  created_at timestamptz default now()
);

create table if not exists match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id),
  user_id uuid references users(id),
  did_connect boolean,
  quality_rating integer check (quality_rating between 1 and 5),
  submitted_at timestamptz default now()
);

alter table users enable row level security;
alter table answers enable row level security;
alter table matches enable row level security;

drop policy if exists "users read own" on users;
create policy "users read own" on users for select using (auth.uid() = id);

drop policy if exists "users update own" on users;
create policy "users update own" on users for update using (auth.uid() = id);

drop policy if exists "users insert own" on users;
create policy "users insert own" on users for insert with check (auth.uid() = id);

drop policy if exists "answers insert own" on answers;
create policy "answers insert own" on answers for insert with check (auth.uid() = user_id);

drop policy if exists "answers read own" on answers;
create policy "answers read own" on answers for select using (auth.uid() = user_id);

drop policy if exists "matches read own" on matches;
create policy "matches read own" on matches for select using (auth.uid() = user_a or auth.uid() = user_b);
