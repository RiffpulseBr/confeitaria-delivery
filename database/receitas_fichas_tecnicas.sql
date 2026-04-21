create extension if not exists pgcrypto;

create table if not exists public.receitas_detalhes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null unique references public.produtos(id) on delete cascade,
  nome_receita text,
  rendimento numeric(14, 3),
  unidade_rendimento text,
  modo_preparo text,
  observacoes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.receitas
  add column if not exists updated_at timestamptz not null default timezone('utc', now());
