import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  filtersFromSearchParams,
  toSearchParams,
} from './library';

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

describe('activeFilterCount', () => {
  const base = { view: 'library', sort: 'lastPlayed' } as const;

  it('is 0 with only the view and the order', () => {
    expect(activeFilterCount(base)).toBe(0);
  });

  it('counts the search, each status chip, the length and the store', () => {
    expect(
      activeFilterCount({
        ...base,
        q: 'hades',
        status: ['BACKLOG', 'PLAYING'],
        length: 'short',
        source: 'STEAM',
      }),
    ).toBe(5);
  });
});
