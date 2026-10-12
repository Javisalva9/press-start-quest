import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Locally, /api is forwarded to the Nest API: web and API look like the
    // same origin, so no CORS is needed while developing.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
