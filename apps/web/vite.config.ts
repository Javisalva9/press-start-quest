import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En local, /api se reenvía a la API de Nest: la web y la API parecen el
    // mismo origen y no hace falta CORS mientras desarrollas.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
