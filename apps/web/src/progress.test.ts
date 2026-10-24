import { describe, expect, it } from 'vitest';
import { etaParts, formatDailyTime, formatEta, ringPercent } from './progress';

describe('ringPercent', () => {
  it('is the share of completed games, rounded', () => {
    expect(ringPercent(8, 35)).toBe(19);
    expect(ringPercent(1, 2)).toBe(33);
  });

  it('is 0 with nothing in the ring, not a division by zero', () => {
    expect(ringPercent(0, 0)).toBe(0);
  });

  it('is 100 with everything completed', () => {
    expect(ringPercent(12, 0)).toBe(100);
  });
});

describe('etaParts', () => {
  it.each([
    [0, { value: 1, unit: 'day' }],
    [10, { value: 10, unit: 'day' }],
    [20, { value: 3, unit: 'week' }],
    [245, { value: 8, unit: 'month' }],
    [1000, { value: 2.7, unit: 'year' }],
  ])('%i days is %o', (days, parts) => {
    expect(etaParts(days)).toEqual(parts);
  });
});

describe('formatEta', () => {
  it('reads naturally in each language', () => {
    expect(formatEta(245, 'es')).toBe('dentro de 8 meses');
    expect(formatEta(245, 'en')).toBe('in 8 months');
  });
});

describe('formatDailyTime', () => {
  it('uses minutes under an hour, hours above', () => {
    expect(formatDailyTime(20, 'en')).toBe('20 min');
    expect(formatDailyTime(90, 'en')).toBe('1.5h');
  });
});
