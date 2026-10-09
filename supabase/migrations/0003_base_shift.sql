-- Turno base vinculado à pessoa + folgas explícitas por dia
alter table public.people add column if not exists base_shift_id uuid references public.shifts(id) on delete set null;

create table if not exists public.schedule_offs (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  day date not null,
  unique (schedule_id, person_id, day)
);
alter table public.schedule_offs enable row level security;
create policy offs_select on public.schedule_offs for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_sector(s.house_id, s.sector_id)));
create policy offs_write on public.schedule_offs for all
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_sector(s.house_id, s.sector_id)))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and s.house_id = schedule_offs.house_id and public.can_sector(s.house_id, s.sector_id)));
