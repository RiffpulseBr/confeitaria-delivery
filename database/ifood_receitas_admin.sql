create extension if not exists pgcrypto;

alter table if exists public.pedidos
  add column if not exists pedido_externo_id text,
  add column if not exists merchant_id uuid,
  add column if not exists canal_externo text,
  add column if not exists referencia_externa text;

create table if not exists public.ifood_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  order_id text,
  merchant_id uuid,
  event_code text not null,
  event_full_code text not null,
  sales_channel text,
  payload jsonb not null,
  processing_status text not null default 'received',
  error_message text,
  received_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz
);

create table if not exists public.ifood_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  merchant_id uuid,
  display_id text,
  local_pedido_id uuid references public.pedidos(id) on delete set null,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ifood_item_mappings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  merchant_item_id text not null,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  observacao text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ifood_item_mappings_unique unique (merchant_id, merchant_item_id)
);

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  insumo_id uuid not null references public.produtos(id) on delete restrict,
  quantidade_insumo numeric(14, 3) not null check (quantidade_insumo > 0),
  unidade_medida text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint receitas_produto_insumo_unique unique (produto_id, insumo_id)
);

create table if not exists public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid references public.estoque(id) on delete set null,
  produto_id uuid references public.produtos(id) on delete set null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  tipo_movimentacao text not null,
  quantidade numeric(14, 3) not null,
  custo_unitario numeric(14, 2),
  documento text,
  observacao text,
  origem text,
  created_at timestamptz not null default timezone('utc', now())
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
      r.insumo_id,
      r.quantidade_insumo,
      e.id as estoque_id
    from public.itens_pedido ip
    join public.receitas r on r.produto_id = ip.produto_id
    left join public.estoque e on e.produto_id = r.insumo_id
    where ip.pedido_id = new.id
  loop
    if registro.estoque_id is null then
      raise exception 'Nao existe item de estoque para o insumo % vinculado ao produto %', registro.insumo_id, registro.produto_id;
    end if;

    update public.estoque
       set quantidade_atual = quantidade_atual - (registro.quantidade_produto * registro.quantidade_insumo)
     where id = registro.estoque_id;

    insert into public.movimentacoes_estoque (
      estoque_id,
      produto_id,
      pedido_id,
      tipo_movimentacao,
      quantidade,
      observacao,
      origem
    ) values (
      registro.estoque_id,
      registro.insumo_id,
      new.id,
      'baixa_receita',
      (registro.quantidade_produto * registro.quantidade_insumo),
      'Baixa automatica por conclusao do pedido',
      coalesce(new.canal_externo, 'sistema')
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
