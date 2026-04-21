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
