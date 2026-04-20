import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { ChefHat, PackageSearch, Settings2, Store } from 'lucide-react'

import Balcao from './Pages/Balcao'
import Estoque from './Pages/Estoque'
import FilaPedidos from './Pages/FilaPedidos'
import Administracao from './Pages/Administracao'

function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/', icon: <Store size={32} />, label: 'Balcao' },
    { path: '/fila', icon: <ChefHat size={32} />, label: 'Producao' },
    { path: '/estoque', icon: <PackageSearch size={32} />, label: 'Estoque' },
    { path: '/admin', icon: <Settings2 size={32} />, label: 'Admin' },
  ]

  return (
    <nav className="w-28 bg-slate-900 text-white flex flex-col items-center py-8 gap-8 shadow-2xl z-50">
      <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-emerald-500/50 mb-4">
        SC
      </div>

      {menuItems.map((item) => {
        const ativo = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
              ativo ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
        <Sidebar />

        <main className="flex-1 h-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Balcao />} />
            <Route path="/fila" element={<FilaPedidos />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/admin" element={<Administracao />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
