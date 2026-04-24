import { useEffect, useState } from 'react'
import { FlaskConical, Loader2, PackageCheck, PackagePlus, RefreshCcw } from 'lucide-react'

import { apiFetch, currency } from '../lib/api'

const FORM_INICIAL = {
  nome: '',
  unidade_medida: 'kg',
  quantidade_inicial: '',
  alerta_minimo: '',
  custo_medio: '',
}

const ENTRADA_INICIAL = {
  insumo_id: '',
  quantidade: '',
  custo_unitario: '',
  documento: '',
}

function statusBadge(item) {
  const atual = Number(item.quantidade_atual || 0)
  const alerta = Number(item.alerta_minimo || 0)

  if (atual <= alerta / 2 && alerta > 0) {
    return 'bg-red-100 text-red-700'
  }
  if (atual <= alerta && alerta > 0) {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-emerald-100 text-emerald-700'
}

function statusTexto(item) {
  const atual = Number(item.quantidade_atual || 0)
  const alerta = Number(item.alerta_minimo || 0)

  if (atual <= alerta / 2 && alerta > 0) return 'Comprar urgente'
  if (atual <= alerta && alerta > 0) return 'Atencao'
  return 'Ok'
}

function Insumos() {
  const [insumos, setInsumos] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [entradaForm, setEntradaForm] = useState(ENTRADA_INICIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submittingEntrada, setSubmittingEntrada] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const carregarInsumos = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/estoque/insumos')
      setInsumos(Array.isArray(data) ? data : [])
      setMensagem('')
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarInsumos()
  }, [])

  const onChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onChangeEntrada = (field, value) => {
    setEntradaForm((current) => ({ ...current, [field]: value }))
  }

  const cadastrarInsumo = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMensagem('')

    try {
      await apiFetch('/api/insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          unidade_medida: form.unidade_medida,
          quantidade_inicial: form.quantidade_inicial ? Number(form.quantidade_inicial) : 0,
          alerta_minimo: form.alerta_minimo ? Number(form.alerta_minimo) : 0,
          custo_medio: form.custo_medio ? Number(form.custo_medio) : null,
        }),
      })
      setForm(FORM_INICIAL)
      setMensagem('Insumo cadastrado com sucesso.')
      await carregarInsumos()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSaving(false)
    }
  }

  const registrarEntrada = async (event) => {
    event.preventDefault()
    setSubmittingEntrada(true)
    setMensagem('')

    try {
      await apiFetch('/api/estoque/entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insumo_id: entradaForm.insumo_id,
          quantidade: Number(entradaForm.quantidade),
          custo_unitario: entradaForm.custo_unitario ? Number(entradaForm.custo_unitario) : null,
          documento: entradaForm.documento || null,
        }),
      })

      setEntradaForm(ENTRADA_INICIAL)
      setMensagem('Entrada de mercadoria registrada com sucesso.')
      await carregarInsumos()
    } catch (error) {
      setMensagem(error.message)
    } finally {
      setSubmittingEntrada(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(187,247,208,0.3),_transparent_32%),linear-gradient(135deg,_#f7fee7,_#fffbeb_48%,_#fff7ed)] p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.1)] backdrop-blur">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-emerald-700">
            <FlaskConical size={14} />
            Base de producao
          </p>
          <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Cadastro de insumos</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
            Cadastre leite condensado, chocolate, embalagens e outros itens que alimentam as receitas.
          </p>
        </section>

        {mensagem && (
          <div className="mb-6 rounded-3xl border border-emerald-100 bg-white/85 px-5 py-4 text-sm font-medium text-stone-700 shadow-sm">
            {mensagem}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.1fr]">
          <div className="space-y-8">
            <form onSubmit={cadastrarInsumo} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <PackagePlus size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Novo insumo</h2>
                  <p className="text-sm text-stone-500">Comece o estoque de producao do jeito certo.</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Nome</span>
                  <input
                    required
                    type="text"
                    value={form.nome}
                    onChange={(event) => onChange('nome', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Unidade</span>
                    <select
                      value={form.unidade_medida}
                      onChange={(event) => onChange('unidade_medida', event.target.value)}
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="un">un</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Estoque inicial</span>
                    <input
                      min="0"
                      step="0.001"
                      type="number"
                      value={form.quantidade_inicial}
                      onChange={(event) => onChange('quantidade_inicial', event.target.value)}
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Alerta minimo</span>
                    <input
                      min="0"
                      step="0.001"
                      type="number"
                      value={form.alerta_minimo}
                      onChange={(event) => onChange('alerta_minimo', event.target.value)}
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Custo de referencia</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.custo_medio}
                      onChange={(event) => onChange('custo_medio', event.target.value)}
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <PackagePlus size={20} />}
                Cadastrar insumo
              </button>
            </form>

            <form onSubmit={registrarEntrada} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <PackageCheck size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Entrada de mercadoria</h2>
                  <p className="text-sm text-stone-500">Registre compras e reposicoes de insumos.</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Insumo</span>
                  <select
                    required
                    value={entradaForm.insumo_id}
                    onChange={(event) => onChangeEntrada('insumo_id', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  >
                    <option value="">Selecione um insumo</option>
                    {insumos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome} | Atual: {item.quantidade_atual} {item.unidade_medida || 'un'}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Quantidade recebida</span>
                    <input
                      required
                      min="0.001"
                      step="0.001"
                      type="number"
                      value={entradaForm.quantidade}
                      onChange={(event) => onChangeEntrada('quantidade', event.target.value)}
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-700">Custo unitario</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={entradaForm.custo_unitario}
                      onChange={(event) => onChangeEntrada('custo_unitario', event.target.value)}
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-stone-700">Documento</span>
                  <input
                    type="text"
                    value={entradaForm.documento}
                    onChange={(event) => onChangeEntrada('documento', event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-stone-800"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingEntrada}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-4 text-base font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {submittingEntrada ? <Loader2 className="animate-spin" size={20} /> : <PackageCheck size={20} />}
                Registrar entrada
              </button>
            </form>
          </div>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(120,53,15,0.1)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Insumos cadastrados</h2>
                <p className="text-sm text-stone-500">Visual rapido do saldo atual e dos alertas de compra.</p>
              </div>
              <button
                onClick={carregarInsumos}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                <RefreshCcw size={16} />
                Recarregar
              </button>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              </div>
            ) : insumos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/70 px-6 py-10 text-center text-stone-500">
                Nenhum insumo cadastrado ainda.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {insumos.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,_rgba(240,253,244,0.95),_rgba(255,255,255,0.98))] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-serif text-2xl text-stone-900">{item.nome}</p>
                        <p className="mt-2 text-sm text-stone-500">
                          {Number(item.quantidade_atual || 0).toLocaleString('pt-BR')} {item.unidade_medida || 'un'} em estoque
                        </p>
                        <p className="mt-1 text-sm text-stone-400">Custo recente: {currency(item.custo_medio || 0)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${statusBadge(item)}`}>
                        {statusTexto(item)}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white/90 px-4 py-3 text-sm text-stone-600">
                      Alerta minimo: {Number(item.alerta_minimo || 0).toLocaleString('pt-BR')} {item.unidade_medida || 'un'}
                    </div>
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

export default Insumos
