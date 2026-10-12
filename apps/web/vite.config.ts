import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// App colors (see src/index.css): used by the phone for the splash screen
// and the status bar while the installed app is open.
const background = '#0E0F14';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version activates on its own the next time the app is opened.
      registerType: 'autoUpdate',
      // Registers the service worker with a small deferred <script>, so no
      // app code is needed for it.
      injectRegister: 'script-defer',
      // Icons generated from public/favicon.svg with `pnpm --filter @psq/web icons`
      // (see pwa-assets.config.ts).
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
      ],
      manifest: {
        id: '/',
        name: 'Press Start Quest',
        // Label under the home screen icon: short enough not to be cut off.
        short_name: 'Press Start',
        description:
          'Import your PC game library and get a daily pick to clear your backlog.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: background,
        theme_color: background,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // The service worker precaches the app shell (HTML, JS and CSS, plus the
      // assets above and the manifest icons) so the app opens instantly and
      // without a connection. API data is cached separately, inside the app.
      workbox: {
        // App shell plus the fonts for latin text (English and Spanish).
        // Other alphabets are downloaded only if ever needed.
        globPatterns: [
          '**/*.{js,css,html}',
          '**/*-latin-{wght,400}-normal-*.woff2',
        ],
        // It's a single-page app: any route opened offline gets index.html.
        navigateFallback: 'index.html',
        // ...except the API (same origin locally through the proxy below).
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    // Locally, /api is forwarded to the Nest API: web and API look like the
    // same origin, so no CORS is needed while developing.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
