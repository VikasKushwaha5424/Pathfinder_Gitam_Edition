import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,geojson}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/generate': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/transcribe': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/locations': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/reset': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/init-session': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/announce': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
