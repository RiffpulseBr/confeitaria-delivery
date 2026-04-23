import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BookHeart, ChefHat, FlaskConical, PackageCheck, PackageSearch, Sparkles, Store, Tag, Truck } from 'lucide-react'

import Balcao from './Pages/Balcao'
import Estoque from './Pages/Estoque'
import FilaPedidos from './Pages/FilaPedidos'
import Ifood from './Pages/Ifood'
import Insumos from './Pages/Insumos'
import Producao from './Pages/Producao'
import Produtos from './Pages/Produtos'
import Receitas from './Pages/Receitas'

const menuSections = [
  {
    title: 'Cadastro',
    items: [
      { path: '/produtos', icon: Tag, label: 'Produtos', hint: 'Cardapio e preco' },
      { path: '/insumos', icon: FlaskConical, label: 'Insumos', hint: 'Materia-prima da cozinha' },
      { path: '/receitas', icon: BookHeart, label: 'Receitas', hint: 'Fichas tecnicas dos lotes' },
    ],
  },
  {
    title: 'Producao',
    items: [
      { path: '/producao', icon: ChefHat, label: 'Ordens', hint: 'Lotes e execucao do dia' },
      { path: '/estoque', icon: PackageSearch, label: 'Estoque', hint: 'Insumos e produtos prontos' },
    ],
  },
  {
    title: 'Vendas',
    items: [
      { path: '/', icon: Store, label: 'Balcao', hint: 'Atendimento e caixa' },
      { path: '/pedidos', icon: PackageCheck, label: 'Pedidos', hint: 'Expedicao e saida' },
      { path: '/ifood', icon: Truck, label: 'iFood', hint: 'Integracao e loja' },
    ],
  },
]

const menuItems = menuSections.flatMap((section) => section.items)

function Sidebar() {
  const location = useLocation()

  return (
    <aside className="hidden w-[290px] shrink-0 flex-col border-r border-white/60 bg-[linear-gradient(180deg,_rgba(68,24,34,0.96),_rgba(88,28,44,0.95)_42%,_rgba(120,53,15,0.92))] px-6 py-8 text-white shadow-[0_24px_80px_rgba(68,24,34,0.35)] lg:flex">
      <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-300 to-amber-200 text-2xl font-bold text-rose-950 shadow-lg">
          SC
        </div>
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-rose-100">
          <Sparkles size={12} />
          Atelier doce
        </p>
        <h1 className="font-serif text-3xl leading-tight">Studio Confeitaria</h1>
        <p className="mt-3 text-sm leading-6 text-rose-100/80">
          Operacao de vendas, producao e estoque com um visual mais acolhedor para o dia a dia da confeitaria.
        </p>
      </div>

      <nav className="mt-8 space-y-6">
        {menuSections.map((section) => (
          <div key={section.title}>
            <p className="mb-3 px-4 text-[11px] font-bold uppercase tracking-[0.3em] text-rose-100/55">
              {section.title}
            </p>
            <div className="space-y-3">
              {section.items.map((item) => {
                const Icon = item.icon
                const ativo = location.pathname === item.path

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center gap-4 rounded-[1.75rem] px-4 py-4 transition ${
                      ativo
                        ? 'bg-white text-rose-950 shadow-[0_14px_40px_rgba(255,255,255,0.18)]'
                        : 'text-rose-100/85 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        ativo ? 'bg-rose-100 text-rose-700' : 'bg-white/10 text-rose-100'
                      }`}
                    >
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold">{item.label}</span>
                      <span className={`block text-sm ${ativo ? 'text-stone-500' : 'text-rose-100/70'}`}>{item.hint}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-[1.75rem] border border-white/15 bg-white/10 p-5 text-sm leading-6 text-rose-100/80">
        <p className="font-bold text-white">Resumo do ambiente</p>
        <p className="mt-2">Fluxo alinhado ao dia a dia da confeitaria: cadastrar, produzir em lote, abastecer e vender.</p>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const location = useLocation()
  const current = menuItems.find((item) => item.path === location.pathname) || menuItems[0]
  const currentSection = menuSections.find((section) =>
    section.items.some((item) => item.path === current.path),
  )
  const Icon = current.icon

  return (
    <header className="border-b border-white/60 bg-white/85 px-5 py-4 shadow-sm backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-200 to-amber-100 text-rose-900 shadow-sm">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-500">
              {currentSection?.title || 'Studio Confeitaria'}
            </p>
            <p className="font-serif text-2xl text-stone-900">{current.label}</p>
          </div>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
          <Icon size={20} />
        </span>
      </div>
    </header>
  )
}

function MobileNav() {
  const location = useLocation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/80 bg-white/90 px-3 py-3 shadow-[0_-12px_40px_rgba(120,53,15,0.16)] backdrop-blur lg:hidden">
      <div className="pretty-scrollbar flex gap-2 overflow-x-auto pb-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const ativo = location.pathname === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex min-w-[108px] shrink-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-xs font-bold uppercase tracking-[0.2em] transition ${
                ativo ? 'bg-rose-100 text-rose-700' : 'text-stone-500'
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function AppShell() {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,207,232,0.38),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#fff1f2_46%,_#fffbeb)] text-stone-800">
      <Sidebar />

      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader />
        <main className="flex-1 overflow-hidden pb-24 lg:pb-0">
          <Routes>
            <Route path="/" element={<Balcao />} />
            <Route path="/pedidos" element={<FilaPedidos />} />
            <Route path="/fila" element={<Navigate replace to="/pedidos" />} />
            <Route path="/producao" element={<Producao />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/receitas" element={<Receitas />} />
            <Route path="/insumos" element={<Insumos />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/ifood" element={<Ifood />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
