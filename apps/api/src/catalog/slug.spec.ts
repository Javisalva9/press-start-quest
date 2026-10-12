import { slugify, steamGameSlug } from './slug.js';

describe('slugify', () => {
  it.each([
    ['The Witcher® 3: Wild Hunt', 'the-witcher-3-wild-hunt'],
    ['Pokémon™ Legends', 'pokemon-legends'],
    ['  --Hello--  ', 'hello'],
  ])('%s → %s', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});

describe('steamGameSlug', () => {
  it('appends the appid so equal names never clash', () => {
    expect(steamGameSlug('Portal 2', 620)).toBe('portal-2-620');
  });

  it('falls back to the appid when the name has no letters or digits', () => {
    expect(steamGameSlug('™', 42)).toBe('steam-42');
  });
});
