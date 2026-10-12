import { describe, expect, it } from 'vitest';
import { LibraryQuerySchema } from './library.js';

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
