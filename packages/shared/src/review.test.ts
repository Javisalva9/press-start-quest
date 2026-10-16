import { describe, expect, it } from 'vitest';
import { ReviewAnswerRequestSchema, ReviewQueueQuerySchema } from './review.js';

describe('ReviewQueueQuerySchema', () => {
  it('defaults to 20 cards and reads the limit from the URL', () => {
    expect(ReviewQueueQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ReviewQueueQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
  });

  it('caps the limit at 50', () => {
    expect(ReviewQueueQuerySchema.safeParse({ limit: '51' }).success).toBe(
      false,
    );
  });
});

describe('ReviewAnswerRequestSchema', () => {
  it.each(['finished', 'notFinished', 'abandoned', 'wontPlay'])(
    'accepts %s',
    (answer) => {
      expect(ReviewAnswerRequestSchema.safeParse({ answer }).success).toBe(
        true,
      );
    },
  );

  it('rejects anything else', () => {
    expect(
      ReviewAnswerRequestSchema.safeParse({ answer: 'maybe' }).success,
    ).toBe(false);
  });
});
