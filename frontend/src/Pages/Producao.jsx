import { useEffect, useMemo, useState } from 'react'
import { Beaker, CheckCircle2, Loader2, PlayCircle, RefreshCcw, Soup, XCircle } from 'lucide-react'

import { apiFetch } from '../lib/api'

const FORM_INICIAL = {
  produto_id: '',
  quantidade_produzida: '',
  observacao: '',
}

function badgeByStatus(status) {
  if (status === 'concluida') return 'bg-emerald-100 text-emerald-700'
  if (status === 'em_producao') return 'bg-amber-100 text-amber-700'
  if (status === 'cancelada') return 'bg-stone-200 text-stone-600'
  return 'bg-rose-100 text-rose-700'
}

function labelByStatus(status) {
  if (status === 'concluida') return 'Concluida'
  if (status === 'em_producao') return 'Em producao'
  if (status === 'cancelada') return 'Cancelada'
  return 'Pendente'
}

function fmtDate(dateString) {
  if (!dateString) return '--'
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Producao() {
  const [ordens, setOrdens] = useState([])
  const [produtos, setProdutos] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusActionId, setStatusActionId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [ordensData, produtosData] = await Promise.all([
        apiFetch('/api/ordens-producao'),
        apiFetch('/api/produtos?ativos_apenas=false'),
      ])

      setOrdens(Array.isArray(ordensData) ? ordensData : [])
      setProdutos(
        Array.isArray(produtosData)
          ? produtosData.filter((item) => item.tem_receita || Number(item.total_ingredientes || 0) > 0)
          : [],
      )
      setMensagem('')
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const resumo = useMemo(
    () => ({
      pendentes: ordens.filter((item) => item.status === 'pendente').length,
      emProducao: ordens.filter((item) => item.status === 'em_producao').length,
      concluidas: ordens.filter((item) => item.status === 'concluida').length,
    }),
    [ordens],
  )

  const ordensFiltradas = useMemo(() => {
    if (filtroStatus === 'todos') return ordens
    return ordens.filter((item) => item.status === filtroStatus)
  }, [filtroStatus, ordens])

  const produtoSelecionado = produtos.find((produto) => produto.id === form.produto_id)
  const quantidadeLotes = Number(form.quantidade_produzida || 0)
  const rendimentoSelecionado = Number(produtoSelecionado?.rendimento_receita || 1)
  const quantidadeFinalPrevista = quantidadeLotes * rendimentoSelecionado

  const onChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const criarOrdem = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMensagem('')

    try {
      await apiFetch('/api/ordens-producao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id: form.produto_id,
          quantidade_produzida: Number(form.quantidade_produzida),
          observacao: form.observacao || null,
        }),
      })
      setForm(FORM_INICIAL)
      setMensagem('Ordem de producao criada com sucesso.')
      await carregarDados()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSaving(false)
    }
  }

  const atualizarStatus = async (ordemId, action) => {
    setStatusActionId(`${ordemId}:${action}`)
    setMensagem('')

    try {
      const actionLabel =
        action === 'iniciar'
          ? 'iniciada'
          : action === 'concluir'
            ? 'concluida'
            : 'cancelada'

      await apiFetch(`/api/ordens-producao/${ordemId}/${action}`, {
        method: 'POST',
      })
      setMensagem(`Ordem de producao ${actionLabel} com sucesso.`)
      await carregarDados()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setStatusActionId('')
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.22),_transparent_30%),linear-gradient(135deg,_#fff7ed,_#fffbeb_45%,_#ecfccb)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
                <Soup size={14} />
                Lotes do dia
              </p>
              <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Ordens de producao</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                A cozinha trabalha por lote: produzir baixa insumos e alimenta o estoque de produtos prontos.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-rose-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Pendentes</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">{resumo.pendentes}</p>
              </div>
              <div className="rounded-3xl bg-amber-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">Em producao</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">{resumo.emProducao}</p>
              </div>
              <div className="rounded-3xl bg-emerald-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Concluidas</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">{resumo.concluidas}</p>
              </div>
            </div>
          </div>
        </section>

        {mensagem && (
          <div className="mb-6 rounded-3xl border border-amber-100 bg-white/85 px-5 py-4 text-sm font-medium text-stone-700 shadow-sm">
            {mensagem}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.2fr]">
          <form
            onSubmit={criarOrdem}
            className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Beaker size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Nova ordem</h2>
                <p className="text-sm text-stone-500">Planeje o lote que vai sair da bancada hoje.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Produto com receita</span>
                <select
                  required
                  value={form.produto_id}
                  onChange={(event) => onChange('produto_id', event.target.value)}
                  className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-stone-800"
                >
                  <option value="">Selecione um produto</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Quantidade de receitas</span>
                <input
                  required
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={form.quantidade_produzida}
                  onChange={(event) => onChange('quantidade_produzida', event.target.value)}
                  className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-stone-800"
                />
              </label>

              {produtoSelecionado && (
                <div className="rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm text-stone-600">
                  <p className="font-bold text-stone-900">
                    Entrada prevista: {quantidadeFinalPrevista.toLocaleString('pt-BR')} {produtoSelecionado.unidade_rendimento || 'un'}
                  </p>
                  <p className="mt-1">
                    Cada receita rende {Number(rendimentoSelecionado || 1).toLocaleString('pt-BR')} {produtoSelecionado.unidade_rendimento || 'un'}.
                  </p>
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Observacao</span>
                <textarea
                  rows="4"
                  value={form.observacao}
                  onChange={(event) => onChange('observacao', event.target.value)}
                  className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-stone-800"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Beaker size={20} />}
              Criar ordem de producao
            </button>
          </form>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Fila de lotes</h2>
                <p className="text-sm text-stone-500">Do planejamento ate a conclusao do lote produzido.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {[
                  ['todos', 'Todos'],
                  ['pendente', 'Pendentes'],
                  ['em_producao', 'Em producao'],
                  ['concluida', 'Concluidas'],
                ].map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltroStatus(valor)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                      filtroStatus === valor
                        ? 'bg-stone-900 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={carregarDados}
                  className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw size={16} />
                    Atualizar
                  </span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              </div>
            ) : ordensFiltradas.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/70 px-6 py-10 text-center text-stone-500">
                Nenhuma ordem encontrada para esse filtro.
              </div>
            ) : (
              <div className="space-y-4">
                {ordensFiltradas.map((ordem) => (
                  <article
                    key={ordem.id}
                    className="rounded-3xl border border-amber-100 bg-[linear-gradient(135deg,_rgba(255,247,237,0.95),_rgba(255,255,255,0.98))] p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-serif text-2xl text-stone-900">{ordem.produto_nome}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {Number(ordem.quantidade_produzida || 0).toLocaleString('pt-BR')} receita(s) | Entrada prevista: {Number(ordem.quantidade_final_prevista || ordem.quantidade_produzida || 0).toLocaleString('pt-BR')} {ordem.unidade_rendimento || 'un'}
                        </p>
                        <p className="mt-1 text-sm text-stone-400">
                          Criada em {fmtDate(ordem.created_at)} | Estoque pronto atual: {Number(ordem.estoque_produto_atual || 0).toLocaleString('pt-BR')} un
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${badgeByStatus(ordem.status)}`}
                        >
                          {labelByStatus(ordem.status)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${
                            ordem.tem_receita ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {ordem.tem_receita ? `${ordem.total_ingredientes} ingrediente(s)` : 'Sem receita'}
                        </span>
                      </div>
                    </div>

                    {ordem.observacao && <p className="mt-4 text-sm text-stone-600">{ordem.observacao}</p>}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => atualizarStatus(ordem.id, 'iniciar')}
                        disabled={ordem.status !== 'pendente' || statusActionId === `${ordem.id}:iniciar`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                      >
                        {statusActionId === `${ordem.id}:iniciar` ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
                        Iniciar
                      </button>
                      <button
                        onClick={() => atualizarStatus(ordem.id, 'concluir')}
                        disabled={!['pendente', 'em_producao'].includes(ordem.status) || statusActionId === `${ordem.id}:concluir`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                      >
                        {statusActionId === `${ordem.id}:concluir` ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        Concluir lote
                      </button>
                      <button
                        onClick={() => atualizarStatus(ordem.id, 'cancelar')}
                        disabled={!['pendente', 'em_producao'].includes(ordem.status) || statusActionId === `${ordem.id}:cancelar`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-rose-100 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                      >
                        {statusActionId === `${ordem.id}:cancelar` ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                        Cancelar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default Producao
