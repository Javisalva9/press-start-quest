import { describe, expect, it } from 'vitest';
import { ringPercent } from './progress';

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
