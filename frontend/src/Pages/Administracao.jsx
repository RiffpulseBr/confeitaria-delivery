import { useCallback, useEffect, useState } from 'react'
import {
  BookOpenText,
  ClipboardList,
  Link2,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCcw,
  Store,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react'

import { getApiBaseUrl } from '../config'

const INGREDIENTE_VAZIO = {
  insumo_id: '',
  quantidade_insumo: '',
  unidade_medida: 'un',
}

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function statusTone(state) {
  if (state === 'OK') return 'bg-emerald-100 text-emerald-700'
  if (state === 'WARNING') return 'bg-amber-100 text-amber-700'
  if (state === 'ERROR') return 'bg-red-100 text-red-700'
  return 'bg-slate-200 text-slate-700'
}

async function parseJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function Administracao() {
  const [insumos, setInsumos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [merchants, setMerchants] = useState([])
  const [statusByMerchant, setStatusByMerchant] = useState({})
  const [mapeamentos, setMapeamentos] = useState([])
  const [receitas, setReceitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [merchantLookupDisponivel, setMerchantLookupDisponivel] = useState(true)
  const [submittingStock, setSubmittingStock] = useState(false)
  const [submittingMapping, setSubmittingMapping] = useState(false)
  const [submittingInsumo, setSubmittingInsumo] = useState(false)
  const [submittingReceita, setSubmittingReceita] = useState(false)
  const [updatingMerchantId, setUpdatingMerchantId] = useState('')
  const [form, setForm] = useState({
    estoque_id: '',
    quantidade: '',
    custo_unitario: '',
    documento: '',
    observacao: '',
  })
  const [mappingForm, setMappingForm] = useState({
    merchant_id: '',
    merchant_item_id: '',
    produto_id: '',
    observacao: '',
  })
  const [insumoForm, setInsumoForm] = useState({
    nome: '',
    unidade_medida: 'kg',
    quantidade_inicial: '',
    alerta_minimo: '',
    custo_medio: '',
  })
  const [receitaForm, setReceitaForm] = useState({
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
  })

  const carregarPainel = useCallback(async () => {
    setLoading(true)

    try {
      const [insumosRes, merchantsRes, produtosRes, mappingsRes, receitasRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/estoque/insumos`),
        fetch(`${getApiBaseUrl()}/api/ifood/merchants`),
        fetch(`${getApiBaseUrl()}/api/produtos`),
        fetch(`${getApiBaseUrl()}/api/ifood/item-mappings`),
        fetch(`${getApiBaseUrl()}/api/receitas`),
      ])

      const [insumosData, merchantsData, produtosData, mappingsData, receitasData] = await Promise.all([
        parseJson(insumosRes),
        parseJson(merchantsRes),
        parseJson(produtosRes),
        parseJson(mappingsRes),
        parseJson(receitasRes),
      ])

      const merchantList = Array.isArray(merchantsData) ? merchantsData : []
      const insumosList = Array.isArray(insumosData) ? insumosData : []
      const produtosList = Array.isArray(produtosData) ? produtosData : []

      setInsumos(insumosList)
      setProdutos(produtosList)
      setMapeamentos(Array.isArray(mappingsData) ? mappingsData : [])
      setReceitas(Array.isArray(receitasData) ? receitasData : [])
      setMerchants(merchantList)
      setMerchantLookupDisponivel(merchantsRes.ok && merchantList.length > 0)

      if (merchantList.length > 0) {
        setMappingForm((current) => ({
          ...current,
          merchant_id: current.merchant_id || merchantList[0].id || '',
        }))
      }

      if (merchantList.length > 0) {
        const statuses = await Promise.all(
          merchantList.map(async (merchant) => {
            try {
              const response = await fetch(`${getApiBaseUrl()}/api/ifood/merchants/${merchant.id}/status`)
              const data = await parseJson(response)
              return [
                merchant.id,
                data || { status: { state: 'ERROR', message: 'Falha ao consultar status.' }, interruptions: [] },
              ]
            } catch {
              return [
                merchant.id,
                { status: { state: 'ERROR', message: 'Falha ao consultar status.' }, interruptions: [] },
              ]
            }
          }),
        )
        setStatusByMerchant(Object.fromEntries(statuses))
      } else {
        setStatusByMerchant({})
      }
    } catch {
      setMerchantLookupDisponivel(false)
      setMensagem('Nao foi possivel carregar todos os dados administrativos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarPainel()
  }, [carregarPainel])

  const onChangeForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onChangeMappingForm = (field, value) => {
    setMappingForm((current) => ({ ...current, [field]: value }))
  }

  const onChangeInsumoForm = (field, value) => {
    setInsumoForm((current) => ({ ...current, [field]: value }))
  }

  const onChangeReceitaForm = (field, value) => {
    setReceitaForm((current) => ({ ...current, [field]: value }))
  }

  const alternarModoProdutoReceita = (usarNovoProduto) => {
    setReceitaForm((current) => ({
      ...current,
      usarNovoProduto,
      produto_id: usarNovoProduto ? '' : current.produto_id,
      novo_produto_nome: usarNovoProduto ? current.novo_produto_nome : '',
      novo_produto_preco_venda: usarNovoProduto ? current.novo_produto_preco_venda : '',
    }))
  }

  const atualizarIngrediente = (index, field, value) => {
    setReceitaForm((current) => {
      const ingredientes = [...current.ingredientes]
      const proximo = { ...ingredientes[index], [field]: value }

      if (field === 'insumo_id') {
        const insumoSelecionado = insumos.find((item) => item.produto_id === value)
        if (insumoSelecionado?.unidade_medida) {
          proximo.unidade_medida = insumoSelecionado.unidade_medida
        }
      }

      ingredientes[index] = proximo
      return { ...current, ingredientes }
    })
  }

  const adicionarIngrediente = () => {
    setReceitaForm((current) => ({
      ...current,
      ingredientes: [...current.ingredientes, { ...INGREDIENTE_VAZIO }],
    }))
  }

  const removerIngrediente = (index) => {
    setReceitaForm((current) => ({
      ...current,
      ingredientes:
        current.ingredientes.length === 1
          ? [{ ...INGREDIENTE_VAZIO }]
          : current.ingredientes.filter((_, ingredientIndex) => ingredientIndex !== index),
    }))
  }

  const registrarEntrada = async (event) => {
    event.preventDefault()
    setSubmittingStock(true)
    setMensagem('')

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/estoque/entrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estoque_id: form.estoque_id,
          quantidade: Number(form.quantidade),
          custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : null,
          documento: form.documento || null,
          observacao: form.observacao || null,
        }),
      })

      const data = await parseJson(response)
      if (!response.ok) {
        throw new Error(data?.detail || 'Nao foi possivel registrar a entrada.')
      }

      setMensagem('Entrada de mercadoria registrada com sucesso.')
      setForm({
        estoque_id: '',
        quantidade: '',
        custo_unitario: '',
        documento: '',
        observacao: '',
      })
      await carregarPainel()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingStock(false)
    }
  }

  const cadastrarInsumo = async (event) => {
    event.preventDefault()
    setSubmittingInsumo(true)
    setMensagem('')

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/insumos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: insumoForm.nome,
          unidade_medida: insumoForm.unidade_medida,
          quantidade_inicial: insumoForm.quantidade_inicial ? Number(insumoForm.quantidade_inicial) : 0,
          alerta_minimo: insumoForm.alerta_minimo ? Number(insumoForm.alerta_minimo) : 0,
          custo_medio: insumoForm.custo_medio ? Number(insumoForm.custo_medio) : null,
        }),
      })

      const data = await parseJson(response)
      if (!response.ok) {
        throw new Error(data?.detail || 'Nao foi possivel cadastrar o insumo.')
      }

      setMensagem('Insumo cadastrado com sucesso.')
      setInsumoForm({
        nome: '',
        unidade_medida: 'kg',
        quantidade_inicial: '',
        alerta_minimo: '',
        custo_medio: '',
      })
      await carregarPainel()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingInsumo(false)
    }
  }

  const atualizarLoja = async (merchantId, action, interruptionId) => {
    setUpdatingMerchantId(merchantId)
    setMensagem('')

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/ifood/merchants/${merchantId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:
          action === 'close'
            ? JSON.stringify({
                duration_minutes: 120,
                description: 'Fechamento temporario acionado pelo painel da confeitaria',
              })
            : JSON.stringify({
                interruption_id: interruptionId || null,
              }),
      })

      const data = await parseJson(response)
      if (!response.ok) {
        throw new Error(data?.detail || 'Nao foi possivel atualizar a loja.')
      }

      setMensagem(action === 'close' ? 'Solicitacao de fechamento enviada.' : 'Solicitacao de abertura enviada.')
      await carregarPainel()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setUpdatingMerchantId('')
    }
  }

  const salvarMapeamento = async (event) => {
    event.preventDefault()
    setSubmittingMapping(true)
    setMensagem('')

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/ifood/item-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: mappingForm.merchant_id,
          merchant_item_id: mappingForm.merchant_item_id,
          produto_id: mappingForm.produto_id,
          observacao: mappingForm.observacao || null,
        }),
      })

      const data = await parseJson(response)
      if (!response.ok) {
        throw new Error(data?.detail || 'Nao foi possivel salvar o mapeamento.')
      }

      setMensagem('Mapeamento iFood salvo com sucesso.')
      setMappingForm((current) => ({
        ...current,
        merchant_item_id: '',
        produto_id: '',
        observacao: '',
      }))
      await carregarPainel()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingMapping(false)
    }
  }

  const salvarReceita = async (event) => {
    event.preventDefault()
    setSubmittingReceita(true)
    setMensagem('')

    try {
      const ingredientes = receitaForm.ingredientes
        .filter((ingrediente) => ingrediente.insumo_id && ingrediente.quantidade_insumo)
        .map((ingrediente) => ({
          insumo_id: ingrediente.insumo_id,
          quantidade_insumo: Number(ingrediente.quantidade_insumo),
          unidade_medida: ingrediente.unidade_medida || null,
        }))

      if (ingredientes.length === 0) {
        throw new Error('Adicione pelo menos um ingrediente para salvar a receita.')
      }

      const response = await fetch(`${getApiBaseUrl()}/api/receitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id: receitaForm.usarNovoProduto ? null : receitaForm.produto_id,
          novo_produto: receitaForm.usarNovoProduto
            ? {
                nome: receitaForm.novo_produto_nome,
                preco_venda: receitaForm.novo_produto_preco_venda ? Number(receitaForm.novo_produto_preco_venda) : 0,
                ativo: true,
              }
            : null,
          nome_receita: receitaForm.nome_receita || null,
          rendimento: receitaForm.rendimento ? Number(receitaForm.rendimento) : null,
          unidade_rendimento: receitaForm.unidade_rendimento || null,
          modo_preparo: receitaForm.modo_preparo || null,
          observacoes: receitaForm.observacoes || null,
          ingredientes,
        }),
      })

      const data = await parseJson(response)
      if (!response.ok) {
        throw new Error(data?.detail || 'Nao foi possivel salvar a receita.')
      }

      setMensagem('Receita salva com sucesso.')
      setReceitaForm({
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
      })
      await carregarPainel()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingReceita(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Administracao</h1>
          <p className="mt-2 text-slate-500">Operacao iFood, abastecimento de estoque e fichas tecnicas da producao.</p>
        </div>

        <button
          onClick={carregarPainel}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCcw size={18} />
          Atualizar painel
        </button>
      </div>

      {mensagem && (
        <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {mensagem}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_1.2fr]">
        <section className="rounded-[2rem] bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
              <PackagePlus size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Entrada de Mercadoria</h2>
              <p className="text-sm text-slate-500">Registra compras e incrementa o estoque atual.</p>
            </div>
          </div>

          <form onSubmit={registrarEntrada} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Insumo</span>
              <select
                required
                value={form.estoque_id}
                onChange={(event) => onChangeForm('estoque_id', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
              >
                <option value="">Selecione um item do estoque</option>
                {insumos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {(item.produtos?.nome || 'Insumo sem nome') + ` | Atual: ${item.quantidade_atual} ${item.unidade_medida || 'un'}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Quantidade recebida</span>
                <input
                  required
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={form.quantidade}
                  onChange={(event) => onChangeForm('quantidade', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Custo unitario</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.custo_unitario}
                  onChange={(event) => onChangeForm('custo_unitario', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Documento</span>
                <input
                  type="text"
                  value={form.documento}
                  onChange={(event) => onChangeForm('documento', event.target.value)}
                  placeholder="NF, pedido de compra, lote"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Observacao</span>
                <input
                  type="text"
                  value={form.observacao}
                  onChange={(event) => onChangeForm('observacao', event.target.value)}
                  placeholder="Fornecedor, lote ou observacao operacional"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingStock}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submittingStock ? <Loader2 className="animate-spin" size={22} /> : <PackagePlus size={22} />}
              Registrar entrada
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Cadastro de Insumos</h2>
              <p className="text-sm text-slate-500">Crie novos itens de estoque para usar nas receitas e compras.</p>
            </div>
          </div>

          <form onSubmit={cadastrarInsumo} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Nome do insumo</span>
              <input
                required
                type="text"
                value={insumoForm.nome}
                onChange={(event) => onChangeInsumoForm('nome', event.target.value)}
                placeholder="Ex: Leite condensado"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-amber-400"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Unidade</span>
                <select
                  value={insumoForm.unidade_medida}
                  onChange={(event) => onChangeInsumoForm('unidade_medida', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-amber-400"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="un">un</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Quantidade inicial</span>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={insumoForm.quantidade_inicial}
                  onChange={(event) => onChangeInsumoForm('quantidade_inicial', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-amber-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Alerta minimo</span>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={insumoForm.alerta_minimo}
                  onChange={(event) => onChangeInsumoForm('alerta_minimo', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Custo medio</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={insumoForm.custo_medio}
                  onChange={(event) => onChangeInsumoForm('custo_medio', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-amber-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingInsumo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submittingInsumo ? <Loader2 className="animate-spin" size={22} /> : <Plus size={22} />}
              Cadastrar insumo
            </button>
          </form>
        </section>
      </div>

      <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-rose-100 p-3 text-rose-600">
            <BookOpenText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cadastro de Receitas</h2>
            <p className="text-sm text-slate-500">Monte a ficha tecnica do produto com ingredientes, modo de preparo e rendimento.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_1.15fr]">
          <form onSubmit={salvarReceita} className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <div className="rounded-3xl border border-rose-100 bg-white p-4">
              <p className="text-sm font-bold text-slate-700">Produto final</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => alternarModoProdutoReceita(true)}
                  className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    receitaForm.usarNovoProduto
                      ? 'bg-rose-500 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Cadastrar novo produto
                </button>
                <button
                  type="button"
                  onClick={() => alternarModoProdutoReceita(false)}
                  className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    !receitaForm.usarNovoProduto
                      ? 'bg-rose-500 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Usar produto existente
                </button>
              </div>
            </div>

            {receitaForm.usarNovoProduto ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Nome do novo produto</span>
                  <input
                    required
                    type="text"
                    value={receitaForm.novo_produto_nome}
                    onChange={(event) => onChangeReceitaForm('novo_produto_nome', event.target.value)}
                    placeholder="Ex: Brigadeiro Gourmet"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Preco de venda</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={receitaForm.novo_produto_preco_venda}
                    onChange={(event) => onChangeReceitaForm('novo_produto_preco_venda', event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                  />
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Produto existente</span>
                <select
                  required
                  value={receitaForm.produto_id}
                  onChange={(event) => onChangeReceitaForm('produto_id', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
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
              <span className="mb-2 block text-sm font-bold text-slate-700">Nome da receita</span>
              <input
                type="text"
                value={receitaForm.nome_receita}
                onChange={(event) => onChangeReceitaForm('nome_receita', event.target.value)}
                placeholder="Ex: Brigadeiro tradicional 25g"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Rendimento</span>
                <input
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={receitaForm.rendimento}
                  onChange={(event) => onChangeReceitaForm('rendimento', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Unidade de rendimento</span>
                <select
                  value={receitaForm.unidade_rendimento}
                  onChange={(event) => onChangeReceitaForm('unidade_rendimento', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                >
                  <option value="un">un</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                </select>
              </label>
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Ingredientes</h3>
                <button
                  type="button"
                  onClick={adicionarIngrediente}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  <Plus size={16} />
                  Adicionar item
                </button>
              </div>

              {receitaForm.ingredientes.map((ingrediente, index) => (
                <div key={`ingrediente-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1.5fr_0.8fr_0.7fr_auto]">
                  <select
                    required
                    value={ingrediente.insumo_id}
                    onChange={(event) => atualizarIngrediente(index, 'insumo_id', event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                  >
                    <option value="">Selecione um insumo</option>
                    {insumos.map((item) => (
                      <option key={item.produto_id} value={item.produto_id}>
                        {item.produtos?.nome || 'Insumo sem nome'}
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
                    placeholder="Qtd"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                  />

                  <input
                    type="text"
                    value={ingrediente.unidade_medida}
                    onChange={(event) => atualizarIngrediente(index, 'unidade_medida', event.target.value)}
                    placeholder="un"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
                  />

                  <button
                    type="button"
                    onClick={() => removerIngrediente(index)}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-200 px-4 py-3 text-slate-600 transition hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Modo de preparo</span>
              <textarea
                rows="6"
                value={receitaForm.modo_preparo}
                onChange={(event) => onChangeReceitaForm('modo_preparo', event.target.value)}
                placeholder="Descreva a ordem da producao, pontos de cozimento e cuidados."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Observacoes</span>
              <textarea
                rows="3"
                value={receitaForm.observacoes}
                onChange={(event) => onChangeReceitaForm('observacoes', event.target.value)}
                placeholder="Ex: validade, padrao de acabamento, ponto ideal."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-rose-400"
              />
            </label>

            <button
              type="submit"
              disabled={submittingReceita}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submittingReceita ? <Loader2 className="animate-spin" size={22} /> : <ClipboardList size={22} />}
              Salvar receita
            </button>
          </form>

          <div className="space-y-4">
            {receitas.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-6 text-slate-500">
                Nenhuma receita cadastrada ainda.
              </div>
            )}

            {receitas.map((receita) => (
              <div key={receita.produto_id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xl font-bold text-slate-900">{receita.nome_receita || receita.produto_nome}</p>
                    <p className="text-sm text-slate-500">{receita.produto_nome}</p>
                  </div>
                  <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700">
                    {receita.rendimento ? `${receita.rendimento} ${receita.unidade_rendimento || 'un'}` : 'Rendimento nao informado'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {receita.ingredientes.map((ingrediente) => (
                    <div key={ingrediente.id || `${receita.produto_id}-${ingrediente.insumo_id}`} className="rounded-2xl bg-white px-4 py-3">
                      <p className="font-bold text-slate-800">{ingrediente.insumo_nome}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {Number(ingrediente.quantidade_insumo || 0).toLocaleString('pt-BR')} {ingrediente.unidade_medida || 'un'}
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        Estoque atual: {Number(ingrediente.estoque_atual || 0).toLocaleString('pt-BR')} {ingrediente.unidade_medida || 'un'}
                      </p>
                    </div>
                  ))}
                </div>

                {receita.modo_preparo && (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Modo de preparo</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{receita.modo_preparo}</p>
                  </div>
                )}

                {receita.observacoes && <p className="mt-3 text-sm text-slate-600">{receita.observacoes}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-slate-900 p-3 text-white">
            <Store size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Status das Lojas iFood</h2>
            <p className="text-sm text-slate-500">Abrir e fechar operacao usando a Merchant API.</p>
          </div>
        </div>

        <div className="space-y-4">
          {merchants.length === 0 && (
            <div className="rounded-2xl bg-slate-50 px-5 py-6 text-slate-500">Nenhum merchant vinculado ao token atual.</div>
          )}

          {merchants.map((merchant) => {
            const merchantData = statusByMerchant[merchant.id] || {}
            const state = merchantData.status?.state || 'DESCONHECIDO'
            const interruptions = merchantData.interruptions || []
            const reopenableId = merchantData.status?.reopenable?.identifier || interruptions[0]?.id
            const canOpen = Boolean(reopenableId)

            return (
              <div key={merchant.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{merchant.name || merchant.id}</h3>
                    <p className="text-sm text-slate-500">{merchant.id}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-4 py-2 text-sm font-bold ${statusTone(state)}`}>{state}</span>
                    <button
                      onClick={() => atualizarLoja(merchant.id, 'open', reopenableId)}
                      disabled={!canOpen || updatingMerchantId === merchant.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <ToggleRight size={18} />
                      Abrir loja
                    </button>
                    <button
                      onClick={() => atualizarLoja(merchant.id, 'close')}
                      disabled={updatingMerchantId === merchant.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <ToggleLeft size={18} />
                      Fechar loja
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mensagem</p>
                    <p className="mt-1 text-sm text-slate-700">{merchantData.status?.message || 'Sem alertas no momento.'}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Interrupcoes</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {interruptions.length > 0 ? `${interruptions.length} interrupcao(oes) ativa(s)` : 'Nenhuma interrupcao ativa'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <Link2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Gerenciador de Mapeamentos iFood</h2>
            <p className="text-sm text-slate-500">Vincule o `merchant_item_id` do iFood ao produto local usado no sistema.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={salvarMapeamento} className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Merchant</span>
              {merchantLookupDisponivel ? (
                <select
                  required
                  value={mappingForm.merchant_id}
                  onChange={(event) => onChangeMappingForm('merchant_id', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
                >
                  <option value="">Selecione um merchant</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name || merchant.id}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    required
                    type="text"
                    value={mappingForm.merchant_id}
                    onChange={(event) => onChangeMappingForm('merchant_id', event.target.value)}
                    placeholder="Digite manualmente o merchant_id (UUID)"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
                  />
                  <p className="mt-2 text-xs text-amber-600">
                    Consulta de merchants indisponivel com o token atual. Use o identificador manualmente para o teste.
                  </p>
                </>
              )}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">merchant_item_id</span>
              <input
                required
                type="text"
                value={mappingForm.merchant_item_id}
                onChange={(event) => onChangeMappingForm('merchant_item_id', event.target.value)}
                placeholder="Ex: BRIGADEIRO-TRAD-001"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Produto local</span>
              <select
                required
                value={mappingForm.produto_id}
                onChange={(event) => onChangeMappingForm('produto_id', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
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
              <span className="mb-2 block text-sm font-bold text-slate-700">Observacao</span>
              <input
                type="text"
                value={mappingForm.observacao}
                onChange={(event) => onChangeMappingForm('observacao', event.target.value)}
                placeholder="Opcional"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400"
              />
            </label>

            <button
              type="submit"
              disabled={submittingMapping}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submittingMapping ? <Loader2 className="animate-spin" size={22} /> : <Link2 size={22} />}
              Salvar mapeamento
            </button>
          </form>

          <div className="space-y-4">
            {mapeamentos.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-6 text-slate-500">
                Nenhum mapeamento cadastrado ainda.
              </div>
            )}

            {mapeamentos.map((mapping) => (
              <div key={mapping.id || `${mapping.merchant_id}-${mapping.merchant_item_id}`} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{mapping.merchant_item_id}</p>
                    <p className="text-sm text-slate-500">{mapping.merchant_id}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                    {mapping.produto_nome || mapping.produto_id}
                  </span>
                </div>

                {mapping.observacao && <p className="mt-3 text-sm text-slate-600">{mapping.observacao}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Resumo rapido do estoque</h2>
            <p className="text-sm text-slate-500">Visao dos insumos disponiveis para recebimento e conferencia.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insumos.map((item) => (
            <div key={item.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">{item.produtos?.nome || 'Insumo sem nome'}</p>
              <p className="mt-1 text-sm text-slate-500">Alerta minimo: {item.alerta_minimo || 0} {item.unidade_medida || 'un'}</p>
              <p className="mt-4 text-3xl font-bold text-emerald-600">
                {Number(item.quantidade_atual || 0).toLocaleString('pt-BR')}
                <span className="ml-2 text-sm font-medium text-slate-400">{item.unidade_medida || 'un'}</span>
              </p>
              <p className="mt-2 text-sm text-slate-500">Custo referencial: {currency(item.custo_medio)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Administracao
