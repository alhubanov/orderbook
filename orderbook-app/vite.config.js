import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from https://alhubanov.github.io/orderbook/,
// so production assets need the repo name as their base path. Dev stays at "/"
// so the local server is still just localhost:5173.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/orderbook/' : '/',
  server: {
    port: 5173,
  },
}));
