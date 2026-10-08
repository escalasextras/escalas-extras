-- Gestor: configura a casa inteira (mesmo alcance do DP), vinculado pelo Admin a uma ou mais casas.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','dp','manager','leader'));

create or replace function public.is_dp(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin','dp','manager') and public.in_house(h)
$$;
create policy people_delete on public.people for delete using (public.is_dp(house_id));
