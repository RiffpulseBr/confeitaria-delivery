import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sistema Confeitaria',
        short_name: 'Confeitaria',
        description: 'Gestão de Pedidos e Estoque',
        theme_color: '#10b981', // Cor da barra de status (verde esmeralda)
        background_color: '#f8fafc',
        display: 'fullscreen', // Remove todas as barras do navegador
        orientation: 'landscape', // Trava a tela na horizontal (ideal para tablet deitado)
        icons: [
          {
            // Ícone provisório só para o tablet reconhecer como App
            src: 'https://cdn-icons-png.flaticon.com/512/3014/3014444.png', 
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})