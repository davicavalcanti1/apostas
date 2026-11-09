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

-- ---------------------------------------------------------------------------
-- Código de convite (aplicado em 09/11/2026). O código em si NÃO fica aqui:
-- o banco guarda só o hash sha256. Para trocar o código:
--   update public.bq_convite set codigo_hash = encode(extensions.digest(upper('NOVO-CODIGO'), 'sha256'), 'hex'), atualizado_em = now();
-- Para desligar o convite:  update public.bq_convite set ativo = false;
create extension if not exists pgcrypto with schema extensions;
create table public.bq_convite (
  id int primary key default 1 check (id = 1),
  codigo_hash text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.bq_convite enable row level security; -- sem policies
create table public.bq_convite_erros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  erros int not null default 0,
  ultimo timestamptz not null default now()
);
alter table public.bq_convite_erros enable row level security; -- sem policies

-- libera o e-mail de quem acerta o código; 8 erros bloqueiam a conta
create or replace function public.bq_resgatar_convite(codigo text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  mail text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  n_erros int;
begin
  if uid is null or mail = '' then return 'sem_login'; end if;
  if exists (select 1 from public.bq_acesso where email = mail) then return 'ok'; end if;
  select erros into n_erros from public.bq_convite_erros where user_id = uid;
  if coalesce(n_erros, 0) >= 8 then return 'bloqueado'; end if;
  if exists (select 1 from public.bq_convite where ativo
             and codigo_hash = encode(extensions.digest(upper(trim(coalesce(codigo, ''))), 'sha256'), 'hex')) then
    insert into public.bq_acesso(email) values (mail) on conflict do nothing;
    delete from public.bq_convite_erros where user_id = uid;
    return 'ok';
  end if;
  insert into public.bq_convite_erros(user_id, erros) values (uid, 1)
  on conflict (user_id) do update set erros = public.bq_convite_erros.erros + 1, ultimo = now();
  return 'invalido';
end; $$;
revoke all on function public.bq_resgatar_convite(text) from public, anon;
grant execute on function public.bq_resgatar_convite(text) to authenticated;
