create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  partner_name text not null,
  offer_title text,
  offer_description text
);

alter table batches
  add column if not exists domain_id uuid references domains(id);
