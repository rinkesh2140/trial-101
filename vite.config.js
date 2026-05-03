import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        supervisor: resolve(__dirname, 'supervisor.html'),
        openApp: resolve(__dirname, 'open-app.html'),
        pitchDeck: resolve(__dirname, 'pitch-deck.html'),
      }
    }
  }
})
