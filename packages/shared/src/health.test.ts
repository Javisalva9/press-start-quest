import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('acepta una respuesta válida', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un estado de base de datos desconocido', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      database: 'sleeping',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
