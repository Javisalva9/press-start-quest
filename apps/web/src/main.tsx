import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Before App: translations must be ready for the first render.
import './i18n';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
