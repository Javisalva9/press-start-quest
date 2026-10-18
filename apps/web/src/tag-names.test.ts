import { describe, expect, it } from 'vitest';
import { TRANSLATED_TAGS, tagLabel } from './tag-names';

describe('tagLabel', () => {
  it('translates IGDB names into Spanish', () => {
    expect(tagLabel('Horror', 'es')).toBe('Terror');
    expect(tagLabel('Bird view / Isometric', 'es')).toBe('Vista isométrica');
  });

  it('keeps English names, shortening the clumsy ones', () => {
    expect(tagLabel('Horror', 'en')).toBe('Horror');
    expect(tagLabel('Role-playing (RPG)', 'en')).toBe('RPG');
  });

  it('shows an unknown name as it comes', () => {
    expect(tagLabel('Roguelike', 'es')).toBe('Roguelike');
  });

  it('covers all of IGDB: 23 genres, 22 themes, 6 modes, 7 perspectives', () => {
    expect(TRANSLATED_TAGS).toHaveLength(58);
  });
});
