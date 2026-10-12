import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('accepts a valid response', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown database state', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      database: 'sleeping',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
