// Configuración de Prisma 7: la URL de conexión ya no va en schema.prisma.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Conexión directa (sin pooler): la que necesitan las migraciones.
  // Se lee con process.env (y no con env() de Prisma) para que `prisma generate`
  // funcione sin base de datos, por ejemplo en el CI o al hacer `pnpm install`.
  datasource: { url: process.env.DATABASE_URL_DIRECT },
});
