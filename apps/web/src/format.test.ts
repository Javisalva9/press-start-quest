import { describe, expect, it } from 'vitest';
import { formatHours, parseHours, yearOf } from './format';

describe('formatHours', () => {
  it('keeps one decimal for short times', () => {
    expect(formatHours(90, 'en')).toBe('1.5h');
    expect(formatHours(90, 'es')).toBe('1,5h');
  });

  it('rounds to whole hours above 10 h', () => {
    expect(formatHours(12 * 60 + 20, 'en')).toBe('12h');
  });
});

describe('yearOf', () => {
  it('reads the year of an ISO date', () => {
    expect(yearOf('2011-04-19T00:00:00.000Z')).toBe(2011);
    expect(yearOf(null)).toBeNull();
  });
});

describe('parseHours', () => {
  it('reads whole and decimal hours, with a comma or a dot', () => {
    expect(parseHours('10')).toBe(600);
    expect(parseHours(' 1,5 ')).toBe(90);
    expect(parseHours('0.25')).toBe(15);
  });

  it('rejects anything that is not a number of hours', () => {
    for (const text of ['', 'diez', '-3', '1,5,5', '1e3']) {
      expect(parseHours(text)).toBeNull();
    }
  });
});
