-- Fase 1 - Modelo B: Baixa por Producao (Lote)
-- Objetivo:
-- 1. consolidar o schema para fluxo industrial/varejo
-- 2. baixar insumos apenas ao concluir ordens de producao
-- 3. baixar produtos prontos apenas ao concluir pedidos
-- 4. padronizar a trilha de auditoria em `movimentacoes_estoque`
--
-- Observacao importante:
-- Este script organiza o banco para o novo modelo, mas NAO retroprocessa
-- pedidos antigos concluidos nem ordens de producao passadas. Ajustes
-- historicos devem ser feitos via inventario / movimento manual depois.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- Limpeza de objetos legados
-- =========================================================

do $$
begin
  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'pedidos'
  ) then
    execute 'drop trigger if exists trigger_baixa_estoque on public.pedidos';
    execute 'drop trigger if exists trg_baixar_estoque_por_receita on public.pedidos';
    execute 'drop trigger if exists trg_baixar_estoque_produto_pedido on public.pedidos';
  end if;

  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'ordens_producao'
  ) then
    execute 'drop trigger if exists trg_touch_ordem_producao on public.ordens_producao';
    execute 'drop trigger if exists trg_concluir_ordem_producao on public.ordens_producao';
    execute 'drop trigger if exists trg_concluir_ordem_producao_insert on public.ordens_producao';
    execute 'drop trigger if exists trg_concluir_ordem_producao_update on public.ordens_producao';
  end if;
end $$;

drop function if exists public.baixar_estoque_pedido_concluido() cascade;
drop function if exists public.fn_baixar_estoque_por_receita() cascade;
drop function if exists public.fn_touch_ordem_producao() cascade;
drop function if exists public.fn_concluir_ordem_producao() cascade;
drop function if exists public.fn_baixar_estoque_produto_pedido() cascade;

drop table if exists public.receitas_legacy cascade;
drop table if exists public.receitas_detalhes_legacy cascade;
drop table if exists public.receitas_detalhes cascade;
drop table if exists public.estoque cascade;

-- =========================================================
-- Garantias de schema basico
-- =========================================================

create table if not exists public.estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  quantidade_atual numeric(14, 3) not null default 0,
  alerta_minimo numeric(14, 3) not null default 0,
  observacao text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists estoque_produtos_produto_id_unique_idx
  on public.estoque_produtos (produto_id);

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
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
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists receitas_produto_id_unique_idx
  on public.receitas (produto_id);

create unique index if not exists receita_itens_receita_insumo_unique_idx
  on public.receita_itens (receita_id, insumo_id);

-- =========================================================
-- Nova tabela de ordens de producao
-- =========================================================

create table if not exists public.ordens_producao (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade_produzida numeric(14, 3) not null check (quantidade_produzida > 0),
  status text not null default 'pendente',
  observacao text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  concluida_em timestamptz
);

alter table public.ordens_producao
  add column if not exists observacao text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists concluida_em timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'ordens_producao_status_check'
       and conrelid = 'public.ordens_producao'::regclass
  ) then
    alter table public.ordens_producao
      add constraint ordens_producao_status_check
      check (status in ('pendente', 'em_producao', 'concluida', 'cancelada'));
  end if;
end $$;

create index if not exists ordens_producao_status_created_at_idx
  on public.ordens_producao (status, created_at desc);

create index if not exists ordens_producao_produto_id_idx
  on public.ordens_producao (produto_id);

-- =========================================================
-- Padronizacao de movimentacoes_estoque
-- =========================================================

create table if not exists public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  tipo_movimentacao text not null,
  estoque_alvo text not null,
  insumo_id uuid references public.insumos(id) on delete set null,
  produto_id uuid references public.produtos(id) on delete set null,
  quantidade numeric(14, 3) not null,
  origem_tipo text not null,
  origem_id uuid,
  custo_unitario numeric(14, 2),
  documento text,
  observacao text,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'tipo'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'tipo_movimentacao'
  ) then
    alter table public.movimentacoes_estoque rename column tipo to tipo_movimentacao;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'registrado_em'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'created_at'
  ) then
    alter table public.movimentacoes_estoque rename column registrado_em to created_at;
  end if;
end $$;

alter table public.movimentacoes_estoque
  add column if not exists estoque_alvo text,
  add column if not exists produto_id uuid references public.produtos(id) on delete set null,
  add column if not exists origem_tipo text,
  add column if not exists origem_id uuid,
  add column if not exists custo_unitario numeric(14, 2),
  add column if not exists documento text,
  add column if not exists observacao text,
  add column if not exists created_at timestamptz;

update public.movimentacoes_estoque
   set created_at = timezone('utc', now())
 where created_at is null;

alter table public.movimentacoes_estoque
  alter column created_at set default timezone('utc', now());

