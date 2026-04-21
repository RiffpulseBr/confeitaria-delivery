create or replace function public.fn_baixar_estoque_por_receita()
returns trigger
language plpgsql
as $$
declare
  registro record;
  has_updated_at_insumos boolean;
  has_atualizado_em_insumos boolean;
  has_insumo_id boolean;
  has_pedido_id boolean;
  has_tipo_movimentacao boolean;
  has_tipo boolean;
  has_quantidade boolean;
  has_observacao boolean;
  has_origem boolean;
  has_created_at boolean;
  has_registrado_em boolean;
  insert_cols text[];
  insert_vals text[];
  insert_sql text;
begin
  if new.status <> 'concluido' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'insumos'
       and column_name = 'updated_at'
  ) into has_updated_at_insumos;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'insumos'
       and column_name = 'atualizado_em'
  ) into has_atualizado_em_insumos;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'insumo_id'
  ) into has_insumo_id;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'pedido_id'
  ) into has_pedido_id;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'tipo_movimentacao'
  ) into has_tipo_movimentacao;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'tipo'
  ) into has_tipo;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'quantidade'
  ) into has_quantidade;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'observacao'
  ) into has_observacao;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'origem'
  ) into has_origem;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'created_at'
  ) into has_created_at;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'movimentacoes_estoque'
       and column_name = 'registrado_em'
  ) into has_registrado_em;

  for registro in
    select
      ip.produto_id,
      ip.quantidade as quantidade_produto,
      ri.insumo_id,
      ri.quantidade_insumo
    from public.itens_pedido ip
    join public.receitas r on r.produto_id = ip.produto_id
    join public.receita_itens ri on ri.receita_id = r.id
    where ip.pedido_id = new.id
  loop
    insert_sql := 'update public.insumos set quantidade_atual = quantidade_atual - ' || (registro.quantidade_produto * registro.quantidade_insumo)::text;
    if has_updated_at_insumos then
      insert_sql := insert_sql || ', updated_at = timezone(''utc'', now())';
    end if;
    if has_atualizado_em_insumos then
      insert_sql := insert_sql || ', atualizado_em = timezone(''utc'', now())';
    end if;
    insert_sql := insert_sql || ' where id = ' || format('%L', registro.insumo_id);
    execute insert_sql;

    insert_cols := array[]::text[];
    insert_vals := array[]::text[];

    if has_insumo_id then
      insert_cols := array_append(insert_cols, 'insumo_id');
      insert_vals := array_append(insert_vals, format('%L', registro.insumo_id));
    end if;

    if has_pedido_id then
      insert_cols := array_append(insert_cols, 'pedido_id');
      insert_vals := array_append(insert_vals, format('%L', new.id));
    end if;

    if has_tipo_movimentacao then
      insert_cols := array_append(insert_cols, 'tipo_movimentacao');
      insert_vals := array_append(insert_vals, quote_literal('baixa_receita'));
    elsif has_tipo then
      insert_cols := array_append(insert_cols, 'tipo');
      insert_vals := array_append(insert_vals, quote_literal('saida'));
    end if;

    if has_quantidade then
      insert_cols := array_append(insert_cols, 'quantidade');
      insert_vals := array_append(insert_vals, (registro.quantidade_produto * registro.quantidade_insumo)::text);
    end if;

    if has_observacao then
      insert_cols := array_append(insert_cols, 'observacao');
      insert_vals := array_append(insert_vals, quote_literal('Baixa automatica por conclusao do pedido'));
    end if;

    if has_origem then
      insert_cols := array_append(insert_cols, 'origem');
      insert_vals := array_append(insert_vals, format('%L', coalesce(new.canal_externo, 'sistema')));
    end if;

    if has_created_at then
      insert_cols := array_append(insert_cols, 'created_at');
      insert_vals := array_append(insert_vals, 'timezone(''utc'', now())');
    elsif has_registrado_em then
      insert_cols := array_append(insert_cols, 'registrado_em');
      insert_vals := array_append(insert_vals, 'timezone(''utc'', now())');
    end if;

    if array_length(insert_cols, 1) > 0 then
      insert_sql := 'insert into public.movimentacoes_estoque (' || array_to_string(insert_cols, ', ') || ') values (' || array_to_string(insert_vals, ', ') || ')';
      execute insert_sql;
    end if;
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
