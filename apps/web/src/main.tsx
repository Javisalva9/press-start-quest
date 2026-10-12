import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Antes que App: los textos tienen que estar listos para el primer render.
import './i18n';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
