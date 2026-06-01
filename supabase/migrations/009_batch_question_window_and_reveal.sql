alter table batches
  add column if not exists question_closes_at timestamptz,
  add column if not exists reveal_ready boolean not null default false;
