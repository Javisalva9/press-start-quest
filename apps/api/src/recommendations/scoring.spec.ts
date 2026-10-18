import {
  fitsMood,
  lengthFactor,
  momentumFactor,
  overlap,
  pickAlternatives,
  qualityFactor,
  remainingMinutes,
  scoreCandidate,
  type Candidate,
} from './scoring.js';

const NOW = new Date('2026-10-18T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const H = 60;

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  playtimeMin: 0,
  playing: false,
  lastPlayedAt: null,
  lengthMin: 20 * H,
  sandbox: false,
  rating: null,
  ratingCount: null,
  metacritic: null,
  affinity: 0,
  topTag: null,
  curators: [],
  closing: null,
  ...overrides,
});

describe('remainingMinutes', () => {
  it('is the main story minus what was played, never below 0', () => {
    expect(remainingMinutes(candidate({ playtimeMin: 5 * H }))).toBe(15 * H);
    expect(remainingMinutes(candidate({ playtimeMin: 30 * H }))).toBe(0);
  });

  it('is unknown for sandboxes and games with no length', () => {
    expect(remainingMinutes(candidate({ sandbox: true }))).toBeNull();
    expect(remainingMinutes(candidate({ lengthMin: null }))).toBeNull();
  });
});

describe('fitsMood', () => {
  it('lets everything in without a mood', () => {
    expect(fitsMood(candidate({ lengthMin: null }), null)).toBe(true);
    expect(fitsMood(candidate({ sandbox: true }), null)).toBe(true);
  });

  it.each([
    ['short', 9 * H, true],
    ['short', 10 * H, false],
    ['medium', 10 * H, true],
    ['medium', 30 * H, true],
    ['long', 30 * H, false],
    ['long', 31 * H, true],
  ] as const)('%s with %i minutes left: %s', (mood, left, fits) => {
    expect(fitsMood(candidate({ lengthMin: left }), mood)).toBe(fits);
  });

  it('keeps out what it cannot promise: sandboxes and unknown lengths', () => {
    expect(fitsMood(candidate({ sandbox: true }), 'short')).toBe(false);
    expect(fitsMood(candidate({ lengthMin: null }), 'long')).toBe(false);
  });
});

describe('qualityFactor', () => {
  it('trusts a rating with many votes', () => {
    expect(
      qualityFactor(candidate({ rating: 90, ratingCount: 2000 })),
    ).toBeCloseTo(0.9, 2);
  });

  it('pulls a rating with few votes towards neutral', () => {
    expect(
      qualityFactor(candidate({ rating: 100, ratingCount: 3 })),
    ).toBeCloseTo(0.77, 2);
  });

  it('falls back to Metacritic, then to neutral', () => {
    expect(qualityFactor(candidate({ metacritic: 84 }))).toBe(0.84);
    expect(qualityFactor(candidate())).toBe(0.7);
  });
});

describe('lengthFactor', () => {
  it('is highest at the length the mood aims for', () => {
    const at = (hours: number, mood: 'short' | null) =>
      lengthFactor(candidate({ lengthMin: hours * H }), mood);
    expect(at(5, 'short')).toBeCloseTo(1, 5);
    expect(at(5, 'short')).toBeGreaterThan(at(9, 'short'));
    expect(at(15, null)).toBeCloseTo(1, 5);
    // Without a mood, 8–25 h are all good fits.
    expect(at(8, null)).toBeGreaterThan(0.6);
    expect(at(25, null)).toBeGreaterThan(0.6);
    expect(at(80, null)).toBeLessThan(0.2);
  });

  it('gives an unknown length a middling fit, only without a mood', () => {
    expect(lengthFactor(candidate({ lengthMin: null }), null)).toBe(0.4);
    expect(lengthFactor(candidate({ lengthMin: null }), 'short')).toBe(0);
  });
});

describe('momentumFactor', () => {
  const started = { playtimeMin: 5 * H, lastPlayedAt: daysAgo(10) };

  it('is on for a game started, played lately and not nearly finished', () => {
    expect(momentumFactor(candidate(started), NOW)).toBe(true);
  });

  it('is off after 90 days, under an hour, or past 80 %', () => {
    expect(
      momentumFactor(candidate({ ...started, lastPlayedAt: daysAgo(91) }), NOW),
    ).toBe(false);
    expect(
      momentumFactor(candidate({ ...started, playtimeMin: 60 }), NOW),
    ).toBe(false);
    expect(
      momentumFactor(candidate({ ...started, playtimeMin: 17 * H }), NOW),
    ).toBe(false);
  });

  it('is on for the player\'s own "playing", with no hours (an external game)', () => {
    const external = candidate({
      playing: true,
      playtimeMin: 0,
      lastPlayedAt: daysAgo(5),
    });
    expect(momentumFactor(external, NOW)).toBe(true);
    // No "0 % in": the reason needs hours to show.
    expect(
      scoreCandidate(external, null, NOW).reasons.map((reason) => reason.code),
    ).not.toContain('KEEP_GOING');
  });

  it('is on for a sandbox or an unknown length, whatever the hours', () => {
    expect(
      momentumFactor(
        candidate({ ...started, sandbox: true, playtimeMin: 99 * H }),
        NOW,
      ),
    ).toBe(true);
    expect(
      momentumFactor(candidate({ ...started, lengthMin: null }), NOW),
    ).toBe(true);
  });
});

