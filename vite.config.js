import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      // After build, copy dist/sitehub.html → dist/index.html
      // so Vercel serves the React app at the root without any routing tricks
      name: 'sitehub-as-root',
      closeBundle() {
        try { copyFileSync('dist/sitehub.html', 'dist/index.html') } catch (e) { console.warn('copy skipped:', e.message) }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: { sitehub: 'sitehub.html' }
    }
  }
})
