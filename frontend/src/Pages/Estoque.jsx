import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Minus, PackageSearch, Pencil, Plus, RefreshCcw, Trash2, Warehouse } from 'lucide-react'

import { apiFetch, currency } from '../lib/api'

function toneByLevel(atual, alerta) {
  if (alerta > 0 && atual <= alerta / 2) {
    return {
      badge: 'bg-red-100 text-red-700',
      label: 'Critico',
    }
  }
  if (alerta > 0 && atual <= alerta) {
    return {
      badge: 'bg-amber-100 text-amber-700',
      label: 'Baixo',
    }
  }
  return {
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Ok',
  }
}

function solicitarQuantidade(rotulo, unidade = 'un') {
  const resposta = window.prompt(`Informe a quantidade para ${rotulo} (${unidade}).`, '1')
  if (resposta === null) return null

  const quantidade = Number(String(resposta).replace(',', '.'))
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    window.alert('Informe uma quantidade valida maior que zero.')
    return null
  }

  return quantidade
}

function solicitarTexto(rotulo, valorAtual = '') {
  const resposta = window.prompt(rotulo, valorAtual ?? '')
  if (resposta === null) return null
  return resposta.trim()
}

function solicitarNumero(rotulo, valorAtual = 0) {
  const resposta = window.prompt(rotulo, String(valorAtual ?? 0).replace('.', ','))
  if (resposta === null) return null

  const numero = Number(String(resposta).replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0) {
    window.alert('Informe um numero valido maior ou igual a zero.')
    return null
  }

  return numero
}

