import { z } from 'zod';

/**
 * Response of GET /api/health.
 * The API builds it and the web app validates it with this same schema,
 * so both sides never drift apart.
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.enum(['up', 'down']),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
