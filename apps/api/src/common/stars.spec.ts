import { fromHalfStars, toHalfStars } from './stars.js';

describe('half stars', () => {
  it.each([
    [0.5, 1],
    [3.5, 7],
    [5, 10],
  ])('%d stars are stored as %i', (stars, halves) => {
    expect(toHalfStars(stars)).toBe(halves);
    expect(fromHalfStars(halves)).toBe(stars);
  });
});
