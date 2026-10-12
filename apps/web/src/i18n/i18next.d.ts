import 'i18next';
import type en from '../locales/en.json';

// Las claves de traducción se tipan a partir de en.json, el idioma por defecto:
// t('clave.que.no.existe') es un error de TypeScript en vez de un texto roto
// en pantalla.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
