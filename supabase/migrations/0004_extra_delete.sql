-- Excluir vaga de extra: Gestor/DP qualquer uma; Líder só as pendentes do seu setor
create policy extras_delete on public.extra_requests for delete
  using (public.is_dp(house_id) or (status = 'pending' and public.can_sector(house_id, sector_id)));
