import { describe, expect, it } from 'vitest';
import {
  LibraryQuerySchema,
  UpdateLibraryGameRequestSchema,
} from './library.js';

describe('LibraryQuerySchema', () => {
  it('fills in the defaults', () => {
    expect(LibraryQuerySchema.parse({})).toEqual({
      view: 'library',
      sort: 'lastPlayed',
      page: 1,
      pageSize: 50,
    });
  });

  it('reads comma-separated statuses and numbers from the URL', () => {
    expect(
      LibraryQuerySchema.parse({
        status: 'BACKLOG,PLAYING',
        page: '2',
        pageSize: '20',
      }),
    ).toMatchObject({ status: ['BACKLOG', 'PLAYING'], page: 2, pageSize: 20 });
  });

  it.each([
    [{ status: 'BACKLOG,NOPE' }],
    [{ pageSize: '500' }],
    [{ sort: 'random' }],
    [{ q: '   ' }],
  ])('rejects invalid values: %o', (query) => {
    expect(LibraryQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('UpdateLibraryGameRequestSchema', () => {
  it('accepts any of the fields, and null to go back to automatic', () => {
    expect(
      UpdateLibraryGameRequestSchema.safeParse({ status: 'COMPLETED' }).success,
    ).toBe(true);
    expect(
      UpdateLibraryGameRequestSchema.safeParse({
        status: null,
        gameType: 'ENDLESS',
        serverStatus: null,
      }).success,
    ).toBe(true);
  });

  it('accepts 0.5 to 5 stars in half steps, or null to take them back', () => {
    for (const personalRating of [0.5, 3.5, 5, null]) {
      expect(
        UpdateLibraryGameRequestSchema.safeParse({ personalRating }).success,
      ).toBe(true);
    }
    for (const personalRating of [0, 3.7, 5.5]) {
      expect(
        UpdateLibraryGameRequestSchema.safeParse({ personalRating }).success,
      ).toBe(false);
    }
  });

  it('takes back a "not now" with null', () => {
    expect(
      UpdateLibraryGameRequestSchema.safeParse({ snoozedUntil: null }).success,
    ).toBe(true);
  });

  it('rejects an empty change', () => {
    expect(UpdateLibraryGameRequestSchema.safeParse({}).success).toBe(false);
  });

  it.each([
    [{ status: 'WISHLIST' }],
    [{ gameType: 'UNKNOWN' }],
    [{ serverStatus: 'UNKNOWN' }],
    // "Not now" is set from the recommendation card, with its own length.
    [{ snoozedUntil: '2026-11-01T00:00:00.000Z' }],
  ])('rejects what only the app or the store sets: %o', (body) => {
    expect(UpdateLibraryGameRequestSchema.safeParse(body).success).toBe(false);
  });
});
