-- Presença pode ser confirmada mesmo com a vaga ainda pendente de aprovação
create or replace function public.mark_attendance(
  p_id uuid, p_present boolean,
  p_suspend boolean default false, p_days int default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare e public.extra_requests;
begin
  select * into e from public.extra_requests where id = p_id;
  if e.id is null or not public.can_sector(e.house_id, e.sector_id) then raise exception 'Sem permissão'; end if;
  if e.status not in ('pending','approved') then raise exception 'Vaga recusada ou cancelada não tem presença'; end if;
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
