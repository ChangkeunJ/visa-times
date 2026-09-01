import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'web',
  build: { outDir: '../public', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:8788', '/feed': 'http://127.0.0.1:8788' } },
  plugins: [react()],
})