describe('scoreCandidate', () => {
  it('adds up the weighted factors', () => {
    const scored = scoreCandidate(
      candidate({
        lengthMin: 15 * H,
        rating: 80,
        ratingCount: 100_000,
        affinity: 0.5,
        curators: ['AlexElCapso'],
      }),
      null,
      NOW,
    );
    // 0.3 × 0.8 + 0.3 × 0.5 + 0.2 × 1 + 0.1 × 1 + 0.1 × 0
    expect(scored.score).toBeCloseTo(0.69, 2);
    expect(scored.factors).toMatchObject({ social: 1, momentum: 0 });
  });

  it('gives closing servers a bonus and their reason first', () => {
    const closing = scoreCandidate(
      candidate({
        closing: { at: new Date('2026-12-01T00:00:00Z') },
        affinity: 1,
        topTag: { name: 'Shooter', kind: 'GENRE' },
      }),
      null,
      NOW,
    );
    const open = scoreCandidate(
      candidate({ affinity: 1, topTag: { name: 'Shooter', kind: 'GENRE' } }),
      null,
      NOW,
    );
    expect(closing.score - open.score).toBeCloseTo(0.1, 5);
    expect(closing.reasons[0]).toEqual({
      code: 'SERVERS_CLOSING',
      closesAt: '2026-12-01T00:00:00.000Z',
    });
  });

  it('gives the two reasons that weighed the most', () => {
    const { reasons } = scoreCandidate(
      candidate({
        lengthMin: 20 * H,
        playtimeMin: 8 * H,
        lastPlayedAt: daysAgo(3),
        affinity: 0.9,
        topTag: { name: 'Metroidvania', kind: 'GENRE' },
        rating: 95,
        ratingCount: 5000,
      }),
      null,
      NOW,
    );
    // The plan's example: "you love metroidvanias · 12 h left". A 95
    // rating is good, but most games rate well: it stands out less.
    expect(reasons).toEqual([
      { code: 'TASTE_MATCH', tag: 'Metroidvania', kind: 'GENRE' },
      { code: 'TIME_LEFT', minutes: 12 * H },
    ]);
  });

  it('says how far in a started game is', () => {
    const { reasons } = scoreCandidate(
      candidate({
        lengthMin: 10 * H,
        playtimeMin: 4 * H,
        lastPlayedAt: daysAgo(3),
      }),
      null,
      NOW,
    );
    expect(reasons).toContainEqual({
      code: 'KEEP_GOING',
      playedMinutes: 4 * H,
      percent: 40,
    });
  });

  it('keeps quiet about weak factors', () => {
    const { reasons } = scoreCandidate(
      candidate({
        lengthMin: 90 * H,
        affinity: 0.2,
        topTag: { name: 'Puzzle', kind: 'GENRE' },
        rating: 70,
        ratingCount: 50,
      }),
      null,
      NOW,
    );
    expect(reasons).toEqual([]);
  });
});

describe('pickAlternatives', () => {
  const game = (title: string, genres: string[]) => ({ title, genres });

  it('picks the best games of other genres', () => {
    const rpg = game('rpg', ['Role-playing (RPG)', 'Indie']);
    // Half its genres are the pick's: not different enough.
    const rpg2 = game('rpg2', ['Role-playing (RPG)', 'Adventure']);
    // Indie aside, all RPG.
    const indieRpg = game('indie', ['Indie', 'Role-playing (RPG)']);
    const shooter = game('shooter', ['Shooter']);
    const puzzle = game('puzzle', ['Puzzle', 'Indie']);
    expect(
      pickAlternatives(rpg, [rpg, rpg2, indieRpg, shooter, puzzle], 2),
    ).toEqual([shooter, puzzle]);
  });

  it('keeps the alternatives different from each other too', () => {
    const rpg = game('rpg', ['Role-playing (RPG)']);
    const shooter = game('shooter', ['Shooter']);
    const shooter2 = game('shooter2', ['Shooter']);
    const puzzle = game('puzzle', ['Puzzle']);
    expect(pickAlternatives(rpg, [rpg, shooter, shooter2, puzzle], 2)).toEqual([
      shooter,
      puzzle,
    ]);
  });

  it('fills the gaps with the best of the rest', () => {
    const a = game('a', ['Shooter']);
    const b = game('b', ['Shooter']);
    const c = game('c', ['Shooter']);
    expect(pickAlternatives(a, [a, b, c], 2)).toEqual([b, c]);
    expect(pickAlternatives(a, [a], 2)).toEqual([]);
  });
});

describe('overlap', () => {
  it('ignores Indie, which says nothing about a game', () => {
    expect(overlap(['Indie', 'Platform'], ['Indie', 'Shooter'])).toBe(0);
    expect(overlap(['Indie'], ['Indie'])).toBe(0);
    expect(overlap(['Platform', 'Puzzle'], ['Platform'])).toBe(0.5);
  });
});
