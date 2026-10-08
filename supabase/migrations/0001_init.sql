-- Escalas e Extras — esquema inicial (fases 1 a 3)
-- Cada casa é isolada: todo registro carrega house_id e as políticas (RLS) filtram por ele.


-- ============ TABELAS ============
create table public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  role text not null check (role in ('admin','dp','leader')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.house_members (
  user_id uuid not null references public.profiles(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  primary key (user_id, house_id)
);

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (house_id, name)
);

create table public.leader_sectors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  primary key (user_id, sector_id)
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (house_id, name)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  active boolean not null default true
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sector_id uuid not null references public.sectors(id),
  position_id uuid references public.positions(id),
  name text not null,
  cpf text,
  phone text,
  pix text,
  kind text not null default 'employee' check (kind in ('employee','freelancer','candidate')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.people (house_id, sector_id);

create table public.person_enablements (
  person_id uuid not null references public.people(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  enabled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (person_id, position_id)
);

create table public.suspensions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,                       -- null = indeterminado
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  week_start date not null,           -- segunda-feira
  status text not null default 'draft' check (status in ('draft','sent')),
  sent_at timestamptz,
  unique (sector_id, week_start)
);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  day date not null,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  unique (schedule_id, person_id, day, shift_id)
);

create table public.extra_reasons (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  needs_absent_person boolean not null default false,
  needs_note boolean not null default false,
  is_test boolean not null default false,
  active boolean not null default true,
  unique (house_id, name)
);

create table public.pay_rates (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  valid_from date not null default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.extra_requests (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sector_id uuid not null references public.sectors(id),
  shift_id uuid not null references public.shifts(id),
  position_id uuid not null references public.positions(id),
  work_date date not null,
  amount numeric(10,2) not null,
  reason_id uuid not null references public.extra_reasons(id),
  note text,
  absent_person_id uuid references public.people(id),
  person_id uuid not null references public.people(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  attendance text check (attendance in ('present','absent')),
  attendance_by uuid references public.profiles(id),
  attendance_at timestamptz
);
create index on public.extra_requests (house_id, work_date);
create index on public.extra_requests (house_id, status);

create table public.audit_log (
  id bigint generated always as identity primary key,
  house_id uuid,
  table_name text not null,
  row_id uuid,
  action text not null,
  actor uuid,
  data jsonb,
  at timestamptz not null default now()
);

-- ============ FUNÇÕES DE ACESSO ============
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.in_house(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
      or exists (select 1 from public.house_members m
                 where m.user_id = auth.uid() and m.house_id = h and public.my_role() is not null)
$$;

create or replace function public.is_dp(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin','dp') and public.in_house(h)
$$;

create or replace function public.leads_sector(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'leader'
     and exists (select 1 from public.leader_sectors ls where ls.user_id = auth.uid() and ls.sector_id = s)
$$;

create or replace function public.can_sector(h uuid, s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_dp(h) or (public.in_house(h) and public.leads_sector(s))
$$;

create or replace function public.shares_house(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.house_members a join public.house_members b on a.house_id = b.house_id
                 where a.user_id = auth.uid() and b.user_id = u)
$$;

-- valor mais específico: cargo + setor + turno > cargo + setor > cargo + turno > cargo
create or replace function public.resolve_rate(h uuid, pos uuid, sec uuid, shf uuid, d date) returns numeric
language sql stable security definer set search_path = public as $$
  select amount from public.pay_rates
  where house_id = h and position_id = pos
    and (sector_id is null or sector_id = sec)
    and (shift_id is null or shift_id = shf)
    and valid_from <= d
  order by ((sector_id is not null)::int * 2 + (shift_id is not null)::int) desc, valid_from desc, created_at desc
  limit 1
$$;

create or replace function public.is_suspended(p uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.suspensions s
                 where s.person_id = p and s.lifted_at is null
                   and s.starts_on <= d and (s.ends_on is null or s.ends_on >= d))
$$;

-- ============ TRAVAS DA VAGA DE EXTRA ============
create or replace function public.extra_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  per public.people; rsn public.extra_reasons; shf public.shifts; rate numeric;
begin
  select * into per from public.people where id = new.person_id;
  if per.id is null or per.house_id <> new.house_id or not per.active then
    raise exception 'Pessoa inválida para esta casa';
  end if;
  select * into shf from public.shifts where id = new.shift_id;
  if shf.id is null or shf.house_id <> new.house_id or shf.sector_id <> new.sector_id then
    raise exception 'Turno não pertence ao setor';
  end if;
  select * into rsn from public.extra_reasons where id = new.reason_id and house_id = new.house_id and active;
  if rsn.id is null then raise exception 'Motivo inválido'; end if;
  if rsn.needs_absent_person and new.absent_person_id is null then
    raise exception 'Informe quem faltou';
  end if;
  if (rsn.needs_note or rsn.name = 'Outro') and coalesce(btrim(new.note), '') = '' then
    raise exception 'Escreva uma observação para este motivo';
  end if;
  if per.kind in ('employee','freelancer') and not rsn.is_test then
    if per.position_id is distinct from new.position_id and not exists (
      select 1 from public.person_enablements e where e.person_id = per.id and e.position_id = new.position_id
    ) then
      raise exception 'Pessoa não habilitada para este cargo';
    end if;
  end if;
  if public.is_suspended(per.id, new.work_date) then
    raise exception 'Pessoa suspensa de extras nesta data';
  end if;
  rate := public.resolve_rate(new.house_id, new.position_id, new.sector_id, new.shift_id, new.work_date);
  if rate is null then raise exception 'Sem valor definido para este cargo'; end if;
  new.amount := rate;
  new.status := 'pending';
  new.requested_by := auth.uid();
  new.requested_at := now();
  new.decided_by := null; new.decided_at := null; new.decision_note := null;
  new.attendance := null; new.attendance_by := null; new.attendance_at := null;
  return new;
end $$;

create trigger extra_before_insert before insert on public.extra_requests
for each row execute function public.extra_before_insert();

-- ============ AUDITORIA ============
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; h uuid; rid uuid;
begin
  r := to_jsonb(coalesce(new, old));
  h := nullif(r->>'house_id','')::uuid;
  rid := nullif(r->>'id','')::uuid;
  insert into public.audit_log (house_id, table_name, row_id, action, actor, data)
  values (h, tg_table_name, rid, tg_op, auth.uid(), r);
  return coalesce(new, old);
end $$;

create trigger audit_pay_rates after insert or update or delete on public.pay_rates
for each row execute function public.audit_row();
create trigger audit_extras after insert or update on public.extra_requests
for each row execute function public.audit_row();
create trigger audit_suspensions after insert or update on public.suspensions
for each row execute function public.audit_row();

-- ============ AÇÕES (RPC) ============
-- DP aprova ou recusa
create or replace function public.decide_extra(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e public.extra_requests;
begin
  select * into e from public.extra_requests where id = p_id;
  if e.id is null or not public.is_dp(e.house_id) then raise exception 'Sem permissão'; end if;
  if e.status <> 'pending' then raise exception 'Esta vaga já foi decidida'; end if;
  if not p_approve and coalesce(btrim(p_note), '') = '' then raise exception 'Informe o motivo da recusa'; end if;
  update public.extra_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = p_id;
end $$;

-- Líder cancela vaga que ainda não foi decidida
create or replace function public.cancel_extra(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.extra_requests;
begin
  select * into e from public.extra_requests where id = p_id;
  if e.id is null or not public.can_sector(e.house_id, e.sector_id) then raise exception 'Sem permissão'; end if;
  if e.status <> 'pending' then raise exception 'Só vagas pendentes podem ser canceladas'; end if;
  update public.extra_requests set status = 'cancelled' where id = p_id;
end $$;

-- Líder confirma presença; se faltou pode suspender
create or replace function public.mark_attendance(
  p_id uuid, p_present boolean,
  p_suspend boolean default false, p_days int default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare e public.extra_requests;
begin
  select * into e from public.extra_requests where id = p_id;
  if e.id is null or not public.can_sector(e.house_id, e.sector_id) then raise exception 'Sem permissão'; end if;
  if e.status <> 'approved' then raise exception 'Só vagas aprovadas têm presença'; end if;
  if e.attendance is not null then raise exception 'Presença já registrada'; end if;
  if e.work_date > current_date then raise exception 'A data da vaga ainda não chegou'; end if;
  update public.extra_requests
     set attendance = case when p_present then 'present' else 'absent' end,
         attendance_by = auth.uid(), attendance_at = now()
   where id = p_id;
  if not p_present and p_suspend then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'Informe o motivo da suspensão'; end if;
    insert into public.suspensions (house_id, person_id, starts_on, ends_on, reason, created_by)
    values (e.house_id, e.person_id, current_date,
            case when p_days is null then null else current_date + p_days end,
            p_reason, auth.uid());
  end if;
end $$;

-- Cadastro padrão ao criar uma casa (motivos)
create or replace function public.seed_house() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.extra_reasons (house_id, name, needs_absent_person, needs_note, is_test) values
    (new.id, 'Cobrir falta', true, false, false),
    (new.id, 'Cobrir folga ou férias', false, false, false),
    (new.id, 'Cobrir atestado ou licença', false, false, false),
    (new.id, 'Aumento de movimento', false, false, false),
    (new.id, 'Vaga em aberto', false, false, false),
    (new.id, 'Teste', false, false, true),
    (new.id, 'Outro', false, true, false);
  return new;
end $$;

create trigger seed_house after insert on public.houses
for each row execute function public.seed_house();

-- ============ RLS ============
alter table public.houses enable row level security;
alter table public.profiles enable row level security;
alter table public.house_members enable row level security;
alter table public.sectors enable row level security;
alter table public.leader_sectors enable row level security;
alter table public.positions enable row level security;
alter table public.shifts enable row level security;
alter table public.people enable row level security;
alter table public.person_enablements enable row level security;
alter table public.suspensions enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.extra_reasons enable row level security;
alter table public.pay_rates enable row level security;
alter table public.extra_requests enable row level security;
alter table public.audit_log enable row level security;

-- casas
create policy houses_select on public.houses for select using (public.in_house(id));
create policy houses_admin on public.houses for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- perfis
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.my_role() = 'admin' or public.shares_house(id));
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_admin on public.profiles for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- acessos (somente Admin altera)
create policy hm_select on public.house_members for select using (user_id = auth.uid() or public.is_dp(house_id));
create policy hm_admin on public.house_members for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy ls_select on public.leader_sectors for select
  using (user_id = auth.uid() or exists (select 1 from public.sectors s where s.id = sector_id and public.is_dp(s.house_id)));
create policy ls_admin on public.leader_sectors for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- cadastros da casa: todos da casa leem, DP/Admin escrevem
create policy sectors_select on public.sectors for select using (public.in_house(house_id));
create policy sectors_write on public.sectors for all using (public.is_dp(house_id)) with check (public.is_dp(house_id));
create policy positions_select on public.positions for select using (public.in_house(house_id));
create policy positions_write on public.positions for all using (public.is_dp(house_id)) with check (public.is_dp(house_id));
create policy shifts_select on public.shifts for select using (public.in_house(house_id));
create policy shifts_write on public.shifts for all using (public.is_dp(house_id)) with check (public.is_dp(house_id));
create policy reasons_select on public.extra_reasons for select using (public.in_house(house_id));
create policy reasons_write on public.extra_reasons for all using (public.is_dp(house_id)) with check (public.is_dp(house_id));
create policy rates_select on public.pay_rates for select using (public.in_house(house_id));
create policy rates_write on public.pay_rates for all using (public.is_dp(house_id)) with check (public.is_dp(house_id));

-- pessoas: DP vê tudo da casa; Líder só os seus setores
create policy people_select on public.people for select using (public.can_sector(house_id, sector_id));
create policy people_insert on public.people for insert with check (public.can_sector(house_id, sector_id));
create policy people_update on public.people for update using (public.can_sector(house_id, sector_id)) with check (public.can_sector(house_id, sector_id));

create policy enable_all on public.person_enablements for all
  using (exists (select 1 from public.people p where p.id = person_id and public.can_sector(p.house_id, p.sector_id)))
  with check (exists (select 1 from public.people p where p.id = person_id and public.can_sector(p.house_id, p.sector_id)));

create policy susp_select on public.suspensions for select
  using (exists (select 1 from public.people p where p.id = person_id and public.can_sector(p.house_id, p.sector_id)));
create policy susp_insert on public.suspensions for insert
  with check (exists (select 1 from public.people p where p.id = person_id and p.house_id = suspensions.house_id and public.can_sector(p.house_id, p.sector_id)));
create policy susp_update on public.suspensions for update
  using (exists (select 1 from public.people p where p.id = person_id and public.can_sector(p.house_id, p.sector_id)));

-- escalas
create policy sched_select on public.schedules for select using (public.can_sector(house_id, sector_id));
create policy sched_write on public.schedules for all using (public.can_sector(house_id, sector_id)) with check (public.can_sector(house_id, sector_id));
create policy entries_select on public.schedule_entries for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_sector(s.house_id, s.sector_id)));
create policy entries_write on public.schedule_entries for all
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_sector(s.house_id, s.sector_id)))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and s.house_id = schedule_entries.house_id and public.can_sector(s.house_id, s.sector_id)));

-- extras: leitura e criação; mudanças só pelas funções acima
create policy extras_select on public.extra_requests for select using (public.can_sector(house_id, sector_id));
create policy extras_insert on public.extra_requests for insert with check (public.can_sector(house_id, sector_id));

create policy audit_select on public.audit_log for select using (house_id is not null and public.is_dp(house_id));

grant execute on function public.decide_extra(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_extra(uuid) to authenticated;
grant execute on function public.mark_attendance(uuid, boolean, boolean, int, text) to authenticated;
