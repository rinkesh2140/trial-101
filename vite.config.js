import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        supervisor: 'supervisor.html',
        worker: 'worker.html',
        openApp: 'open-app.html',
        pitch: 'pitch-deck.html'
      }
    }
  }
});
