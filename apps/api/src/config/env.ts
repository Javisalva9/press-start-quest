import { z } from 'zod';

/**
 * Environment variables the API needs to start.
 * If one is missing or malformed, the API refuses to start and tells you which:
 * better to fail at boot than halfway through a request.
 * Keys for external services are added here as they start being used.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Web app URL: Steam sends users back there after they sign in.
  WEB_URL: z.url().default('http://localhost:5173'),
  // Signs access tokens. Generate one with:
  // node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
  JWT_SECRET: z.string().min(32),
  STEAM_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