update public.movimentacoes_estoque
   set tipo_movimentacao = case
     when tipo_movimentacao is null then 'migracao_manual'
     when tipo_movimentacao = 'entrada' then 'entrada_manual'
     when tipo_movimentacao = 'saida' then 'saida_manual'
     else tipo_movimentacao
   end
 where tipo_movimentacao is null
    or tipo_movimentacao in ('entrada', 'saida');

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'pedido_id'
  ) then
    execute '
      update public.movimentacoes_estoque
         set origem_tipo = coalesce(origem_tipo, ''pedido''),
             origem_id = coalesce(origem_id, pedido_id)
       where pedido_id is not null
    ';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'ordem_producao_id'
  ) then
    execute '
      update public.movimentacoes_estoque
         set origem_tipo = coalesce(origem_tipo, ''ordem_producao''),
             origem_id = coalesce(origem_id, ordem_producao_id)
       where ordem_producao_id is not null
    ';
  end if;
end $$;

update public.movimentacoes_estoque
   set estoque_alvo = case
     when estoque_alvo is not null then estoque_alvo
     when insumo_id is not null then 'insumo'
     when produto_id is not null then 'produto_pronto'
     else 'insumo'
   end
 where estoque_alvo is null;

update public.movimentacoes_estoque
   set origem_tipo = coalesce(origem_tipo, 'migracao'),
       observacao = case
         when observacao is not null then observacao
         when origem_tipo is null then 'Registro migrado para o modelo B'
         else observacao
       end
 where origem_tipo is null
    or observacao is null;

