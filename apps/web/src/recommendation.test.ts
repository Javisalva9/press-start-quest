import { describe, expect, it } from 'vitest';
import { reasonMessage, steamRunUrl } from './recommendation';

describe('reasonMessage', () => {
  it('translates the tag of a taste match', () => {
    expect(
      reasonMessage(
        { code: 'TASTE_MATCH', tag: 'Horror', kind: 'THEME' },
        'es',
      ),
    ).toEqual({ key: 'next.reason.TASTE_MATCH', values: { tag: 'Terror' } });
  });

  it('writes the time left in hours, in the language', () => {
    // The space before "h" depends on the browser's Intl data: only the
    // number and the decimal comma are checked.
    const hours = (minutes: number, language: string) =>
      reasonMessage({ code: 'TIME_LEFT', minutes }, language).values;
    expect(hours(90, 'es')).toEqual({
      hours: expect.stringMatching(/^1,5\s?h$/),
    });
    expect(hours(720, 'en')).toEqual({
      hours: expect.stringMatching(/^12\s?h$/),
    });
  });

  it('says how far in, or how long played when the length is unknown', () => {
    expect(
      reasonMessage(
        { code: 'KEEP_GOING', playedMinutes: 240, percent: 40 },
        'en',
      ),
    ).toEqual({ key: 'next.reason.KEEP_GOING', values: { percent: 40 } });
    expect(
      reasonMessage(
        { code: 'KEEP_GOING', playedMinutes: 240, percent: null },
        'en',
      ).key,
    ).toBe('next.reason.KEEP_GOING_HOURS');
  });

  it('names the curator and the rating', () => {
    expect(
      reasonMessage({ code: 'RECOMMENDED_BY', curator: 'AlexElCapso' }, 'es')
        .values,
    ).toEqual({ curator: 'AlexElCapso' });
    expect(
      reasonMessage({ code: 'HIGHLY_RATED', rating: 92 }, 'es').values,
    ).toEqual({ rating: 92 });
  });

  it('dates a closure when it is known', () => {
    expect(
      reasonMessage(
        { code: 'SERVERS_CLOSING', closesAt: '2026-12-31T00:00:00.000Z' },
        'es',
      ),
    ).toEqual({
      key: 'next.reason.SERVERS_CLOSING',
      values: { date: '31 de diciembre de 2026' },
    });
    expect(
      reasonMessage({ code: 'SERVERS_CLOSING', closesAt: null }, 'es').key,
    ).toBe('next.reason.SERVERS_CLOSING_SOON');
  });
});

describe('steamRunUrl', () => {
  it('starts the game in Steam on a computer', () => {
    expect(steamRunUrl(1145360, true)).toBe('steam://rungameid/1145360');
  });

  it('is not offered on a phone or without an appid', () => {
    expect(steamRunUrl(1145360, false)).toBeNull();
    expect(steamRunUrl(null, true)).toBeNull();
  });
});
