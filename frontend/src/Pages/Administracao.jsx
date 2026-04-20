import { useCallback, useEffect, useState } from 'react'
import { Link2, Loader2, PackagePlus, RefreshCcw, Store, ToggleLeft, ToggleRight } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL

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

function Administracao() {
  const [insumos, setInsumos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [merchants, setMerchants] = useState([])
  const [statusByMerchant, setStatusByMerchant] = useState({})
  const [mapeamentos, setMapeamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [submittingStock, setSubmittingStock] = useState(false)
  const [submittingMapping, setSubmittingMapping] = useState(false)
  const [updatingMerchantId, setUpdatingMerchantId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [merchantLookupDisponivel, setMerchantLookupDisponivel] = useState(true)
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

  const carregarDados = useCallback(async () => {
    setLoading(true)
    setMensagem('')

    try {
      const [insumosRes, merchantsRes] = await Promise.all([
        fetch(`${API_URL}/api/estoque/insumos`),
        fetch(`${API_URL}/api/ifood/merchants`),
      ])

      const [insumosData, merchantsData] = await Promise.all([insumosRes.json(), merchantsRes.json()])
      const merchantList = Array.isArray(merchantsData) ? merchantsData : []
      setMerchantLookupDisponivel(merchantsRes.ok && merchantList.length > 0)

      setInsumos(Array.isArray(insumosData) ? insumosData : [])
      setMerchants(merchantList)
      if (!mappingForm.merchant_id && merchantList[0]?.id) {
        setMappingForm((current) => ({ ...current, merchant_id: merchantList[0].id }))
      }

      if (merchantList.length > 0) {
        const statuses = await Promise.all(
          merchantList.map(async (merchant) => {
            try {
              const response = await fetch(`${API_URL}/api/ifood/merchants/${merchant.id}/status`)
              const data = await response.json()
              return [merchant.id, data]
            } catch {
              return [merchant.id, { status: { state: 'ERROR', message: 'Falha ao consultar status.' }, interruptions: [] }]
            }
          }),
        )

        setStatusByMerchant(Object.fromEntries(statuses))
      } else {
        setStatusByMerchant({})
      }
    } catch {
      setMerchantLookupDisponivel(false)
      setMensagem('Nao foi possivel carregar os dados administrativos.')
    } finally {
      setLoading(false)
    }
  }, [mappingForm.merchant_id])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    const carregarBaseAdmin = async () => {
      try {
        const [produtosRes, mappingsRes] = await Promise.all([
          fetch(`${API_URL}/api/produtos`),
          fetch(`${API_URL}/api/ifood/item-mappings`),
        ])

        const [produtosData, mappingsData] = await Promise.all([produtosRes.json(), mappingsRes.json()])
        setProdutos(Array.isArray(produtosData) ? produtosData : [])
        setMapeamentos(Array.isArray(mappingsData) ? mappingsData : [])
      } catch {
        setMensagem('Nao foi possivel carregar os produtos e mapeamentos iFood.')
      }
    }

    carregarBaseAdmin()
  }, [])

  const onChangeForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onChangeMappingForm = (field, value) => {
    setMappingForm((current) => ({ ...current, [field]: value }))
  }

  const registrarEntrada = async (event) => {
    event.preventDefault()
    setSubmittingStock(true)
    setMensagem('')

    try {
      const response = await fetch(`${API_URL}/api/estoque/entrada`, {
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Nao foi possivel registrar a entrada.')
      }

      setMensagem('Entrada de mercadoria registrada com sucesso.')
      setForm({
        estoque_id: '',
        quantidade: '',
        custo_unitario: '',
        documento: '',
        observacao: '',
      })
      await carregarDados()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingStock(false)
    }
  }

  const atualizarLoja = async (merchantId, action, interruptionId) => {
    setUpdatingMerchantId(merchantId)
    setMensagem('')

    try {
      const response = await fetch(`${API_URL}/api/ifood/merchants/${merchantId}/${action}`, {
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Nao foi possivel atualizar a loja.')
      }

      setMensagem(action === 'close' ? 'Solicitacao de fechamento enviada.' : 'Solicitacao de abertura enviada.')
      await carregarDados()
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
      const response = await fetch(`${API_URL}/api/ifood/item-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: mappingForm.merchant_id,
          merchant_item_id: mappingForm.merchant_item_id,
          produto_id: mappingForm.produto_id,
          observacao: mappingForm.observacao || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Nao foi possivel salvar o mapeamento.')
      }

      setMensagem('Mapeamento iFood salvo com sucesso.')
      setMappingForm((current) => ({
        ...current,
        merchant_item_id: '',
        produto_id: '',
        observacao: '',
      }))

      const mappingsRes = await fetch(`${API_URL}/api/ifood/item-mappings`)
      const mappingsData = await mappingsRes.json()
      setMapeamentos(Array.isArray(mappingsData) ? mappingsData : [])
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingMapping(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Administracao</h1>
          <p className="mt-2 text-slate-500">Entrada de insumos e operacao da loja no iFood.</p>
        </div>

        <button
          onClick={carregarDados}
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
      </div>

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
          <form onSubmit={salvarMapeamento} className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4">
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
