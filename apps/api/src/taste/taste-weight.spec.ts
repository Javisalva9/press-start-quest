import { hoursWeight, tasteWeight } from './taste-weight.js';

const game = (overrides: Partial<Parameters<typeof tasteWeight>[0]>) =>
  tasteWeight({
    status: 'BACKLOG',
    playtimeMin: 0,
    stars: null,
    ...overrides,
  });

describe('hoursWeight', () => {
  it.each([
    [0, 0],
    [60, 0.18],
    [600, 0.61],
    [3000, 1],
    [30_000, 1],
  ])('%i minutes weigh %d', (minutes, weight) => {
    expect(hoursWeight(minutes)).toBeCloseTo(weight, 2);
  });
});

describe('tasteWeight', () => {
  it('gives a completed game the full weight, whatever its hours', () => {
    expect(game({ status: 'COMPLETED', playtimeMin: 60 })).toBe(1);
  });

  it('counts the hours of a game still being played', () => {
    expect(game({ status: 'PLAYING', playtimeMin: 600 })).toBeCloseTo(0.61, 2);
    expect(game({ status: 'ON_HOLD', playtimeMin: 3000 })).toBe(1);
    expect(game({ status: 'BACKLOG', playtimeMin: 0 })).toBe(0);
  });

  it('counts a game dropped after a real try against it', () => {
    expect(game({ status: 'ABANDONED', playtimeMin: 600 })).toBe(-0.3);
    // Two hours or less: not enough to say it didn't work.
    expect(game({ status: 'ABANDONED', playtimeMin: 120 })).toBe(0);
  });

  it('learns nothing from "I won\'t play it" or the wishlist', () => {
    expect(game({ status: 'DISCARDED', playtimeMin: 600 })).toBe(0);
    expect(game({ status: 'WISHLIST' })).toBe(0);
  });

  it.each([
    [5, 1.5],
    [4, 1.25],
    [3, 1],
    [2, 0.4],
    [1, -0.5],
  ])('gives a completed game with %i stars a weight of %d', (stars, weight) => {
    expect(game({ status: 'COMPLETED', stars })).toBe(weight);
  });

  it.each([
    [3.5, 1.125],
    [4.5, 1.375],
    [1.5, -0.05],
    // Half a star counts as one: it can only go so low.
    [0.5, -0.5],
  ])('puts %d stars between the whole ones: %d', (stars, weight) => {
    expect(game({ status: 'COMPLETED', stars })).toBeCloseTo(weight, 5);
  });

  it('only counts the stars while the game is completed', () => {
    expect(game({ status: 'PLAYING', playtimeMin: 600, stars: 5 })).toBeCloseTo(
      0.61,
      2,
    );
  });
});
