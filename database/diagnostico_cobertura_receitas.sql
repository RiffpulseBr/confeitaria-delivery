select
  p.id as produto_id,
  p.nome as produto_nome,
  p.preco,
  p.ativo,
  r.id as receita_id,
  count(ri.id) as total_ingredientes,
  case
    when r.id is null then 'SEM_CABECALHO'
    when count(ri.id) = 0 then 'SEM_INGREDIENTES'
    else 'OK'
  end as status_receita
from public.produtos p
left join public.receitas r on r.produto_id = p.id
left join public.receita_itens ri on ri.receita_id = r.id
group by p.id, p.nome, p.preco, p.ativo, r.id
order by p.nome;
