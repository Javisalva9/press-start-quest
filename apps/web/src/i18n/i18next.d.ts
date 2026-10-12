import 'i18next';
import type es from '../locales/es.json';

// Las claves de traducción se tipan a partir de es.json: t('clave.que.no.existe')
// es un error de TypeScript en vez de un texto roto en pantalla.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
  }
}
