import { describe, expect, it } from 'vitest';
import { filtersFromSearchParams, toSearchParams } from './library';

describe('toSearchParams', () => {
  it('leaves out default values and joins lists', () => {
    expect(
      toSearchParams({
        view: 'library',
        sort: 'lastPlayed',
        status: ['BACKLOG', 'PLAYING'],
        q: 'portal',
      }).toString(),
    ).toBe('status=BACKLOG%2CPLAYING&q=portal');
  });
});

describe('filtersFromSearchParams', () => {
  it('reads the filters from the URL', () => {
    expect(
      filtersFromSearchParams(
        new URLSearchParams('view=wishlist&sort=priority&length=short'),
      ),
    ).toEqual({ view: 'wishlist', sort: 'priority', length: 'short' });
  });

  it('falls back to the defaults when the URL is invalid', () => {
    expect(filtersFromSearchParams(new URLSearchParams('sort=random'))).toEqual(
      { view: 'library', sort: 'lastPlayed' },
    );
  });
});
