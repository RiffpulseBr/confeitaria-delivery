import { useEffect, useState } from 'react'
import { Loader2, Minus, PackageCheck, Plus, ShoppingBasket, Trash2 } from 'lucide-react'

function Balcao() {
  const [produtos, setProdutos] = useState([])
  const [carrinho, setCarrinho] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/produtos`)
      .then((res) => res.json())
      .then((data) => {
        setProdutos(data)
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

  const aumentarQuantidade = (produto_id) => {
    setCarrinho(
      carrinho.map((item) =>
        item.produto_id === produto_id ? { ...item, quantidade: item.quantidade + 1 } : item,
      ),
    )
  }

  const diminuirQuantidade = (produto_id) => {
    setCarrinho(
      carrinho
        .map((item) => {
          if (item.produto_id === produto_id) {
            return { ...item, quantidade: item.quantidade - 1 }
          }
          return item
        })
        .filter((item) => item.quantidade > 0),
    )
  }

  const finalizarPedido = async () => {
    if (carrinho.length === 0) return
    setEnviando(true)

    const total = carrinho.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0)

    const pedidoCompleto = {
      origem: 'Tablet Balcao',
      valor_total: total,
      itens: carrinho,
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedidoCompleto),
      })

      if (res.ok) {
        alert('Pedido enviado com sucesso!')
        setCarrinho([])
      } else {
        alert('Nao foi possivel registrar o pedido.')
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error)
      alert('Erro ao conectar com o servidor.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-12 h-12 text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <div className="flex-1 p-6 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto content-start">
        {produtos.map((prod) => (
          <button
            key={prod.id}
            onClick={() => adicionarAoCarrinho(prod)}
            className="bg-white p-6 rounded-3xl shadow-sm border-2 border-transparent active:border-emerald-500 active:scale-95 transition-all flex flex-col items-center text-center h-48 justify-center"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full mb-4 flex items-center justify-center text-emerald-600 text-2xl font-bold">
              {prod.nome[0]}
            </div>
            <span className="text-xl font-bold text-slate-800 leading-tight mb-2">{prod.nome}</span>
            <span className="text-emerald-600 font-medium text-lg">R$ {prod.preco.toFixed(2)}</span>
          </button>
        ))}
      </div>

      <div className="w-full lg:w-[450px] bg-white shadow-2xl p-6 flex flex-col border-t lg:border-t-0 lg:border-l">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBasket /> Sacola
          </h2>
          {carrinho.length > 0 && (
            <button
              onClick={() => setCarrinho([])}
              className="text-red-500 bg-red-50 p-2 rounded-xl active:scale-95 transition-all"
            >
              <Trash2 size={24} />
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto mb-6 pr-2">
          {carrinho.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">
              <p>Sua sacola esta vazia.</p>
              <p className="text-sm">Toque nos produtos ao lado.</p>
            </div>
          ) : (
            carrinho.map((item) => (
              <div
                key={item.produto_id}
                className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-lg line-clamp-1">{item.nome}</p>
                  <p className="font-bold text-emerald-600">
                    R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => diminuirQuantidade(item.produto_id)}
                    className="bg-slate-100 text-slate-600 p-2 rounded-lg active:bg-slate-200 active:scale-95 transition-all"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="font-bold text-lg w-6 text-center">{item.quantidade}</span>
                  <button
                    onClick={() => aumentarQuantidade(item.produto_id)}
                    className="bg-emerald-100 text-emerald-600 p-2 rounded-lg active:bg-emerald-200 active:scale-95 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4 text-xl">
            <span className="text-slate-500 font-medium">Total:</span>
            <span className="font-bold text-3xl text-emerald-600">
              R$ {carrinho.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0).toFixed(2)}
            </span>
          </div>

          <button
            onClick={finalizarPedido}
            disabled={carrinho.length === 0 || enviando}
            className={`w-full py-6 rounded-2xl text-2xl font-bold flex items-center justify-center gap-3 transition-all ${
              carrinho.length > 0
                ? 'bg-emerald-500 text-white shadow-lg active:scale-95 hover:bg-emerald-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {enviando ? (
              <Loader2 className="animate-spin w-8 h-8" />
            ) : (
              <>
                <PackageCheck className="w-8 h-8" /> Finalizar Pedido
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Balcao
