-- Estrutura usada pelo apostas no projeto Supabase "oficina" (já aplicada em 09/11/2026).
-- Tudo com prefixo bq_ para não misturar com as tabelas da oficina.
-- O conteúdo (gabarito e imagens) NÃO fica no repositório: está no banco e no bucket privado.

create table public.bq_acesso (
  email text primary key check (email = lower(email)),
  criado_em timestamptz not null default now()
);
alter table public.bq_acesso enable row level security; -- sem policies: só o dono gerencia

create or replace function public.bq_tem_acesso()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bq_acesso a
                 where a.email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
$$;
revoke all on function public.bq_tem_acesso() from public, anon;
grant execute on function public.bq_tem_acesso() to authenticated;

create table public.bq_questoes (
  n int primary key check (n between 1 and 999),
  area text not null,
  topico text not null,
  gabarito char(1) not null check (gabarito in ('A','B','C','D','E')),
  nota text
);
alter table public.bq_questoes enable row level security;
create policy "bq_questoes leitura liberada" on public.bq_questoes
  for select to authenticated using ((select public.bq_tem_acesso()));

create table public.bq_respostas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  n int not null references public.bq_questoes(n) on delete cascade,
  resposta char(1) not null check (resposta in ('A','B','C','D','E')),
  respondido_em timestamptz not null default now(),
  primary key (user_id, n)
);
alter table public.bq_respostas enable row level security;
create policy "bq_respostas proprias select" on public.bq_respostas for select to authenticated using (user_id = (select auth.uid()));
create policy "bq_respostas proprias insert" on public.bq_respostas for insert to authenticated with check (user_id = (select auth.uid()) and (select public.bq_tem_acesso()));
create policy "bq_respostas proprias update" on public.bq_respostas for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.bq_tem_acesso()));
create policy "bq_respostas proprias delete" on public.bq_respostas for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banco-questoes', 'banco-questoes', false, 2097152, array['image/webp']) on conflict (id) do nothing;
create policy "bq imagens leitura liberada" on storage.objects for select to authenticated
  using (bucket_id = 'banco-questoes' and (select public.bq_tem_acesso()));

-- Liberar um amigo:
--   insert into public.bq_acesso(email) values ('amigo@exemplo.com');
