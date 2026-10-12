import { z } from 'zod';

/**
 * Idiomas de la app. La web los usa para elegir los textos y la API, para
 * validar el idioma que guarda cada usuario (users.locale).
 */
export const LANGUAGES = ['es', 'en'] as const;

export const LanguageSchema = z.enum(LANGUAGES);

export type Language = z.infer<typeof LanguageSchema>;

/** Idioma si el del móvil no es ninguno de los soportados. */
export const DEFAULT_LANGUAGE: Language = 'es';
