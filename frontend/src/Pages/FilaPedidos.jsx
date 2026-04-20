import { useEffect, useState } from 'react'
import { CheckCircle2, ChefHat, Clock, Loader2 } from 'lucide-react'

import { supabase } from '../supabaseClient'

function FilaPedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscarPedidos()

    const subscription = supabase
      .channel('pedidos_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        buscarPedidos()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  const buscarPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          origem,
          status,
          valor_total,
          criado_em,
          itens_pedido (
            quantidade,
            produtos (nome)
          )
        `)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true })

      if (error) throw error
      setPedidos(data || [])
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const concluirPedido = async (id) => {
    try {
      const { error } = await supabase.from('pedidos').update({ status: 'concluido' }).eq('id', id)

      if (error) throw error
    } catch (error) {
      alert('Erro ao atualizar o pedido.')
      console.error(error)
    }
  }

  const formatarHora = (dataString) =>
    new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin w-12 h-12 text-slate-400" />
      </div>
    )
  }

  return (
    <div className="h-full bg-slate-100 p-8 flex flex-col">
      <header className="mb-8 flex items-center gap-3 text-slate-800">
        <ChefHat size={40} className="text-emerald-500" />
        <h1 className="text-4xl font-bold">Fila de Producao</h1>
      </header>

      {pedidos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Clock size={64} className="mb-4 opacity-50" />
          <h2 className="text-2xl font-semibold">Nenhum pedido pendente</h2>
          <p>A cozinha esta tranquila no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pb-8">
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="bg-white rounded-3xl shadow-lg border-t-8 border-amber-400 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider">
                    {pedido.origem}
                  </span>
                  <p className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                    <Clock size={14} /> {formatarHora(pedido.criado_em)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Total</p>
                  <p className="font-bold text-emerald-600 text-lg">R$ {pedido.valor_total.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex-1 mb-6">
                <ul className="space-y-3">
                  {pedido.itens_pedido.map((item, index) => (
                    <li key={`${pedido.id}-${index}`} className="flex items-center gap-3 text-lg text-slate-700 font-medium">
                      <span className="bg-amber-100 text-amber-700 w-8 h-8 rounded-lg flex items-center justify-center font-bold">
                        {item.quantidade}x
                      </span>
                      {item.produtos?.nome || 'Produto Indisponivel'}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => concluirPedido(pedido.id)}
                className="w-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={24} />
                Marcar como Pronto
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FilaPedidos
