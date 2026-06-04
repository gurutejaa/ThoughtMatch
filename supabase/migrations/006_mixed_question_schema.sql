alter table questions
  add column if not exists question_type text
    check (question_type in ('multiple_choice', 'slider', 'binary', 'tag', 'short_text', 'archetype')),
  add column if not exists answer_type text
    check (answer_type in ('single_select', 'scale', 'boolean', 'tag', 'text')),
  add column if not exists scoring_method text
    check (scoring_method in ('distance', 'exact', 'weighted_tag', 'insight_only')),
  add column if not exists match_weight numeric(4,2) not null default 1.00,
  add column if not exists prompt_hint text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update questions
set
  question_type = coalesce(question_type, 'multiple_choice'),
  answer_type = coalesce(answer_type, 'single_select'),
  scoring_method = coalesce(scoring_method, 'distance'),
  match_weight = coalesce(match_weight, 1.00),
  metadata = coalesce(metadata, '{}'::jsonb)
where true;

alter table questions
  alter column question_type set default 'multiple_choice',
  alter column answer_type set default 'single_select',
  alter column scoring_method set default 'distance';
