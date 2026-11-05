import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project pages serve from /<repo>/, so assets need that prefix in production.
// Dev stays at / so `npm run dev` behaves normally.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ttrpg/' : '/',
  plugins: [react()],
}))
