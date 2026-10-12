import { z } from 'zod';

/**
 * App languages. The web app uses them to pick translations and the API to
 * validate the language stored for each user (users.locale).
 */
export const LANGUAGES = ['en', 'es'] as const;

export const LanguageSchema = z.enum(LANGUAGES);

export type Language = z.infer<typeof LanguageSchema>;

/** Used when the device language isn't one of the supported ones. */
export const DEFAULT_LANGUAGE: Language = 'en';
