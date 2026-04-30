alter table operator_profile
  add column if not exists ghost_opt_in boolean not null default false;

alter table operator_profile
  add column if not exists ghost_opted_in_at timestamptz;
