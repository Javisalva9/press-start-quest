import type { Language } from '@psq/shared';

/**
 * IGDB's genres, themes, game modes and perspectives, as the app shows
 * them. The keys are IGDB's own names (what the API sends); English
 * shortens the clumsy ones and Spanish translates them all.
 *
 * Not in the locale files on purpose: IGDB names contain "/" and other
 * characters i18next treats as separators, and they aren't app texts but
 * data, like a game's title. A name missing here (a Steam genre for a game
 * IGDB doesn't know) is shown as it comes.
 */
const TAG_NAMES: Record<string, { en?: string; es: string }> = {
  // Genres
  'Point-and-click': { es: 'Aventura gráfica' },
  Fighting: { es: 'Lucha' },
  Shooter: { es: 'Shooter' },
  Music: { es: 'Música' },
  Platform: { es: 'Plataformas' },
  Puzzle: { es: 'Puzles' },
  Racing: { es: 'Carreras' },
  'Real Time Strategy (RTS)': {
    en: 'Real-time strategy',
    es: 'Estrategia en tiempo real',
  },
  'Role-playing (RPG)': { en: 'RPG', es: 'RPG' },
  Simulator: { es: 'Simulación' },
  Sport: { en: 'Sports', es: 'Deportes' },
  Strategy: { es: 'Estrategia' },
  'Turn-based strategy (TBS)': {
    en: 'Turn-based strategy',
    es: 'Estrategia por turnos',
  },
  Tactical: { es: 'Táctico' },
  'Quiz/Trivia': { en: 'Quiz', es: 'Preguntas' },
  "Hack and slash/Beat 'em up": { en: 'Hack and slash', es: 'Hack and slash' },
  Pinball: { es: 'Pinball' },
  Adventure: { es: 'Aventura' },
  Arcade: { es: 'Arcade' },
  'Visual Novel': { en: 'Visual novel', es: 'Novela visual' },
  Indie: { es: 'Indie' },
  'Card & Board Game': { en: 'Card and board', es: 'Cartas y tablero' },
  MOBA: { es: 'MOBA' },
  // Themes
  Action: { es: 'Acción' },
  Fantasy: { es: 'Fantasía' },
  'Science fiction': { es: 'Ciencia ficción' },
  Horror: { es: 'Terror' },
  Thriller: { es: 'Suspense' },
  Survival: { es: 'Supervivencia' },
  Historical: { es: 'Histórico' },
  Stealth: { es: 'Sigilo' },
  Comedy: { es: 'Comedia' },
  Business: { es: 'Gestión' },
  Drama: { es: 'Drama' },
  'Non-fiction': { es: 'No ficción' },
  Sandbox: { es: 'Sandbox' },
  Educational: { es: 'Educativo' },
  Kids: { es: 'Infantil' },
  'Open world': { es: 'Mundo abierto' },
  Warfare: { es: 'Bélico' },
  Party: { es: 'Fiesta' },
  '4X (explore, expand, exploit, and exterminate)': { en: '4X', es: '4X' },
  Erotic: { es: 'Erótico' },
  Mystery: { es: 'Misterio' },
  Romance: { es: 'Romance' },
  // Game modes
  'Single player': { es: 'Un jugador' },
  Multiplayer: { es: 'Multijugador' },
  'Co-operative': { en: 'Co-op', es: 'Cooperativo' },
  'Split screen': { es: 'Pantalla dividida' },
  'Massively Multiplayer Online (MMO)': { en: 'MMO', es: 'MMO' },
  'Battle Royale': { es: 'Battle royale' },
  // Perspectives
  'First person': { es: 'Primera persona' },
  'Third person': { es: 'Tercera persona' },
  'Bird view / Isometric': { en: 'Isometric', es: 'Vista isométrica' },
  'Side view': { es: 'Vista lateral' },
  Text: { es: 'Texto' },
  Auditory: { es: 'Sonoro' },
  'Virtual Reality': { en: 'Virtual reality', es: 'Realidad virtual' },
};

/** A genre, theme, mode or perspective in the player's language. */
export function tagLabel(name: string, language: Language | string): string {
  const names = TAG_NAMES[name];
  if (!names) {
    return name;
  }
  return language.startsWith('es') ? names.es : (names.en ?? name);
}

/** Every tag with a translation: for tests. */
export const TRANSLATED_TAGS = Object.keys(TAG_NAMES);
