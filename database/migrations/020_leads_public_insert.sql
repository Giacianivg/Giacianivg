-- 020: Páginas públicas de captação de grupos (grupos.html / orcamento-grupo.html)
-- A tabela leads tem RLS ativo e nenhuma policy — o formulário público insere
-- direto do browser com a anon key, então precisa de uma policy de INSERT.
-- Restrita a lead_source = 'site-grupos' para não abrir escrita genérica ao anon.

create policy leads_public_site_insert
  on public.leads
  for insert
  to anon
  with check (lead_source = 'site-grupos');
