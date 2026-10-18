import { describe, expect, it } from 'vitest';
import { starFill, tappedRating } from './stars';

describe('starFill', () => {
  it('lights whole stars, half of the next one, and none after', () => {
    expect([1, 2, 3, 4, 5].map((star) => starFill(star, 3.5))).toEqual([
      1, 1, 1, 0.5, 0,
    ]);
    expect([1, 2].map((star) => starFill(star, 0.5))).toEqual([0.5, 0]);
  });

  it('lights nothing without a rating', () => {
    expect(starFill(1, null)).toBe(0);
  });
});

describe('tappedRating', () => {
  it('gives the whole star, or half of it on its left side', () => {
    expect(tappedRating(4, false, null)).toBe(4);
    expect(tappedRating(4, true, null)).toBe(3.5);
    expect(tappedRating(1, true, 3)).toBe(0.5);
  });

  it('takes the rating back when tapping it again', () => {
    expect(tappedRating(4, true, 3.5)).toBeNull();
    expect(tappedRating(4, false, 4)).toBeNull();
    // The other half of the same star changes it instead.
    expect(tappedRating(4, false, 3.5)).toBe(4);
  });
});
