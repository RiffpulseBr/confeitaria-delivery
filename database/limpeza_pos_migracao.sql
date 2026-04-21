-- Rode este script somente depois de validar que:
-- 1. o balcao lista apenas produtos de venda
-- 2. os insumos aparecem em `insumos`
-- 3. as receitas novas estao em `receitas` + `receita_itens`
-- 4. a baixa de estoque esta funcionando com `insumo_id`

begin;

-- Limpa tabelas legadas criadas durante a migracao.

drop table if exists public.receitas_legacy cascade;
drop table if exists public.receitas_detalhes_legacy cascade;
drop table if exists public.receitas_detalhes cascade;
drop table if exists public.estoque cascade;

-- Remove colunas de compatibilidade que nao sao mais necessarias.
alter table if exists public.movimentacoes_estoque
  drop column if exists estoque_id,
  drop column if exists produto_id;

alter table if exists public.insumos
  drop column if exists legado_produto_id,
  drop column if exists legado_estoque_id;

commit;
