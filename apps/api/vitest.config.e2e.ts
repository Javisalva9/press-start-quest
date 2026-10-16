import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Dummy values: the database is replaced by a test double, and nothing
    // calls Steam for real.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'e2e-test-secret-that-is-at-least-32-characters',
      STEAM_API_KEY: 'e2e-test-steam-key',
      IGDB_CLIENT_ID: 'e2e-test-igdb-client',
      IGDB_CLIENT_SECRET: 'e2e-test-igdb-secret',
      JOBS_TOKEN: 'e2e-test-jobs-token-that-is-at-least-32-characters',
    },
  },
});
