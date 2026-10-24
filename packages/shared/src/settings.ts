import { z } from 'zod';
import { LanguageSchema } from './language.js';

/** The five factors of the recommendation formula, in the plan's order. */
export const RECOMMENDATION_FACTORS = [
  'quality',
  'affinity',
  'length',
  'social',
  'momentum',
] as const;

export type RecommendationFactor = (typeof RECOMMENDATION_FACTORS)[number];

/** Each weight goes from 0 (ignore it) to this, in whole steps. */
export const MAX_WEIGHT = 10;

/**
 * How much each factor counts, as whole numbers: what matters is each
 * one's share of the total, so 3-3-2-1-1 is 30 %, 30 %, 20 %, 10 % and
 * 10 %. Easier to move on a phone than decimals that must add up to 1.
 */
export const RecommendationWeightsSchema = z
  .object({
    quality: z.number().int().min(0).max(MAX_WEIGHT),
    affinity: z.number().int().min(0).max(MAX_WEIGHT),
    length: z.number().int().min(0).max(MAX_WEIGHT),
    social: z.number().int().min(0).max(MAX_WEIGHT),
    momentum: z.number().int().min(0).max(MAX_WEIGHT),
  })
  .refine((weights) => Object.values(weights).some((weight) => weight > 0), {
    message: 'At least one factor must count',
  });

export type RecommendationWeights = z.infer<typeof RecommendationWeightsSchema>;

/** The plan's formula: 0.30 N + 0.30 A + 0.20 D + 0.10 S + 0.10 I. */
export const DEFAULT_WEIGHTS: RecommendationWeights = {
  quality: 3,
  affinity: 3,
  length: 2,
  social: 1,
  momentum: 1,
};

/** Each weight's share of the total, 0–1: they add up to 1. */
export function weightShares(
  weights: RecommendationWeights,
): Record<RecommendationFactor, number> {
  const total = RECOMMENDATION_FACTORS.reduce(
    (sum, factor) => sum + weights[factor],
    0,
  );
  return Object.fromEntries(
    RECOMMENDATION_FACTORS.map((factor) => [
      factor,
      total > 0 ? weights[factor] / total : 0,
    ]),
  ) as Record<RecommendationFactor, number>;
}

/** The player's settings, as the API sends them: defaults filled in. */
export const UserSettingsSchema = z.object({
  weights: RecommendationWeightsSchema,
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

/**
 * Body of PATCH /api/me. Each field is optional; weights null go back to
 * the plan's.
 */
export const UpdateMeRequestSchema = z
  .object({
    locale: LanguageSchema.optional(),
    weights: RecommendationWeightsSchema.nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Nothing to change',
  });

export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;
