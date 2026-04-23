import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, PackageCheck, RefreshCcw } from 'lucide-react'

import { apiFetch, currency } from '../lib/api'

function formatarHora(dataString) {
  return new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarTempo(dataString) {
  const diferencaMs = Date.now() - new Date(dataString).getTime()
  const minutos = Math.max(1, Math.floor(diferencaMs / 60000))

  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const minutosRestantes = minutos % 60
  return `${horas}h ${minutosRestantes}min`
}

function ticketTone(index) {
  const tones = [
    'from-rose-100 via-white to-orange-50 border-rose-200',
    'from-amber-100 via-white to-yellow-50 border-amber-200',
    'from-orange-100 via-white to-rose-50 border-orange-200',
  ]
  return tones[index % tones.length]
}

function FilaPedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [erro, setErro] = useState('')

  const buscarPedidos = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const data = await apiFetch('/api/pedidos?status=pendente')
      setPedidos(Array.isArray(data) ? data : [])
      setErro('')
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
      setErro(error.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    buscarPedidos()

    const interval = window.setInterval(() => {
      buscarPedidos(true)
    }, 15000)

    return () => window.clearInterval(interval)
  }, [])

  const concluirPedido = async (id) => {
    setUpdatingId(id)
    setErro('')

    try {
      await apiFetch(`/api/pedidos/${id}/concluir`, {
        method: 'POST',
      })

      setPedidos((current) => current.filter((pedido) => pedido.id !== id))
    } catch (error) {
      console.error('Erro ao concluir pedido:', error)
      setErro(error.message)
    } finally {
      setUpdatingId('')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-100">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(251,207,232,0.35),_transparent_35%),linear-gradient(135deg,_#fff7ed,_#fff1f2_45%,_#fffbeb)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-rose-700">
                <PackageCheck size={14} />
                Saida de pedidos
              </p>
              <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Pedidos para concluir</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Aqui ficam os pedidos abertos do balcao e do iFood. Ao concluir, o sistema baixa o estoque de produtos prontos.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-rose-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Pendentes</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">{pedidos.length}</p>
              </div>
              <div className="rounded-3xl bg-amber-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">Maior espera</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">
                  {pedidos[0]?.criado_em ? formatarTempo(pedidos[0].criado_em) : '--'}
                </p>
              </div>
              <button
                onClick={() => buscarPedidos(true)}
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-stone-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-stone-800"
              >
                {refreshing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
                Atualizar
              </button>
            </div>
          </div>

          {erro && (
            <div className="mt-6 rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {erro}
            </div>
          )}
        </section>

        {pedidos.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-rose-200 bg-white/70 px-8 text-center shadow-[0_18px_60px_rgba(244,114,182,0.08)]">
            <Clock3 size={64} className="mb-4 text-rose-300" />
            <h2 className="font-serif text-3xl text-stone-900">Nenhum pedido pendente</h2>
            <p className="mt-3 max-w-md text-stone-500">Quando uma venda entrar no balcao ou no iFood, ela aparece aqui para expedicao.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pedidos.map((pedido, index) => (
              <article
                key={pedido.id}
                className={`rounded-[2rem] border bg-gradient-to-br p-6 shadow-[0_18px_60px_rgba(120,53,15,0.12)] ${ticketTone(index)}`}
              >
                <div className="mb-5 flex items-start justify-between gap-4 border-b border-stone-200/80 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-stone-500">{pedido.origem}</p>
                    <h2 className="mt-2 font-serif text-2xl text-stone-900">
                      Pedido {pedido.referencia_externa || pedido.id.slice(0, 8)}
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Total</p>
                    <p className="mt-1 text-xl font-bold text-emerald-700">{currency(pedido.valor_total)}</p>
                  </div>
                </div>

                <div className="mb-5 flex items-center justify-between rounded-3xl bg-white/80 px-4 py-3 text-sm font-medium text-stone-600 shadow-sm">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 size={16} className="text-rose-500" />
                    {formatarHora(pedido.criado_em)}
                  </span>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-rose-700">
                    aguardando ha {formatarTempo(pedido.criado_em)}
                  </span>
                </div>

                <ul className="space-y-3">
                  {pedido.itens_pedido?.map((item, itemIndex) => (
                    <li
                      key={`${pedido.id}-${itemIndex}`}
                      className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 font-bold text-rose-700">
                        {item.quantidade}x
                      </span>
                      <div>
                        <p className="font-semibold text-stone-900">{item.produtos?.nome || 'Produto indisponivel'}</p>
                        <p className="text-sm text-stone-500">{currency(item.preco_unitario)} por unidade</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => concluirPedido(pedido.id)}
                  disabled={updatingId === pedido.id}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-stone-900 px-5 py-4 text-lg font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {updatingId === pedido.id ? <Loader2 className="animate-spin" size={22} /> : <CheckCircle2 size={22} />}
                  Concluir pedido
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FilaPedidos
