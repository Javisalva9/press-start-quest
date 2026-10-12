import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@psq/shared';

/**
 * Picks the app language from the device's preferred languages
 * (navigator.languages, in order of preference): the first one the app
 * speaks, ignoring the region ("es-MX" counts as "es"). Falls back to English.
 */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.split('-')[0].toLowerCase();
    const match = LANGUAGES.find((language) => language === base);
    if (match) {
      return match;
    }
  }
  return DEFAULT_LANGUAGE;
}
