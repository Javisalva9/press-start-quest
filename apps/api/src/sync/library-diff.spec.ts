import type { LibraryGame } from '../providers/library-provider.js';
import { diffOwnerships } from './library-diff.js';

const game = (overrides: Partial<LibraryGame> = {}): LibraryGame => ({
  externalAppId: '620',
  title: 'Portal 2',
  playtimeMinutes: 100,
  recentPlaytimeMinutes: 0,
  lastPlayedAt: new Date('2026-01-01'),
  ...overrides,
});

const stored = {
  externalAppId: '620',
  playtimeMin: 100,
  playtime2wMin: 0,
  lastPlayedAt: new Date('2026-01-01'),
};

describe('diffOwnerships', () => {
  it('treats every game as added on the first sync', () => {
    expect(diffOwnerships([], [game()])).toEqual({
      added: [game()],
      changed: [],
    });
  });

  it('ignores games that did not change', () => {
    expect(diffOwnerships([stored], [game()])).toEqual({
      added: [],
      changed: [],
    });
  });

  it.each([
    ['total playtime', { playtimeMinutes: 160 }],
    ['recent playtime', { recentPlaytimeMinutes: 60 }],
    ['last session', { lastPlayedAt: new Date('2026-10-10') }],
    ['last session removed', { lastPlayedAt: null }],
  ])('detects a change in %s', (_field, overrides) => {
    const updated = game(overrides);
    expect(diffOwnerships([stored], [updated]).changed).toEqual([updated]);
  });
});
