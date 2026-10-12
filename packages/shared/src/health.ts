import { z } from 'zod';

/**
 * Respuesta de GET /api/health.
 * La API la construye y la web la valida con este mismo esquema,
 * así los dos lados nunca se desincronizan.
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.enum(['up', 'down']),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
