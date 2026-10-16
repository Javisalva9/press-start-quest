import { gamingDay } from './gaming-day.js';

describe('gamingDay', () => {
  it('is the calendar day in Madrid during the day', () => {
    // 15:00 in Madrid (summer time, UTC+2).
    expect(gamingDay(new Date('2026-07-10T13:00:00Z'))).toBe('2026-07-10');
  });

  it('counts the small hours for the evening before', () => {
    // 03:30 in Madrid.
    expect(gamingDay(new Date('2026-07-11T01:30:00Z'))).toBe('2026-07-10');
  });

  it('starts the new day at 4:00 in Madrid', () => {
    expect(gamingDay(new Date('2026-07-11T02:00:00Z'))).toBe('2026-07-11');
  });

  it('follows the winter time change', () => {
    // 03:59 and 04:00 in Madrid in January (UTC+1).
    expect(gamingDay(new Date('2026-01-15T02:59:00Z'))).toBe('2026-01-14');
    expect(gamingDay(new Date('2026-01-15T03:00:00Z'))).toBe('2026-01-15');
  });

  it('files the nightly sync under the day before', () => {
    // The workflow runs at 23:30 UTC: 00:30 or 01:30 in Madrid.
    expect(gamingDay(new Date('2026-10-17T23:30:00Z'))).toBe('2026-10-17');
    expect(gamingDay(new Date('2026-12-17T23:30:00Z'))).toBe('2026-12-17');
  });
});
