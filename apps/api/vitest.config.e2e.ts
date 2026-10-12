import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Dummy value: the database is replaced by a test double in these tests.
    env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
  },
});
