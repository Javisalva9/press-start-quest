import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router/dom';
// Before the app: translations must be ready for the first render.
import './i18n';
import './fonts';
import './index.css';
import { ServerWakingBanner } from './components/ServerWakingBanner';
import { persistOptions, queryClient } from './query-client';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <RouterProvider router={router} />
      {/* Outside the router: on every screen, the Steam sign-in included. */}
      <ServerWakingBanner />
    </PersistQueryClientProvider>
  </StrictMode>,
);
