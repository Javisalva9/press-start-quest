import { loadOfficialStores, matchOfficialShops } from './official-stores.js';

describe('loadOfficialStores', () => {
  it('reads the list in data/, with Steam, GOG and Epic', () => {
    const names = loadOfficialStores().map((store) => store.name);
    expect(names).toEqual(
      expect.arrayContaining(['Steam', 'GOG', 'Epic Games Store']),
    );
  });
});

describe('matchOfficialShops', () => {
  const stores = [
    { name: 'Steam', itad: ['Steam'] },
    { name: 'Epic Games Store', itad: ['Epic Game Store', 'Epic Games Store'] },
    { name: 'Gamesplanet', itad: ['Gamesplanet DE', 'Gamesplanet UK'] },
    { name: 'Nowhere', itad: ['Nowhere Store'] },
  ];

  it('finds each store by any of its names, ignoring case and symbols', () => {
    expect(
      matchOfficialShops(stores, [
        { id: 61, title: 'Steam' },
        { id: 16, title: 'Epic Game Store' },
        { id: 27, title: 'GamesPlanet DE' },
        { id: 28, title: 'Gamesplanet UK' },
        // A key marketplace: never in the list, so never asked for.
        { id: 99, title: 'Some Key Shop' },
      ]),
    ).toEqual({
      shopIds: [61, 16, 27, 28],
      matched: ['Steam', 'Epic Games Store', 'Gamesplanet'],
      missing: ['Nowhere'],
    });
  });
});
