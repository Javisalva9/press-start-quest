import { DEFAULT_LANGUAGE, LANGUAGES } from '@psq/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';
import { detectLanguage } from './language';

// Mantiene <html lang> al día: lo usan los lectores de pantalla y el
// traductor del navegador. Se registra antes de init para no perder el primero.
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  // Los textos van dentro del bundle (son pocos KB), así la primera pantalla
  // sale ya traducida sin esperar a ninguna descarga.
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  // De momento, el idioma del móvil. Cuando haya usuario, mandará el que
  // guarde en su perfil.
  lng: detectLanguage(navigator.languages),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  // Con los textos ya cargados, init termina al momento.
  initAsync: false,
  // React ya escapa lo que pinta: escapar también aquí mostraría &amp; y similares.
  interpolation: { escapeValue: false },
});

export default i18n;
