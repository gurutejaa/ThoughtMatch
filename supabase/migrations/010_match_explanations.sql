alter table matches
  add column if not exists match_summary text,
  add column if not exists match_reasons text[] not null default '{}',
  add column if not exists shared_answer_count integer not null default 0;
