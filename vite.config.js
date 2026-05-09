import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        sitehub: 'sitehub.html',
        main: 'index.html',
        supervisor: 'supervisor.html',
      }
    }
  }
})
