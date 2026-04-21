create extension if not exists pgcrypto;

create table if not exists public.estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null unique references public.produtos(id) on delete cascade,
  quantidade_atual numeric(14, 3) not null default 0,
  alerta_minimo numeric(14, 3) not null default 0,
  observacao text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
