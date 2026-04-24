-- Corrige o Modelo B para tratar `quantidade_produzida` como quantidade de receitas/lotes.
-- Exemplo: receita rende 10 un; ordem com quantidade_produzida = 1 consome os insumos uma vez
-- e adiciona 10 un ao estoque_produtos.

begin;

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

commit;
