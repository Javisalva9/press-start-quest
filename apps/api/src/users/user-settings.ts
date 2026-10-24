import {
  DEFAULT_WEIGHTS,
  RecommendationWeightsSchema,
  type RecommendationWeights,
  type UserSettings,
} from '@psq/shared';
import { z } from 'zod';

/**
 * What users.settings holds (JSON): only what the player changed. A
 * missing key means "the default", so a new default reaches everyone
 * who never touched it.
 */
const StoredSettingsSchema = z.object({
  weights: RecommendationWeightsSchema.optional(),
});

export type StoredSettings = z.infer<typeof StoredSettingsSchema>;

/**
 * Reads the JSON column. A key that doesn't validate any more (an old
 * shape, a hand edit) is dropped on its own, not the whole settings.
 */
export function readSettings(json: unknown): StoredSettings {
  const object =
    typeof json === 'object' && json !== null && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  const weights = RecommendationWeightsSchema.safeParse(object.weights);
  return StoredSettingsSchema.parse({
    weights: weights.success ? weights.data : undefined,
  });
}

/** The weights the recommendations use: the player's, else the plan's. */
export function weightsOf(stored: StoredSettings): RecommendationWeights {
  return stored.weights ?? DEFAULT_WEIGHTS;
}

/** The settings as the API sends them, with the defaults filled in. */
export function toUserSettings(stored: StoredSettings): UserSettings {
  return { weights: weightsOf(stored) };
}
