alter table answers
  add column if not exists answer_text text;

alter table answers
  drop constraint if exists answers_answer_index_check;

alter table answers
  add constraint answers_answer_index_check
  check (answer_index is null or answer_index between 0 and 100);