alter table public.movimentacoes_estoque
  alter column tipo_movimentacao set not null,
  alter column quantidade set not null,
  alter column estoque_alvo set not null,
  alter column origem_tipo set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'movimentacoes_estoque_estoque_alvo_check'
       and conrelid = 'public.movimentacoes_estoque'::regclass
  ) then
    alter table public.movimentacoes_estoque
      add constraint movimentacoes_estoque_estoque_alvo_check
      check (estoque_alvo in ('insumo', 'produto_pronto'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'movimentacoes_estoque_origem_tipo_check'
       and conrelid = 'public.movimentacoes_estoque'::regclass
  ) then
    alter table public.movimentacoes_estoque
      add constraint movimentacoes_estoque_origem_tipo_check
      check (origem_tipo in ('ordem_producao', 'pedido', 'entrada_mercadoria', 'ajuste_manual', 'migracao'));
  end if;
end $$;

alter table public.movimentacoes_estoque
  drop column if exists tipo,
  drop column if exists registrado_em,
  drop column if exists pedido_id,
  drop column if exists ordem_producao_id,
  drop column if exists estoque_id,
  drop column if exists origem;

create index if not exists movimentacoes_estoque_created_at_idx
  on public.movimentacoes_estoque (created_at desc);

create index if not exists movimentacoes_estoque_origem_idx
  on public.movimentacoes_estoque (origem_tipo, origem_id, created_at desc);

create index if not exists movimentacoes_estoque_insumo_idx
  on public.movimentacoes_estoque (insumo_id, created_at desc);

create index if not exists movimentacoes_estoque_produto_idx
  on public.movimentacoes_estoque (produto_id, created_at desc);

-- =========================================================
-- Funcoes auxiliares
-- =========================================================

create or replace function public.fn_touch_ordem_producao()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  if new.status = 'concluida' and coalesce(old.status, '') <> 'concluida' and new.concluida_em is null then
    new.concluida_em := timezone('utc', now());
  end if;
  return new;
end;
$$;

create or replace function public.fn_concluir_ordem_producao()
returns trigger
language plpgsql
as $$
declare
  receita_encontrada uuid;
  rendimento_receita numeric(14, 3);
  unidade_receita text;
  quantidade_final numeric(14, 3);
  total_ingredientes integer;
  registro record;
begin
  if new.status <> 'concluida' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'concluida' then
    return new;
  end if;

  select
      r.id,
      coalesce(nullif(r.rendimento, 0), 1),
      coalesce(r.unidade_rendimento, 'un')
    into receita_encontrada, rendimento_receita, unidade_receita
    from public.receitas r
   where r.produto_id = new.produto_id
   limit 1;

  if receita_encontrada is null then
    raise exception 'O produto % nao possui receita cadastrada para producao.', new.produto_id;
  end if;

  quantidade_final := new.quantidade_produzida * rendimento_receita;

  select count(*)
    into total_ingredientes
    from public.receita_itens ri
   where ri.receita_id = receita_encontrada;

  if total_ingredientes = 0 then
    raise exception 'A receita do produto % nao possui ingredientes cadastrados.', new.produto_id;
  end if;

  for registro in
    select
      ri.insumo_id,
      i.nome as insumo_nome,
      coalesce(i.quantidade_atual, 0) as saldo_atual,
      (new.quantidade_produzida * ri.quantidade_insumo) as quantidade_necessaria
    from public.receita_itens ri
    join public.insumos i on i.id = ri.insumo_id
    where ri.receita_id = receita_encontrada
  loop
    if registro.saldo_atual < registro.quantidade_necessaria then
      raise exception 'Saldo insuficiente do insumo % para concluir a ordem de producao.', registro.insumo_nome;
    end if;
  end loop;

  for registro in
    select
      ri.insumo_id,
      (new.quantidade_produzida * ri.quantidade_insumo) as quantidade_necessaria
    from public.receita_itens ri
    where ri.receita_id = receita_encontrada
  loop
    update public.insumos
       set quantidade_atual = quantidade_atual - registro.quantidade_necessaria,
           updated_at = timezone('utc', now()),
           atualizado_em = timezone('utc', now())
     where id = registro.insumo_id;

    insert into public.movimentacoes_estoque (
      tipo_movimentacao,
      estoque_alvo,
      insumo_id,
      quantidade,
      origem_tipo,
      origem_id,
      observacao,
      created_at
    ) values (
      'saida_producao',
      'insumo',
      registro.insumo_id,
      registro.quantidade_necessaria,
      'ordem_producao',
      new.id,
      'Baixa automatica de insumos por conclusao da ordem de producao',
      timezone('utc', now())
    );
  end loop;

  insert into public.estoque_produtos (
    produto_id,
    quantidade_atual,
    alerta_minimo,
    observacao,
    created_at,
    updated_at
  ) values (
    new.produto_id,
    quantidade_final,
    0,
    'Saldo iniciado automaticamente por conclusao de ordem de producao',
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (produto_id) do update
  set
    quantidade_atual = public.estoque_produtos.quantidade_atual + excluded.quantidade_atual,
    updated_at = timezone('utc', now());

  insert into public.movimentacoes_estoque (
    tipo_movimentacao,
    estoque_alvo,
    produto_id,
    quantidade,
    origem_tipo,
    origem_id,
    observacao,
    created_at
  ) values (
    'entrada_producao',
    'produto_pronto',
    new.produto_id,
    quantidade_final,
    'ordem_producao',
    new.id,
    'Entrada automatica de produto pronto por conclusao da ordem de producao',
    timezone('utc', now())
  );

  return new;
end;
$$;

create or replace function public.fn_baixar_estoque_produto_pedido()
returns trigger
language plpgsql
as $$
declare
  registro record;
begin
  if new.status <> 'concluido' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'concluido' then
    return new;
  end if;

  for registro in
    select
      ip.produto_id,
      p.nome as produto_nome,
      sum(ip.quantidade)::numeric as quantidade_pedida,
      ep.id as estoque_produto_id,
      coalesce(ep.quantidade_atual, 0) as saldo_atual
    from public.itens_pedido ip
    join public.produtos p on p.id = ip.produto_id
    left join public.estoque_produtos ep on ep.produto_id = ip.produto_id
    where ip.pedido_id = new.id
    group by ip.produto_id, p.nome, ep.id, ep.quantidade_atual
  loop
    if registro.estoque_produto_id is null then
      raise exception 'O produto % nao possui registro em estoque_produtos.', registro.produto_nome;
    end if;

    if registro.saldo_atual < registro.quantidade_pedida then
      raise exception 'Saldo insuficiente de produto pronto para %.', registro.produto_nome;
    end if;
  end loop;

  for registro in
    select
      ip.produto_id,
      sum(ip.quantidade)::numeric as quantidade_pedida,
      ep.id as estoque_produto_id
    from public.itens_pedido ip
    join public.estoque_produtos ep on ep.produto_id = ip.produto_id
    where ip.pedido_id = new.id
    group by ip.produto_id, ep.id
  loop
    update public.estoque_produtos
       set quantidade_atual = quantidade_atual - registro.quantidade_pedida,
           updated_at = timezone('utc', now())
     where id = registro.estoque_produto_id;

    insert into public.movimentacoes_estoque (
      tipo_movimentacao,
      estoque_alvo,
      produto_id,
      quantidade,
      origem_tipo,
      origem_id,
      observacao,
      created_at
    ) values (
      'saida_venda',
      'produto_pronto',
      registro.produto_id,
      registro.quantidade_pedida,
      'pedido',
      new.id,
      'Baixa automatica de produto pronto por conclusao do pedido',
      timezone('utc', now())
    );
  end loop;

  return new;
end;
$$;

-- =========================================================
-- Triggers definitivas do Modelo B
-- =========================================================

create trigger trg_touch_ordem_producao
before update on public.ordens_producao
for each row
execute function public.fn_touch_ordem_producao();

create trigger trg_concluir_ordem_producao_insert
after insert on public.ordens_producao
for each row
when (new.status = 'concluida')
execute function public.fn_concluir_ordem_producao();

create trigger trg_concluir_ordem_producao_update
after update of status on public.ordens_producao
for each row
when (new.status = 'concluida')
execute function public.fn_concluir_ordem_producao();

create trigger trg_baixar_estoque_produto_pedido
after update of status on public.pedidos
for each row
when (new.status = 'concluido')
execute function public.fn_baixar_estoque_produto_pedido();

commit;
