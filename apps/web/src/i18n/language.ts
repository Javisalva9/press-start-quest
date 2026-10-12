import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@psq/shared';

/**
 * Elige el idioma de la app a partir de los idiomas preferidos del móvil
 * (navigator.languages, ordenados por preferencia): el primero que la app
 * sabe hablar, sin mirar la región ("es-MX" cuenta como "es"). Si no encaja
 * ninguno, inglés.
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
