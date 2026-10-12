import { describe, expect, it } from 'vitest';
import { syncPhase } from './sync-phase';

describe('syncPhase', () => {
  it.each([
    ['QUEUED', 0, 'queued'],
    ['RUNNING', 5, 'library'],
    ['RUNNING', 14, 'library'],
    ['RUNNING', 15, 'wishlist'],
    ['RUNNING', 30, 'details'],
    ['RUNNING', 84, 'details'],
    ['RUNNING', 85, 'achievements'],
    ['DONE', 100, 'done'],
    ['FAILED', 40, 'failed'],
  ] as const)('%s at %i %% → %s', (status, progress, phase) => {
    expect(syncPhase({ status, progress })).toBe(phase);
  });
});
