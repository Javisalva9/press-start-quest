import { chunk } from './chunk.js';

describe('chunk', () => {
  it('splits a list into pieces of the given size, the last one shorter', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no pieces for an empty list', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});
