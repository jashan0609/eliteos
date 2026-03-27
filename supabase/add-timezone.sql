alter table operator_profile add column if not exists timezone text not null default 'UTC';
