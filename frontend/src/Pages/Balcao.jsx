import { useEffect, useState } from 'react'
import { Loader2, Minus, PackageCheck, Plus, ShoppingBasket, Sparkles, Trash2 } from 'lucide-react'

import { getApiBaseUrl } from '../config'

const cardTones = [
  'from-rose-100 via-white to-orange-50 border-rose-200',
  'from-amber-100 via-white to-yellow-50 border-amber-200',
  'from-orange-100 via-white to-rose-50 border-orange-200',
  'from-pink-100 via-white to-rose-50 border-pink-200',
]

function Balcao() {
  const [produtos, setProdutos] = useState([])
  const [carrinho, setCarrinho] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/produtos`)
      .then((res) => res.json())
      .then((data) => {
        setProdutos(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((error) => {
        console.error('Erro ao carregar produtos:', error)
        setLoading(false)
      })
  }, [])

  const adicionarAoCarrinho = (produto) => {
    const existe = carrinho.find((item) => item.produto_id === produto.id)
    if (existe) {
      setCarrinho(
        carrinho.map((item) =>
          item.produto_id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item,
        ),
      )
    } else {
      setCarrinho([
        ...carrinho,
        {
          produto_id: produto.id,
          nome: produto.nome,
          preco_unitario: produto.preco,
          quantidade: 1,
        },
      ])
    }
  }

  const aumentarQuantidade = (produtoId) => {
    setCarrinho(
      carrinho.map((item) =>
        item.produto_id === produtoId ? { ...item, quantidade: item.quantidade + 1 } : item,
      ),
    )
  }

  const diminuirQuantidade = (produtoId) => {
    setCarrinho(
      carrinho
        .map((item) => (item.produto_id === produtoId ? { ...item, quantidade: item.quantidade - 1 } : item))
        .filter((item) => item.quantidade > 0),
    )
  }

  const finalizarPedido = async () => {
    if (carrinho.length === 0) return
    setEnviando(true)

    const total = carrinho.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0)

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: 'Tablet Balcao',
          valor_total: total,
          itens: carrinho,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail || 'Nao foi possivel registrar o pedido.')
      }

      alert('Pedido enviado com sucesso!')
      setCarrinho([])
    } catch (error) {
      console.error('Erro ao enviar pedido:', error)
      alert(error.message || 'Erro ao conectar com o servidor.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-100">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
      </div>
    )
  }

  const totalCarrinho = carrinho.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0)

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(251,207,232,0.36),_transparent_30%),linear-gradient(135deg,_#fff7ed,_#fff1f2_46%,_#fffbeb)] p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row">
        <div className="min-w-0 flex-1">
          <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-rose-700">
                  <Sparkles size={14} />
                  Vendas do dia
                </p>
                <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Balcao da confeitaria</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  Catalogo visual para atendimento rapido, com clima mais acolhedor e foco na finalizacao de pedidos.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-rose-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Produtos</p>
                  <p className="mt-2 text-3xl font-bold text-stone-900">{produtos.length}</p>
                </div>
                <div className="rounded-3xl bg-amber-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">Itens na sacola</p>
                  <p className="mt-2 text-3xl font-bold text-stone-900">
                    {carrinho.reduce((acc, item) => acc + item.quantidade, 0)}
                  </p>
                </div>
                <div className="rounded-3xl bg-emerald-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Total parcial</p>
                  <p className="mt-2 text-3xl font-bold text-stone-900">R$ {totalCarrinho.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {produtos.map((produto, index) => (
              <button
                key={produto.id}
                onClick={() => adicionarAoCarrinho(produto)}
                className={`group rounded-[2rem] border bg-gradient-to-br p-6 text-left shadow-[0_18px_60px_rgba(120,53,15,0.12)] transition hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(244,114,182,0.18)] ${cardTones[index % cardTones.length]}`}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/80 text-2xl font-bold text-rose-700 shadow-sm">
                    {produto.nome?.[0] || 'D'}
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-stone-500">
                    doce
                  </span>
                </div>
                <h2 className="font-serif text-3xl leading-tight text-stone-900">{produto.nome}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-500">Toque para adicionar na sacola de atendimento.</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-2xl font-bold text-emerald-700">R$ {Number(produto.preco || 0).toFixed(2)}</span>
                  <span className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition group-hover:bg-rose-600">
                    Adicionar
                  </span>
                </div>
              </button>
            ))}
          </section>
        </div>

        <aside className="w-full shrink-0 xl:w-[380px]">
          <div className="sticky top-8 rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-500">Sacola</p>
                <h2 className="mt-1 font-serif text-3xl text-stone-900">Pedido atual</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <ShoppingBasket size={22} />
              </div>
            </div>

            {carrinho.length > 0 && (
              <button
                onClick={() => setCarrinho([])}
                className="mb-5 inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100"
              >
                <Trash2 size={18} />
                Limpar pedido
              </button>
            )}

            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {carrinho.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-rose-200 bg-rose-50/70 px-6 py-10 text-center text-stone-500">
                  <p className="font-serif text-2xl text-stone-900">Sacola vazia</p>
                  <p className="mt-2 text-sm">Escolha um doce do cardapio ao lado para montar o pedido.</p>
                </div>
              ) : (
                carrinho.map((item) => (
                  <div key={item.produto_id} className="rounded-[1.75rem] border border-rose-100 bg-rose-50/70 p-4 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-stone-900">{item.nome}</p>
                        <p className="mt-1 text-sm text-emerald-700">
                          R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
                        {item.quantidade} un
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                      <button
                        onClick={() => diminuirQuantidade(item.produto_id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="text-lg font-bold text-stone-900">{item.quantidade}</span>
                      <button
                        onClick={() => aumentarQuantidade(item.produto_id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 transition hover:bg-rose-200"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-rose-100 pt-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-base font-medium text-stone-500">Total do pedido</span>
                <span className="text-3xl font-bold text-emerald-700">R$ {totalCarrinho.toFixed(2)}</span>
              </div>

              <button
                onClick={finalizarPedido}
                disabled={carrinho.length === 0 || enviando}
                className={`inline-flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-5 text-xl font-bold transition ${
                  carrinho.length > 0
                    ? 'bg-stone-900 text-white shadow-[0_18px_50px_rgba(68,24,34,0.18)] hover:bg-rose-600'
                    : 'cursor-not-allowed bg-stone-200 text-stone-400'
                }`}
              >
                {enviando ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <>
                    <PackageCheck className="h-7 w-7" />
                    Finalizar pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Balcao
