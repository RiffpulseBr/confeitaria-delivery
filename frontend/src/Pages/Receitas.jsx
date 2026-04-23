import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpenText, ClipboardList, Loader2, Plus, Trash2 } from 'lucide-react'

import { apiFetch } from '../lib/api'

const INGREDIENTE_VAZIO = {
  insumo_id: '',
  quantidade_insumo: '',
  unidade_medida: 'un',
}

const FORM_INICIAL = {
  usarNovoProduto: true,
  produto_id: '',
  novo_produto_nome: '',
  novo_produto_preco_venda: '',
  nome_receita: '',
  rendimento: '',
  unidade_rendimento: 'un',
  modo_preparo: '',
  observacoes: '',
  ingredientes: [{ ...INGREDIENTE_VAZIO }],
}

function Receitas() {
  const navigate = useNavigate()
  const [insumos, setInsumos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [receitas, setReceitas] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [ultimoProdutoCriado, setUltimoProdutoCriado] = useState(null)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [receitasData, insumosData, produtosData] = await Promise.all([
        apiFetch('/api/receitas'),
        apiFetch('/api/estoque/insumos'),
        apiFetch('/api/produtos?ativos_apenas=false'),
      ])

      setReceitas(Array.isArray(receitasData) ? receitasData : [])
      setInsumos(Array.isArray(insumosData) ? insumosData : [])
      setProdutos(Array.isArray(produtosData) ? produtosData : [])
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

  const onChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const alternarModo = (usarNovoProduto) => {
    setForm((current) => ({
      ...current,
      usarNovoProduto,
      produto_id: usarNovoProduto ? '' : current.produto_id,
      novo_produto_nome: usarNovoProduto ? current.novo_produto_nome : '',
      novo_produto_preco_venda: usarNovoProduto ? current.novo_produto_preco_venda : '',
    }))
  }

  const atualizarIngrediente = (index, field, value) => {
    setForm((current) => {
      const ingredientes = [...current.ingredientes]
      const proximo = { ...ingredientes[index], [field]: value }

      if (field === 'insumo_id') {
        const insumoSelecionado = insumos.find((item) => item.id === value)
        if (insumoSelecionado?.unidade_medida) {
          proximo.unidade_medida = insumoSelecionado.unidade_medida
        }
      }

      ingredientes[index] = proximo
      return { ...current, ingredientes }
    })
  }

  const adicionarIngrediente = () => {
    setForm((current) => ({
      ...current,
      ingredientes: [...current.ingredientes, { ...INGREDIENTE_VAZIO }],
    }))
  }

  const removerIngrediente = (index) => {
    setForm((current) => ({
      ...current,
      ingredientes:
        current.ingredientes.length === 1
          ? [{ ...INGREDIENTE_VAZIO }]
          : current.ingredientes.filter((_, ingredientIndex) => ingredientIndex !== index),
    }))
  }

  const salvarReceita = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMensagem('')

    try {
      const ingredientes = form.ingredientes
        .filter((ingrediente) => ingrediente.insumo_id && ingrediente.quantidade_insumo)
        .map((ingrediente) => ({
          insumo_id: ingrediente.insumo_id,
          quantidade_insumo: Number(ingrediente.quantidade_insumo),
          unidade_medida: ingrediente.unidade_medida || null,
        }))

      if (ingredientes.length === 0) {
        throw new Error('Adicione pelo menos um ingrediente para salvar a receita.')
      }

      const data = await apiFetch('/api/receitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id: form.usarNovoProduto ? null : form.produto_id,
          novo_produto: form.usarNovoProduto
            ? {
                nome: form.novo_produto_nome,
                preco_venda: form.novo_produto_preco_venda ? Number(form.novo_produto_preco_venda) : 0,
                ativo: true,
              }
            : null,
          nome_receita: form.nome_receita || null,
          rendimento: form.rendimento ? Number(form.rendimento) : null,
          unidade_rendimento: form.unidade_rendimento || null,
          modo_preparo: form.modo_preparo || null,
          observacoes: form.observacoes || null,
          ingredientes,
        }),
      })

      const produtoIdCriado =
        data?.receita?.produto_id || (form.usarNovoProduto ? data?.produto?.id : form.produto_id) || null

      if (produtoIdCriado) {
        window.sessionStorage.setItem('confeitaria:produto-destaque', produtoIdCriado)
        setUltimoProdutoCriado({
          id: produtoIdCriado,
          nome: data?.receita?.produto_nome || form.novo_produto_nome || '',
        })
      } else {
        setUltimoProdutoCriado(null)
      }

      setForm(FORM_INICIAL)
      setMensagem('Receita salva com sucesso.')
      await carregarDados()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#fff1f2_46%,_#fffbeb)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.1)] backdrop-blur">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-rose-700">
            <BookOpenText size={14} />
            Fichas tecnicas
          </p>
          <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Receitas e modo de preparo</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
            Cadastre o produto final junto com ingredientes, rendimento e instrucoes da bancada.
          </p>
        </section>

        {mensagem && (
          <div className="mb-6 rounded-3xl border border-rose-100 bg-white/85 px-5 py-4 text-sm font-medium text-stone-700 shadow-sm">
            {mensagem}
          </div>
        )}

        {ultimoProdutoCriado && (
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-amber-100 bg-amber-50/80 px-5 py-4 text-sm text-stone-700 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-bold text-stone-900">Produto enviado para a aba Produtos</p>
              <p className="mt-1">
                {ultimoProdutoCriado.nome || 'Produto novo'} agora pode ser revisado em `Produtos`, com preco, status e destaque.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/produtos')}
                className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
              >
                Abrir Produtos
              </button>
              <Link
                to="/produtos"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-stone-700 shadow-sm transition hover:bg-stone-50"
              >
                Ver destaque
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.98fr_1.22fr]">
          <form onSubmit={salvarReceita} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                <ClipboardList size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Nova receita</h2>
                <p className="text-sm text-stone-500">Produto final, ingredientes e preparo em um so lugar.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-rose-100 bg-rose-50/60 p-4">
                <p className="text-sm font-bold text-stone-700">Produto final</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => alternarModo(true)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                      form.usarNovoProduto ? 'bg-rose-500 text-white shadow-lg' : 'bg-white text-stone-600 hover:bg-rose-50'
                    }`}
                  >
                    Criar novo produto
                  </button>
                  <button
                    type="button"
                    onClick={() => alternarModo(false)}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                      !form.usarNovoProduto ? 'bg-rose-500 text-white shadow-lg' : 'bg-white text-stone-600 hover:bg-rose-50'
                    }`}
                  >
                    Usar produto existente
                  </button>
                </div>
              </div>

              {form.usarNovoProduto ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Nome do novo produto</span>
                    <input
                      required
                      type="text"
                      value={form.novo_produto_nome}
                      onChange={(event) => onChange('novo_produto_nome', event.target.value)}
                      className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Preco de venda</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.novo_produto_preco_venda}
                      onChange={(event) => onChange('novo_produto_preco_venda', event.target.value)}
                      className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                    />
                  </label>
                </div>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Produto existente</span>
                  <select
                    required
                    value={form.produto_id}
                    onChange={(event) => onChange('produto_id', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                  >
                    <option value="">Selecione um produto</option>
                    {produtos.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Nome da receita</span>
                <input
                  type="text"
                  value={form.nome_receita}
                  onChange={(event) => onChange('nome_receita', event.target.value)}
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Rendimento</span>
                  <input
                    min="0.001"
                    step="0.001"
                    type="number"
                    value={form.rendimento}
                    onChange={(event) => onChange('rendimento', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Unidade do rendimento</span>
                  <select
                    value={form.unidade_rendimento}
                    onChange={(event) => onChange('unidade_rendimento', event.target.value)}
                    className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                  >
                    <option value="un">un</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3 rounded-3xl border border-rose-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-stone-900">Ingredientes</h3>
                  <button
                    type="button"
                    onClick={adicionarIngrediente}
                    className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </div>

                {form.ingredientes.map((ingrediente, index) => (
                  <div key={`ingrediente-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 md:grid-cols-[1.4fr_0.85fr_0.7fr_auto]">
                    <select
                      required
                      value={ingrediente.insumo_id}
                      onChange={(event) => atualizarIngrediente(index, 'insumo_id', event.target.value)}
                      className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-stone-800"
                    >
                      <option value="">Selecione um insumo</option>
                      {insumos.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </select>

                    <input
                      required
                      min="0.001"
                      step="0.001"
                      type="number"
                      value={ingrediente.quantidade_insumo}
                      onChange={(event) => atualizarIngrediente(index, 'quantidade_insumo', event.target.value)}
                      className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-stone-800"
                    />

                    <input
                      type="text"
                      value={ingrediente.unidade_medida}
                      onChange={(event) => atualizarIngrediente(index, 'unidade_medida', event.target.value)}
                      className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-stone-800"
                    />

                    <button
                      type="button"
                      onClick={() => removerIngrediente(index)}
                      className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-stone-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Modo de preparo</span>
                <textarea
                  rows="6"
                  value={form.modo_preparo}
                  onChange={(event) => onChange('modo_preparo', event.target.value)}
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Observacoes</span>
                <textarea
                  rows="3"
                  value={form.observacoes}
                  onChange={(event) => onChange('observacoes', event.target.value)}
                  className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-stone-800"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <ClipboardList size={20} />}
              Salvar receita
            </button>
          </form>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Receitas cadastradas</h2>
                <p className="text-sm text-stone-500">Fichas tecnicas prontas para a cozinha consultar.</p>
              </div>
              <button
                onClick={carregarDados}
                className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                Recarregar
              </button>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
              </div>
            ) : receitas.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-rose-200 bg-rose-50/70 px-6 py-10 text-center text-stone-500">
                Nenhuma receita cadastrada ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {receitas.map((receita) => (
                  <div key={receita.receita_id} className="rounded-3xl border border-rose-100 bg-[linear-gradient(135deg,_rgba(255,241,242,0.92),_rgba(255,255,255,0.98))] p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-serif text-2xl text-stone-900">{receita.nome_receita || receita.produto_nome}</p>
                        <p className="mt-1 text-sm text-stone-500">Produto: {receita.produto_nome}</p>
                      </div>
                      <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-rose-700 shadow-sm">
                        {receita.rendimento ? `${receita.rendimento} ${receita.unidade_rendimento || 'un'}` : 'Sem rendimento'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {receita.ingredientes.map((ingrediente) => (
                        <div key={ingrediente.id || `${receita.receita_id}-${ingrediente.insumo_id}`} className="rounded-2xl bg-white/90 px-4 py-3">
                          <p className="font-bold text-stone-800">{ingrediente.insumo_nome}</p>
                          <p className="mt-1 text-sm text-stone-500">
                            {Number(ingrediente.quantidade_insumo || 0).toLocaleString('pt-BR')} {ingrediente.unidade_medida || 'un'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {receita.modo_preparo && (
                      <div className="mt-4 rounded-2xl bg-white/90 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-400">Modo de preparo</p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-700">{receita.modo_preparo}</p>
                      </div>
                    )}

                    {receita.observacoes && <p className="mt-3 text-sm text-stone-600">{receita.observacoes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default Receitas
