import { useEffect, useState } from 'react'
import { Link2, Loader2, RefreshCcw, Store, ToggleLeft, ToggleRight } from 'lucide-react'

import { apiFetch } from '../lib/api'

function statusTone(state) {
  if (state === 'OK') return 'bg-emerald-100 text-emerald-700'
  if (state === 'WARNING') return 'bg-amber-100 text-amber-700'
  if (state === 'ERROR') return 'bg-red-100 text-red-700'
  return 'bg-stone-200 text-stone-700'
}

function Ifood() {
  const [produtos, setProdutos] = useState([])
  const [merchants, setMerchants] = useState([])
  const [statusByMerchant, setStatusByMerchant] = useState({})
  const [mapeamentos, setMapeamentos] = useState([])
  const [merchantLookupDisponivel, setMerchantLookupDisponivel] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingMerchantId, setUpdatingMerchantId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [mappingForm, setMappingForm] = useState({
    merchant_id: '',
    merchant_item_id: '',
    produto_id: '',
    observacao: '',
  })

  const carregarPainel = async () => {
    setLoading(true)
    try {
      const produtosData = await apiFetch('/api/produtos?ativos_apenas=false')
      setProdutos(Array.isArray(produtosData) ? produtosData : [])

      let merchantsData = []
      try {
        merchantsData = await apiFetch('/api/ifood/merchants')
      } catch {
        merchantsData = []
        setMerchantLookupDisponivel(false)
      }

      const mappingsData = await apiFetch('/api/ifood/item-mappings')
      setMerchants(Array.isArray(merchantsData) ? merchantsData : [])
      setMapeamentos(Array.isArray(mappingsData) ? mappingsData : [])

      if (Array.isArray(merchantsData) && merchantsData.length > 0) {
        setMerchantLookupDisponivel(true)
        setMappingForm((current) => ({
          ...current,
          merchant_id: current.merchant_id || merchantsData[0].id || '',
        }))

        const statuses = await Promise.all(
          merchantsData.map(async (merchant) => {
            try {
              const data = await apiFetch(`/api/ifood/merchants/${merchant.id}/status`)
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

      setMensagem('')
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPainel()
  }, [])

  const onChange = (field, value) => {
    setMappingForm((current) => ({ ...current, [field]: value }))
  }

  const salvarMapeamento = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setMensagem('')

    try {
      await apiFetch('/api/ifood/item-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: mappingForm.merchant_id,
          merchant_item_id: mappingForm.merchant_item_id,
          produto_id: mappingForm.produto_id,
          observacao: mappingForm.observacao || null,
        }),
      })

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
      setSubmitting(false)
    }
  }

  const atualizarLoja = async (merchantId, action, interruptionId) => {
    setUpdatingMerchantId(merchantId)
    setMensagem('')

    try {
      await apiFetch(`/api/ifood/merchants/${merchantId}/${action}`, {
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
      setMensagem(action === 'close' ? 'Solicitacao de fechamento enviada.' : 'Solicitacao de abertura enviada.')
      await carregarPainel()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setUpdatingMerchantId('')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,_#fff7ed,_#fff1f2_45%,_#fffbeb)]">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(251,207,232,0.25),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#fff1f2_45%,_#fffbeb)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.1)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-rose-700">
                <Store size={14} />
                Integracao externa
              </p>
              <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Painel iFood</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Status da loja e vinculo do cardapio do iFood com os produtos locais do sistema.
              </p>
            </div>

            <button
              onClick={carregarPainel}
              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-stone-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-rose-600"
            >
              <RefreshCcw size={18} />
              Atualizar painel
            </button>
          </div>
        </section>

        {mensagem && (
          <div className="mb-6 rounded-3xl border border-rose-100 bg-white/85 px-5 py-4 text-sm font-medium text-stone-700 shadow-sm">
            {mensagem}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-stone-900 p-3 text-white">
                <Store size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Status das lojas</h2>
                <p className="text-sm text-stone-500">Abrir e fechar operacao usando a Merchant API.</p>
              </div>
            </div>

            <div className="space-y-4">
              {merchants.length === 0 && (
                <div className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-6 py-10 text-center text-stone-500">
                  Nenhum merchant disponivel para o token atual.
                </div>
              )}

              {merchants.map((merchant) => {
                const merchantData = statusByMerchant[merchant.id] || {}
                const state = merchantData.status?.state || 'DESCONHECIDO'
                const interruptions = merchantData.interruptions || []
                const reopenableId = merchantData.status?.reopenable?.identifier || interruptions[0]?.id
                const canOpen = Boolean(reopenableId)

                return (
                  <div key={merchant.id} className="rounded-3xl border border-stone-100 bg-[linear-gradient(135deg,_rgba(255,247,237,0.95),_rgba(255,255,255,0.98))] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-stone-900">{merchant.name || merchant.id}</h3>
                        <p className="text-sm text-stone-500">{merchant.id}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-4 py-2 text-sm font-bold ${statusTone(state)}`}>{state}</span>
                        <button
                          onClick={() => atualizarLoja(merchant.id, 'open', reopenableId)}
                          disabled={!canOpen || updatingMerchantId === merchant.id}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                        >
                          <ToggleRight size={18} />
                          Abrir
                        </button>
                        <button
                          onClick={() => atualizarLoja(merchant.id, 'close')}
                          disabled={updatingMerchantId === merchant.id}
                          className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                        >
                          <ToggleLeft size={18} />
                          Fechar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <Link2 size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Mapeamentos iFood</h2>
                <p className="text-sm text-stone-500">Vincule `merchant_item_id` ao produto local.</p>
              </div>
            </div>

            <form onSubmit={salvarMapeamento} className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Merchant</span>
                {merchantLookupDisponivel ? (
                  <select
                    required
                    value={mappingForm.merchant_id}
                    onChange={(event) => onChange('merchant_id', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-stone-800"
                  >
                    <option value="">Selecione um merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name || merchant.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    type="text"
                    value={mappingForm.merchant_id}
                    onChange={(event) => onChange('merchant_id', event.target.value)}
                    placeholder="Digite o merchant_id manualmente"
                    className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-stone-800"
                  />
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">merchant_item_id</span>
                <input
                  required
                  type="text"
                  value={mappingForm.merchant_item_id}
                  onChange={(event) => onChange('merchant_item_id', event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-stone-800"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Produto local</span>
                <select
                  required
                  value={mappingForm.produto_id}
                  onChange={(event) => onChange('produto_id', event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-stone-800"
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
                <span className="mb-2 block text-sm font-bold text-stone-700">Observacao</span>
                <input
                  type="text"
                  value={mappingForm.observacao}
                  onChange={(event) => onChange('observacao', event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-stone-800"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <Link2 size={20} />}
                Salvar mapeamento
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {mapeamentos.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-emerald-200 bg-white px-6 py-10 text-center text-stone-500">
                  Nenhum mapeamento cadastrado ainda.
                </div>
              ) : (
                mapeamentos.map((mapeamento) => (
                  <div key={mapeamento.id} className="rounded-3xl bg-white px-5 py-4 shadow-sm">
                    <p className="font-bold text-stone-900">{mapeamento.produto_nome || 'Produto sem nome'}</p>
                    <p className="mt-1 text-sm text-stone-500">{mapeamento.merchant_item_id}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-stone-400">{mapeamento.merchant_id}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Ifood
