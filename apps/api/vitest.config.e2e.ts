import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Valor ficticio: la base de datos se sustituye por un doble en los tests.
    env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
  },
});
