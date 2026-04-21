import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PackageCheck, PackageSearch, RefreshCcw, Warehouse } from 'lucide-react'

import { apiFetch, currency } from '../lib/api'

const ENTRADA_INICIAL = {
  insumo_id: '',
  quantidade: '',
  custo_unitario: '',
  documento: '',
  observacao: '',
}

const PRODUTO_PRONTO_INICIAL = {
  produto_id: '',
  quantidade: '',
  tipo_movimentacao: 'entrada',
  alerta_minimo: '',
  observacao: '',
}

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

function Estoque() {
  const [insumos, setInsumos] = useState([])
  const [produtosProntos, setProdutosProntos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [entradaForm, setEntradaForm] = useState(ENTRADA_INICIAL)
  const [produtoProntoForm, setProdutoProntoForm] = useState(PRODUTO_PRONTO_INICIAL)
  const [loading, setLoading] = useState(true)
  const [submittingEntrada, setSubmittingEntrada] = useState(false)
  const [submittingProdutoPronto, setSubmittingProdutoPronto] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const carregarEstoque = async () => {
    setLoading(true)
    try {
      const [insumosData, produtosProntosData, produtosData] = await Promise.all([
        apiFetch('/api/estoque/insumos'),
        apiFetch('/api/estoque/produtos'),
        apiFetch('/api/produtos?ativos_apenas=false'),
      ])

      setInsumos(Array.isArray(insumosData) ? insumosData : [])
      setProdutosProntos(Array.isArray(produtosProntosData) ? produtosProntosData : [])
      setProdutos(Array.isArray(produtosData) ? produtosData : [])
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

  const onChangeEntrada = (field, value) => {
    setEntradaForm((current) => ({ ...current, [field]: value }))
  }

  const onChangeProdutoPronto = (field, value) => {
    setProdutoProntoForm((current) => ({ ...current, [field]: value }))
  }

  const registrarEntrada = async (event) => {
    event.preventDefault()
    setSubmittingEntrada(true)
    setMensagem('')

    try {
      await apiFetch('/api/estoque/entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insumo_id: entradaForm.insumo_id,
          quantidade: Number(entradaForm.quantidade),
          custo_unitario: entradaForm.custo_unitario ? Number(entradaForm.custo_unitario) : null,
          documento: entradaForm.documento || null,
          observacao: entradaForm.observacao || null,
        }),
      })

      setEntradaForm(ENTRADA_INICIAL)
      setMensagem('Entrada de mercadoria registrada com sucesso.')
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingEntrada(false)
    }
  }

  const movimentarProdutoPronto = async (event) => {
    event.preventDefault()
    setSubmittingProdutoPronto(true)
    setMensagem('')

    try {
      await apiFetch('/api/estoque/produtos/movimentar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id: produtoProntoForm.produto_id,
          quantidade: Number(produtoProntoForm.quantidade),
          tipo_movimentacao: produtoProntoForm.tipo_movimentacao,
          alerta_minimo: produtoProntoForm.alerta_minimo ? Number(produtoProntoForm.alerta_minimo) : null,
          observacao: produtoProntoForm.observacao || null,
        }),
      })

      setProdutoProntoForm(PRODUTO_PRONTO_INICIAL)
      setMensagem('Estoque de produtos prontos atualizado com sucesso.')
      await carregarEstoque()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingProdutoPronto(false)
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
                Operacao de estoque
              </p>
              <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Insumos e produtos prontos</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Uma aba para entrada de mercadoria e outra frente para controlar o que ja foi produzido para venda.
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

        <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
          <form onSubmit={registrarEntrada} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <PackageSearch size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Entrada de mercadoria</h2>
                <p className="text-sm text-stone-500">Compra e reposicao dos insumos da cozinha.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Insumo</span>
                <select
                  required
                  value={entradaForm.insumo_id}
                  onChange={(event) => onChangeEntrada('insumo_id', event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                >
                  <option value="">Selecione um insumo</option>
                  {insumos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} • Atual: {item.quantidade_atual} {item.unidade_medida || 'un'}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Quantidade recebida</span>
                  <input
                    required
                    min="0.001"
                    step="0.001"
                    type="number"
                    value={entradaForm.quantidade}
                    onChange={(event) => onChangeEntrada('quantidade', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Custo unitario</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={entradaForm.custo_unitario}
                    onChange={(event) => onChangeEntrada('custo_unitario', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Documento</span>
                  <input
                    type="text"
                    value={entradaForm.documento}
                    onChange={(event) => onChangeEntrada('documento', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Observacao</span>
                  <input
                    type="text"
                    value={entradaForm.observacao}
                    onChange={(event) => onChangeEntrada('observacao', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingEntrada}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {submittingEntrada ? <Loader2 className="animate-spin" size={20} /> : <PackageCheck size={20} />}
              Registrar entrada
            </button>
          </form>

          <form onSubmit={movimentarProdutoPronto} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                <Warehouse size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Movimentar produto pronto</h2>
                <p className="text-sm text-stone-500">Entrada de lote produzido ou baixa manual do estoque pronto.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Produto</span>
                <select
                  required
                  value={produtoProntoForm.produto_id}
                  onChange={(event) => onChangeProdutoPronto('produto_id', event.target.value)}
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-stone-800"
                >
                  <option value="">Selecione um produto</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Tipo</span>
                  <select
                    value={produtoProntoForm.tipo_movimentacao}
                    onChange={(event) => onChangeProdutoPronto('tipo_movimentacao', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-stone-800"
                  >
                    <option value="entrada">Entrada de lote</option>
                    <option value="saida">Saida / ajuste</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Quantidade</span>
                  <input
                    required
                    min="0.001"
                    step="0.001"
                    type="number"
                    value={produtoProntoForm.quantidade}
                    onChange={(event) => onChangeProdutoPronto('quantidade', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-stone-800"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Alerta minimo</span>
                  <input
                    min="0"
                    step="0.001"
                    type="number"
                    value={produtoProntoForm.alerta_minimo}
                    onChange={(event) => onChangeProdutoPronto('alerta_minimo', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-stone-800"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Observacao</span>
                  <input
                    type="text"
                    value={produtoProntoForm.observacao}
                    onChange={(event) => onChangeProdutoPronto('observacao', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-stone-800"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingProdutoPronto}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {submittingProdutoPronto ? <Loader2 className="animate-spin" size={20} /> : <Warehouse size={20} />}
              Salvar movimentacao
            </button>
          </form>
        </div>

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
                  <p className="text-sm text-stone-500">Base da producao e reposicao da cozinha.</p>
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
                      <div key={item.id} className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_rgba(240,253,244,0.95),_rgba(255,255,255,0.98))] p-5 shadow-sm">
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
                  <p className="text-sm text-stone-500">O que ja saiu da bancada e pode ser vendido.</p>
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
                      <div key={item.id} className="rounded-3xl border border-rose-100 bg-[linear-gradient(135deg,_rgba(255,241,242,0.92),_rgba(255,255,255,0.98))] p-5 shadow-sm">
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
