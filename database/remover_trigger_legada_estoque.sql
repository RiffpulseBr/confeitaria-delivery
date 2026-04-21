drop trigger if exists trigger_baixa_estoque on public.pedidos;
drop function if exists public.baixar_estoque_pedido_concluido() cascade;

-- Garante que apenas a trigger nova de receitas/insumos permaneça ativa.
drop trigger if exists trg_baixar_estoque_por_receita on public.pedidos;

create trigger trg_baixar_estoque_por_receita
after update of status on public.pedidos
for each row
when (new.status = 'concluido')
execute function public.fn_baixar_estoque_por_receita();