function Estoque() {
  const [insumos, setInsumos] = useState([])
  const [produtosProntos, setProdutosProntos] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionKey, setActionKey] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregarEstoque = async () => {
    setLoading(true)
    try {
      const [insumosData, produtosProntosData] = await Promise.all([
        apiFetch('/api/estoque/insumos'),
        apiFetch('/api/estoque/produtos'),
      ])

      setInsumos(Array.isArray(insumosData) ? insumosData : [])
      setProdutosProntos(Array.isArray(produtosProntosData) ? produtosProntosData : [])
      setMensagem('')
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarEstoque()
  }, [])

  const ajustarInsumo = async (item, operacao) => {
    const quantidade = solicitarQuantidade(
      operacao === 'entrada' ? `adicionar em ${item.nome}` : `retirar de ${item.nome}`,
      item.unidade_medida || 'un',
    )
    if (!quantidade) return

    setActionKey(`insumo:${item.id}:${operacao}`)
    setMensagem('')

    try {
      await apiFetch(`/api/estoque/insumos/${item.id}/ajustar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade, operacao }),
      })
      setMensagem(`Estoque de ${item.nome} atualizado com sucesso.`)
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setActionKey('')
    }
  }

  const editarInsumo = async (item) => {
    const nome = solicitarTexto('Nome do insumo', item.nome)
    if (nome === null) return
    const unidadeMedida = solicitarTexto('Unidade de medida', item.unidade_medida || 'un')
    if (unidadeMedida === null) return
    const alertaMinimo = solicitarNumero('Alerta minimo', item.alerta_minimo || 0)
    if (alertaMinimo === null) return

    setActionKey(`insumo:${item.id}:edit`)
    setMensagem('')

    try {
      await apiFetch(`/api/estoque/insumos/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          unidade_medida: unidadeMedida,
          alerta_minimo: alertaMinimo,
        }),
      })
      setMensagem(`${nome} atualizado com sucesso.`)
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setActionKey('')
    }
  }

  const excluirInsumo = async (item) => {
    const confirmado = window.confirm(`Remover ${item.nome} da area de estoque?`)
    if (!confirmado) return

    setActionKey(`insumo:${item.id}:delete`)
    setMensagem('')

    try {
      await apiFetch(`/api/estoque/insumos/${item.id}`, { method: 'DELETE' })
      setMensagem(`${item.nome} removido da area de estoque.`)
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setActionKey('')
    }
  }

  const ajustarProdutoPronto = async (item, operacao) => {
    const quantidade = solicitarQuantidade(
      operacao === 'entrada' ? `adicionar em ${item.produto_nome}` : `retirar de ${item.produto_nome}`,
      'un',
    )
    if (!quantidade) return

    setActionKey(`produto:${item.produto_id}:${operacao}`)
    setMensagem('')

    try {
      await apiFetch(`/api/estoque/produtos/${item.produto_id}/ajustar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade, operacao }),
      })
      setMensagem(`Estoque de ${item.produto_nome} atualizado com sucesso.`)
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setActionKey('')
    }
  }

  const editarProdutoPronto = async (item) => {
    const nome = solicitarTexto('Nome do produto', item.produto_nome)
    if (nome === null) return
    const preco = solicitarNumero('Preco de venda', item.preco_venda || 0)
    if (preco === null) return
    const alertaMinimo = solicitarNumero('Alerta minimo', item.alerta_minimo || 0)
    if (alertaMinimo === null) return

    setActionKey(`produto:${item.produto_id}:edit`)
    setMensagem('')

    try {
      await apiFetch(`/api/estoque/produtos/${item.produto_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          preco,
          alerta_minimo: alertaMinimo,
        }),
      })
      setMensagem(`${nome} atualizado com sucesso.`)
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setActionKey('')
    }
  }

  const excluirProdutoPronto = async (item) => {
    const confirmado = window.confirm(`Excluir ${item.produto_nome} do estoque de produtos prontos?`)
    if (!confirmado) return

    setActionKey(`produto:${item.produto_id}:delete`)
    setMensagem('')

    try {
      await apiFetch(`/api/estoque/produtos/${item.produto_id}`, { method: 'DELETE' })
      setMensagem(`${item.produto_nome} removido do estoque de produtos prontos.`)
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.28),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#fffbeb_45%,_#fefce8)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.1)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
                <Warehouse size={14} />
                Visao de estoque
              </p>
              <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Saldos atuais</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Consulte os saldos e use os atalhos para editar, adicionar, remover ou excluir itens.
              </p>
            </div>

            <button
              onClick={carregarEstoque}
              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-stone-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              <RefreshCcw size={18} />
              Atualizar
            </button>
          </div>
        </section>

        {mensagem && (
          <div className="mb-6 rounded-3xl border border-amber-100 bg-white/85 px-5 py-4 text-sm font-medium text-stone-700 shadow-sm">
            {mensagem}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <PackageSearch size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Estoque de insumos</h2>
                  <p className="text-sm text-stone-500">Materia-prima disponivel para producao e ajustes rapidos.</p>
                </div>
              </div>

              <div className="space-y-4">
                {insumos.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/70 px-6 py-10 text-center text-stone-500">
                    Nenhum insumo cadastrado.
                  </div>
                ) : (
                  insumos.map((item) => {
                    const atual = Number(item.quantidade_atual || 0)
                    const alerta = Number(item.alerta_minimo || 0)
                    const tone = toneByLevel(atual, alerta)

                    return (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_rgba(240,253,244,0.95),_rgba(255,255,255,0.98))] p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-serif text-2xl text-stone-900">{item.nome}</p>
                            <p className="mt-1 text-sm text-stone-500">
                              {atual.toLocaleString('pt-BR')} {item.unidade_medida || 'un'}
                            </p>
                            <p className="mt-1 text-sm text-stone-400">Custo recente: {currency(item.custo_medio || 0)}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${tone.badge}`}>
                            {tone.label}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => editarInsumo(item)}
                            disabled={actionKey === `insumo:${item.id}:edit`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `insumo:${item.id}:edit` ? <Loader2 className="animate-spin" size={18} /> : <Pencil size={18} />}
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => ajustarInsumo(item, 'entrada')}
                            disabled={actionKey === `insumo:${item.id}:entrada`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `insumo:${item.id}:entrada` ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Mais
                          </button>
                          <button
                            type="button"
                            onClick={() => ajustarInsumo(item, 'saida')}
                            disabled={actionKey === `insumo:${item.id}:saida`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `insumo:${item.id}:saida` ? <Loader2 className="animate-spin" size={18} /> : <Minus size={18} />}
                            Menos
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirInsumo(item)}
                            disabled={actionKey === `insumo:${item.id}:delete`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `insumo:${item.id}:delete` ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                            Excluir
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                  <Warehouse size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Produtos prontos</h2>
                  <p className="text-sm text-stone-500">Itens finalizados, disponiveis para venda e ajustes rapidos.</p>
                </div>
              </div>

              <div className="space-y-4">
                {produtosProntos.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-rose-200 bg-rose-50/70 px-6 py-10 text-center text-stone-500">
                    Nenhum produto pronto em estoque.
                  </div>
                ) : (
                  produtosProntos.map((item) => {
                    const atual = Number(item.quantidade_atual || 0)
                    const alerta = Number(item.alerta_minimo || 0)
                    const tone = toneByLevel(atual, alerta)

                    return (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-rose-100 bg-[linear-gradient(135deg,_rgba(255,241,242,0.92),_rgba(255,255,255,0.98))] p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-serif text-2xl text-stone-900">{item.produto_nome}</p>
                            <p className="mt-1 text-sm text-stone-500">{atual.toLocaleString('pt-BR')} un disponiveis</p>
                            <p className="mt-1 text-sm text-stone-400">Preco de venda: {currency(item.preco_venda || 0)}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${tone.badge}`}>
                            {tone.label}
                          </span>
                        </div>

                        {alerta > 0 && atual <= alerta && (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
                            <AlertTriangle size={14} />
                            Produzir reposicao
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => editarProdutoPronto(item)}
                            disabled={actionKey === `produto:${item.produto_id}:edit`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `produto:${item.produto_id}:edit` ? <Loader2 className="animate-spin" size={18} /> : <Pencil size={18} />}
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => ajustarProdutoPronto(item, 'entrada')}
                            disabled={actionKey === `produto:${item.produto_id}:entrada`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `produto:${item.produto_id}:entrada` ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Mais
                          </button>
                          <button
                            type="button"
                            onClick={() => ajustarProdutoPronto(item, 'saida')}
                            disabled={actionKey === `produto:${item.produto_id}:saida`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `produto:${item.produto_id}:saida` ? <Loader2 className="animate-spin" size={18} /> : <Minus size={18} />}
                            Menos
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirProdutoPronto(item)}
                            disabled={actionKey === `produto:${item.produto_id}:delete`}
                            className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                          >
                            {actionKey === `produto:${item.produto_id}:delete` ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                            Excluir
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default Estoque
