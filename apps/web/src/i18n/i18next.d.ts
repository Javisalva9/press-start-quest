import 'i18next';
import type en from '../locales/en.json';

// Translation keys are typed from en.json, the default language:
// t('a.key.that.does.not.exist') is a TypeScript error instead of broken text
// on screen.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
