create extension if not exists pgcrypto;

create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade_medida text not null,
  quantidade_atual numeric(14, 3) not null default 0,
  alerta_minimo numeric(14, 3) not null default 0,
  ativo boolean not null default true,
  legado_produto_id uuid unique references public.produtos(id) on delete set null,
  legado_estoque_id uuid unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  atualizado_em timestamptz not null default timezone('utc', now())
);

alter table if exists public.movimentacoes_estoque
  add column if not exists insumo_id uuid references public.insumos(id) on delete set null;

insert into public.insumos (
  nome,
  unidade_medida,
  quantidade_atual,
  alerta_minimo,
  ativo,
  legado_produto_id,
  legado_estoque_id,
  created_at,
  updated_at,
  atualizado_em
)
select
  coalesce(p.nome, 'Insumo migrado'),
  coalesce(e.unidade_medida, 'un'),
  coalesce(e.quantidade_atual, 0),
  coalesce(e.alerta_minimo, 0),
  true,
  e.produto_id,
  e.id,
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from public.estoque e
left join public.produtos p on p.id = e.produto_id
on conflict (legado_produto_id) do update
set
  nome = excluded.nome,
  unidade_medida = excluded.unidade_medida,
  quantidade_atual = excluded.quantidade_atual,
  alerta_minimo = excluded.alerta_minimo,
  updated_at = timezone('utc', now()),
  atualizado_em = timezone('utc', now());

update public.movimentacoes_estoque m
   set insumo_id = i.id
  from public.insumos i
 where m.insumo_id is null
   and (
     m.produto_id = i.legado_produto_id
     or m.estoque_id = i.legado_estoque_id
   );

do $$
begin
  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'receitas'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'receitas'
       and column_name = 'modo_preparo'
  ) then
    alter table public.receitas rename to receitas_legacy;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'receitas_detalhes'
  ) then
    alter table public.receitas_detalhes rename to receitas_detalhes_legacy;
  end if;
exception
  when duplicate_table then
    null;
end $$;

create table if not exists public.receitas (
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

create table if not exists public.receita_itens (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references public.receitas(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  quantidade_insumo numeric(14, 3) not null check (quantidade_insumo > 0),
  unidade_medida text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint receita_itens_unique unique (receita_id, insumo_id)
);

insert into public.receitas (
  produto_id,
  nome_receita,
  rendimento,
  unidade_rendimento,
  modo_preparo,
  observacoes,
  created_at,
  updated_at
)
select
  base.produto_id,
  coalesce(det.nome_receita, prod.nome),
  det.rendimento,
  det.unidade_rendimento,
  det.modo_preparo,
  det.observacoes,
  timezone('utc', now()),
  timezone('utc', now())
from (
  select distinct produto_id
    from public.receitas_legacy
) base
left join public.receitas_detalhes_legacy det on det.produto_id = base.produto_id
left join public.produtos prod on prod.id = base.produto_id
on conflict (produto_id) do update
set
  nome_receita = excluded.nome_receita,
  rendimento = excluded.rendimento,
  unidade_rendimento = excluded.unidade_rendimento,
  modo_preparo = excluded.modo_preparo,
  observacoes = excluded.observacoes,
  updated_at = timezone('utc', now());

insert into public.receita_itens (
  receita_id,
  insumo_id,
  quantidade_insumo,
  unidade_medida,
  created_at
)
select
  r.id,
  i.id,
  rl.quantidade_insumo,
  coalesce(rl.unidade_medida, i.unidade_medida),
  timezone('utc', now())
from public.receitas_legacy rl
join public.receitas r on r.produto_id = rl.produto_id
join public.insumos i on i.legado_produto_id = rl.insumo_id
on conflict (receita_id, insumo_id) do update
set
  quantidade_insumo = excluded.quantidade_insumo,
  unidade_medida = excluded.unidade_medida;

update public.produtos p
   set ativo = false
 where exists (
   select 1
     from public.insumos i
    where i.legado_produto_id = p.id
 );

create or replace function public.fn_baixar_estoque_por_receita()
returns trigger
language plpgsql
as $$
declare
  registro record;
begin
  if new.status <> 'concluido' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  for registro in
    select
      ip.pedido_id,
      ip.produto_id,
      ip.quantidade as quantidade_produto,
      ri.insumo_id,
      ri.quantidade_insumo
    from public.itens_pedido ip
    join public.receitas r on r.produto_id = ip.produto_id
    join public.receita_itens ri on ri.receita_id = r.id
    where ip.pedido_id = new.id
  loop
    update public.insumos
       set quantidade_atual = quantidade_atual - (registro.quantidade_produto * registro.quantidade_insumo),
           updated_at = timezone('utc', now()),
           atualizado_em = timezone('utc', now())
     where id = registro.insumo_id;

    insert into public.movimentacoes_estoque (
      insumo_id,
      pedido_id,
      tipo_movimentacao,
      quantidade,
      observacao,
      origem,
      created_at
    ) values (
      registro.insumo_id,
      new.id,
      'baixa_receita',
      (registro.quantidade_produto * registro.quantidade_insumo),
      'Baixa automatica por conclusao do pedido',
      coalesce(new.canal_externo, 'sistema'),
      timezone('utc', now())
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_baixar_estoque_por_receita on public.pedidos;

create trigger trg_baixar_estoque_por_receita
after update of status on public.pedidos
for each row
when (new.status = 'concluido')
execute function public.fn_baixar_estoque_por_receita();
