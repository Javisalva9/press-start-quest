import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  RecommendationWeightsSchema,
  UpdateMeRequestSchema,
  weightShares,
} from './settings.js';

describe('weightShares', () => {
  it("turns the default weights into the plan's formula", () => {
    expect(weightShares(DEFAULT_WEIGHTS)).toEqual({
      quality: 0.3,
      affinity: 0.3,
      length: 0.2,
      social: 0.1,
      momentum: 0.1,
    });
  });

  it('only cares about each share: 6-6-4-2-2 is the same formula', () => {
    expect(
      weightShares({
        quality: 6,
        affinity: 6,
        length: 4,
        social: 2,
        momentum: 2,
      }),
    ).toEqual(weightShares(DEFAULT_WEIGHTS));
  });
});

describe('RecommendationWeightsSchema', () => {
  it('rejects every factor at 0: nothing would rank', () => {
    expect(
      RecommendationWeightsSchema.safeParse({
        quality: 0,
        affinity: 0,
        length: 0,
        social: 0,
        momentum: 0,
      }).success,
    ).toBe(false);
  });

  it.each([[-1], [11], [2.5]])('rejects a weight of %s', (weight) => {
    expect(
      RecommendationWeightsSchema.safeParse({
        ...DEFAULT_WEIGHTS,
        quality: weight,
      }).success,
    ).toBe(false);
  });
});

describe('UpdateMeRequestSchema', () => {
  it('takes a language, weights, or null to restore them', () => {
    for (const body of [
      { locale: 'es' },
      { weights: DEFAULT_WEIGHTS },
      { weights: null },
    ]) {
      expect(UpdateMeRequestSchema.safeParse(body).success).toBe(true);
    }
  });

  it('rejects an empty change and unknown languages', () => {
    expect(UpdateMeRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateMeRequestSchema.safeParse({ locale: 'fr' }).success).toBe(
      false,
    );
  });
});
