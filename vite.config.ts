import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules/**', 'dist/**', 'dist-electron/**'],
  },
})
