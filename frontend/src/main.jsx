import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadRuntimeConfig } from './config'

const root = createRoot(document.getElementById('root'))

async function bootstrap() {
  try {
    await loadRuntimeConfig()
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (error) {
    console.error('Falha ao iniciar o frontend:', error)
    root.render(
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-3xl bg-white p-8 shadow-xl text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Falha ao iniciar o sistema</h1>
          <p className="text-slate-600">
            O frontend nao conseguiu carregar a configuracao de runtime. Verifique as variaveis do Railway e tente novamente.
          </p>
        </div>
      </div>,
    )
  }
}

bootstrap()
