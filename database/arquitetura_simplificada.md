# Proposta de arquitetura simplificada

## Objetivo

Reduzir redundancia no banco e separar melhor o que e:

- catalogo de venda
- estoque de insumos
- pedidos
- integracao iFood

## Estrutura sugerida

### 1. `produtos`

Usar para itens vendidos ao cliente.

Campos principais:

- `id`
- `nome`
- `preco`
- `ativo`
- `created_at`
- `updated_at`

### 2. `insumos`

Criar uma tabela especifica para o estoque produtivo, em vez de misturar insumo dentro de `produtos`.

Campos principais:

- `id`
- `nome`
- `unidade_medida`
- `quantidade_atual`
- `alerta_minimo`
- `ativo`
- `created_at`
- `updated_at`

### 3. `receitas`

Manter como cabecalho da ficha tecnica.

Campos principais:

- `id`
- `produto_id`
- `nome_receita`
- `rendimento`
- `unidade_rendimento`
- `modo_preparo`
- `observacoes`
- `created_at`
- `updated_at`

### 4. `receita_itens`

Separar os ingredientes em uma tabela filha.

Campos principais:

- `id`
- `receita_id`
- `insumo_id`
- `quantidade_insumo`
- `unidade_medida`

### 5. `pedidos`

Manter como cabecalho operacional.

### 6. `itens_pedido`

Manter como itens operacionais.

### 7. `movimentacoes_estoque`

Manter como historico de entradas e baixas.

Campos importantes:

- `insumo_id`
- `pedido_id`
- `tipo_movimentacao`
- `quantidade`
- `custo_unitario`
- `documento`
- `origem`
- `created_at`

### 8. Integracao iFood

Manter estas tabelas:

- `ifood_item_mappings`
- `ifood_orders`
- `ifood_event_logs`

Elas fazem sentido porque sao integracao externa, nao regra de negocio principal.

## Diagnostico do modelo atual

Hoje a principal fonte de complexidade nao e o numero total de tabelas do iFood. Isso esta aceitavel.

O que realmente pesa e:

- `estoque` representa insumo, mas referencia `produtos`
- `receitas` mistura cabecalho e itens de receita
- `receitas_detalhes` virou uma tabela auxiliar para completar algo que idealmente seria o cabecalho da receita

## Caminho de migracao recomendado

1. Criar `insumos` e `receita_itens`
2. Migrar dados de `estoque` para `insumos`
3. Migrar `receitas_detalhes` para virar o novo cabecalho `receitas`
4. Migrar a tabela `receitas` atual para `receita_itens`
5. Ajustar trigger de baixa para usar `receita_itens`
6. Remover gradualmente a dependencia de `produtos` para insumos

## Beneficio esperado

- menos ambiguidade entre item de venda e item de producao
- CRUD de receitas mais limpo
- estoque mais intuitivo
- menor chance de bug por colunas opcionais ou remendos de modelagem
