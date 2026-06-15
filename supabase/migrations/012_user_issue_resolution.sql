create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in-progress', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists admin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists issues_user_id_created_at_idx
  on issues (user_id, created_at desc);

create index if not exists admin_logs_user_id_created_at_idx
  on admin_logs (user_id, created_at desc);

create index if not exists notifications_user_id_read_created_at_idx
  on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications read own" on notifications;
create policy "notifications read own"
  on notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications update own" on notifications;
create policy "notifications update own"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
