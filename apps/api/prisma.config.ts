// Prisma 7 config: the connection URL no longer lives in schema.prisma.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Direct connection (no pooler): what migrations need.
  // Read with process.env (not Prisma's env()) so `prisma generate` works
  // without a database, e.g. in CI or during `pnpm install`.
  datasource: { url: process.env.DATABASE_URL_DIRECT },
});
