-- Use este script como modelo quando um produto ja existe em `produtos`,
-- mas ainda nao tem ficha tecnica em `receitas` + `receita_itens`.
--
-- Passos:
-- 1. troque os UUIDs abaixo pelos IDs reais do seu banco
-- 2. ajuste as quantidades conforme a receita real
-- 3. rode o script inteiro no SQL Editor

begin;

with receita_criada as (
  insert into public.receitas (
    produto_id,
    nome_receita,
    rendimento,
    unidade_rendimento,
    modo_preparo,
    observacoes
  )
  values (
    '00000000-0000-0000-0000-000000000001', -- produto_id
    'Brigadeiro Gourmet',
    1,
    'un',
    'Descreva aqui o modo de preparo real.',
    'Ficha tecnica criada manualmente para restaurar a baixa de estoque.'
  )
  on conflict (produto_id) do update
  set
    nome_receita = excluded.nome_receita,
    rendimento = excluded.rendimento,
    unidade_rendimento = excluded.unidade_rendimento,
    modo_preparo = excluded.modo_preparo,
    observacoes = excluded.observacoes,
    updated_at = timezone('utc', now())
  returning id
)
insert into public.receita_itens (
  receita_id,
  insumo_id,
  quantidade_insumo,
  unidade_medida
)
select
  receita_criada.id,
  item.insumo_id,
  item.quantidade_insumo,
  item.unidade_medida
from receita_criada
cross join (
  values
    ('00000000-0000-0000-0000-000000000002'::uuid, 395.000::numeric, 'g'::text),
    ('00000000-0000-0000-0000-000000000003'::uuid, 25.000::numeric, 'g'::text)
) as item(insumo_id, quantidade_insumo, unidade_medida)
on conflict (receita_id, insumo_id) do update
set
  quantidade_insumo = excluded.quantidade_insumo,
  unidade_medida = excluded.unidade_medida;

commit;
