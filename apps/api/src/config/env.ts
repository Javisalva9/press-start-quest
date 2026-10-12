import { z } from 'zod';

/**
 * Variables de entorno que la API necesita para arrancar.
 * Si falta alguna o tiene un formato incorrecto, la API no arranca y te dice cuál:
 * mejor fallar al inicio que a mitad de una petición.
 * Las claves de Steam, IGDB, etc. se añadirán aquí cuando se usen (etapa 1).
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Variables de entorno no válidas:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
