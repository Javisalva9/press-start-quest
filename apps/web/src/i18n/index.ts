import { DEFAULT_LANGUAGE, LANGUAGES } from '@psq/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';
import { detectLanguage } from './language';

// Keeps <html lang> up to date: screen readers and the browser's translator
// rely on it. Registered before init so the first change isn't missed.
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  // Translations ship inside the bundle (a few KB), so the first screen is
  // already translated without waiting for any download.
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  // For now, the device language. Once there are users, the one saved in
  // their profile will win.
  lng: detectLanguage(navigator.languages),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  // With translations already loaded, init finishes immediately.
  initAsync: false,
  // React already escapes what it renders: escaping here too would show &amp; and the like.
  interpolation: { escapeValue: false },
});

export default i18n;
