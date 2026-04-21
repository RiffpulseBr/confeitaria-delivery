import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, PackageCheck, PackageSearch } from 'lucide-react'

import { getApiBaseUrl } from '../config'

function Estoque() {
  const [itensEstoque, setItensEstoque] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscarEstoque()
  }, [])

  const buscarEstoque = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/estoque/insumos`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'Falha ao carregar estoque.')
      setItensEstoque(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar estoque:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin w-12 h-12 text-slate-400" />
      </div>
    )
  }

  return (
    <div className="h-full bg-slate-50 p-8 flex flex-col">
      <header className="mb-8 flex items-center gap-3 text-slate-800">
        <PackageSearch size={40} className="text-emerald-500" />
        <h1 className="text-4xl font-bold">Controle de Estoque</h1>
      </header>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-12 gap-4 p-6 bg-slate-800 text-white font-bold text-lg uppercase tracking-wider">
          <div className="col-span-6">Produto</div>
          <div className="col-span-3 text-center">Status</div>
          <div className="col-span-3 text-right">Quantidade Atual</div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {itensEstoque.map((item) => {
            const qtd = Number(item.quantidade_atual)
            const min = Number(item.alerta_minimo)

            const nivelCritico = qtd <= min / 2
            const nivelAtencao = qtd > min / 2 && qtd <= min

            return (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-4 p-4 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="col-span-6 font-bold text-xl text-slate-700">
                  {item.nome || 'Insumo Desconhecido'}
                </div>

                <div className="col-span-3 flex justify-center">
                  {nivelCritico ? (
                    <span className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">
                      <AlertTriangle size={16} /> Comprar Urgente
                    </span>
                  ) : nivelAtencao ? (
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-bold">
                      <AlertTriangle size={16} /> Estoque Baixo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                      <PackageCheck size={16} /> Adequado
                    </span>
                  )}
                </div>

                <div className="col-span-3 text-right">
                  <span className={`text-3xl font-bold ${nivelCritico ? 'text-red-500' : 'text-slate-800'}`}>
                    {item.quantidade_atual}{' '}
                    <span className="text-sm text-slate-400 font-medium">{item.unidade_medida || 'un'}</span>
                  </span>
                </div>
              </div>
            )
          })}

          {itensEstoque.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xl">Nenhum registro de estoque encontrado.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Estoque
