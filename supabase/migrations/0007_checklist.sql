-- Checklist operacional: itens por setor, avaliação por turno (1-5 estrelas) e pessoas impactadas
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.checklist_items (house_id, sector_id);

create table public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  day date not null,
  avg numeric(3,2) not null check (avg between 1 and 5),
  note text,
  rated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sector_id, day, shift_id)
);
create index on public.checklist_runs (house_id, day);

create table public.checklist_scores (
  run_id uuid not null references public.checklist_runs(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  primary key (run_id, item_id)
);

create table public.checklist_people (
  run_id uuid not null references public.checklist_runs(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  is_extra boolean not null default false,
  primary key (run_id, person_id)
);
create index on public.checklist_people (person_id);

alter table public.checklist_items enable row level security;
alter table public.checklist_runs enable row level security;
alter table public.checklist_scores enable row level security;
alter table public.checklist_people enable row level security;

create policy ck_items_select on public.checklist_items for select using (public.can_sector(house_id, sector_id));
create policy ck_items_write on public.checklist_items for all using (public.is_dp(house_id)) with check (public.is_dp(house_id));

create policy ck_runs_select on public.checklist_runs for select using (public.can_sector(house_id, sector_id));
create policy ck_runs_write on public.checklist_runs for all using (public.can_sector(house_id, sector_id)) with check (public.can_sector(house_id, sector_id));

create policy ck_scores_all on public.checklist_scores for all
  using (exists (select 1 from public.checklist_runs r where r.id = run_id and public.can_sector(r.house_id, r.sector_id)))
  with check (exists (select 1 from public.checklist_runs r where r.id = run_id and public.can_sector(r.house_id, r.sector_id)));
create policy ck_people_all on public.checklist_people for all
  using (exists (select 1 from public.checklist_runs r where r.id = run_id and public.can_sector(r.house_id, r.sector_id)))
  with check (exists (select 1 from public.checklist_runs r where r.id = run_id and public.can_sector(r.house_id, r.sector_id)));
