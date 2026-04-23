import { useEffect, useState } from 'react'
import { Loader2, Package2, PencilLine, PlusCircle, Tag } from 'lucide-react'

import { apiFetch, currency } from '../lib/api'

const FORM_INICIAL = {
  id: '',
  nome: '',
  preco: '',
  ativo: true,
}

function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [produtoDestaqueId, setProdutoDestaqueId] = useState('')

  const carregarProdutos = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/produtos?ativos_apenas=false')
      const lista = Array.isArray(data) ? data : []
      setProdutos(lista)

      const destaqueId = window.sessionStorage.getItem('confeitaria:produto-destaque')
      if (destaqueId) {
        setProdutoDestaqueId(destaqueId)
        const destaque = lista.find((item) => item.id === destaqueId)
        if (destaque) {
          setForm({
            id: destaque.id,
            nome: destaque.nome || '',
            preco: destaque.preco ?? '',
            ativo: Boolean(destaque.ativo),
          })
          setMensagem(`Produto ${destaque.nome} veio da aba de receitas e foi destacado aqui.`)
        }
        window.sessionStorage.removeItem('confeitaria:produto-destaque')
      } else {
        setProdutoDestaqueId('')
        setMensagem('')
      }
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarProdutos()
  }, [])

  const onChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const editarProduto = (produto) => {
    setForm({
      id: produto.id,
      nome: produto.nome || '',
      preco: produto.preco ?? '',
      ativo: Boolean(produto.ativo),
    })
    setMensagem('')
  }

  const limparForm = () => {
    setForm(FORM_INICIAL)
  }

  const salvarProduto = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMensagem('')

    try {
      if (form.id) {
        await apiFetch(`/api/produtos/${form.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: form.nome,
            preco: Number(form.preco || 0),
            ativo: Boolean(form.ativo),
          }),
        })
        setMensagem('Produto atualizado com sucesso.')
      } else {
        await apiFetch('/api/produtos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: form.nome,
            preco: Number(form.preco || 0),
            ativo: Boolean(form.ativo),
          }),
        })
        setMensagem('Produto cadastrado com sucesso.')
      }

      limparForm()
      await carregarProdutos()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(254,215,170,0.36),_transparent_34%),linear-gradient(135deg,_#fff7ed,_#fff1f2_45%,_#fffbeb)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
                <Tag size={14} />
                Cardapio e precos
              </p>
              <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Produtos de venda</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Aqui voce define nome, preco e disponibilidade dos itens que aparecem no balcao.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-amber-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">Ativos</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">{produtos.filter((item) => item.ativo).length}</p>
              </div>
              <div className="rounded-3xl bg-rose-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Sem receita</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">
                  {produtos.filter((item) => !item.tem_receita).length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {mensagem && (
          <div className="mb-6 rounded-3xl border border-amber-100 bg-white/85 px-5 py-4 text-sm font-medium text-stone-700 shadow-sm">
            {mensagem}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.25fr]">
          <form onSubmit={salvarProduto} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                {form.id ? <PencilLine size={22} /> : <PlusCircle size={22} />}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">{form.id ? 'Editar produto' : 'Novo produto'}</h2>
                <p className="text-sm text-stone-500">Preco e status do item de venda.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Nome do produto</span>
                <input
                  required
                  type="text"
                  value={form.nome}
                  onChange={(event) => onChange('nome', event.target.value)}
                  placeholder="Ex: Brigadeiro gourmet"
                  className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-stone-800"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-stone-700">Preco de venda</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.preco}
                  onChange={(event) => onChange('preco', event.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-stone-800"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-4 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => onChange('ativo', event.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600"
                />
                Exibir este produto no balcao
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Package2 size={20} />}
                {form.id ? 'Salvar alteracoes' : 'Cadastrar produto'}
              </button>

              {form.id && (
                <button
                  type="button"
                  onClick={limparForm}
                  className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-stone-600 shadow-sm transition hover:bg-stone-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Cardapio cadastrado</h2>
                <p className="text-sm text-stone-500">Clique em um item para editar o preco ou desativar do balcao.</p>
              </div>
              <button
                onClick={carregarProdutos}
                className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
              >
                Recarregar
              </button>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              </div>
            ) : produtos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/70 px-6 py-10 text-center text-stone-500">
                Nenhum produto cadastrado ainda.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {produtos.map((produto) => (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => editarProduto(produto)}
                    className={`rounded-3xl border bg-[linear-gradient(135deg,_rgba(255,247,237,0.95),_rgba(255,255,255,0.98))] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      produto.id === produtoDestaqueId
                        ? 'border-rose-300 ring-2 ring-rose-200'
                        : 'border-amber-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-serif text-2xl text-stone-900">{produto.nome}</p>
                        <p className="mt-2 text-sm text-stone-500">{currency(produto.preco)}</p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-stone-400">
                          {produto.tem_receita
                            ? `${produto.total_ingredientes || 0} ingrediente(s) na ficha`
                            : 'Sem ficha tecnica'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${
                            produto.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {produto.ativo ? 'Ativo' : 'Oculto'}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${
                            produto.tem_receita ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {produto.tem_receita ? 'Com receita' : 'Sem receita'}
                        </span>
                        {produto.id === produtoDestaqueId && (
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-700">
                            Novo pela receita
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default Produtos
