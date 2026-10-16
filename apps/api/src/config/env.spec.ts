import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(48),
  STEAM_API_KEY: 'key',
  IGDB_CLIENT_ID: 'id',
  IGDB_CLIENT_SECRET: 'secret',
};

describe('validateEnv: JOBS_TOKEN', () => {
  it('is optional, and an empty line counts as not set', () => {
    expect(validateEnv(base).JOBS_TOKEN).toBeUndefined();
    expect(validateEnv({ ...base, JOBS_TOKEN: '' }).JOBS_TOKEN).toBeUndefined();
  });

  it('needs at least 32 characters when set', () => {
    expect(() => validateEnv({ ...base, JOBS_TOKEN: 'short' })).toThrow(
      /JOBS_TOKEN/,
    );
    expect(
      validateEnv({ ...base, JOBS_TOKEN: 't'.repeat(48) }).JOBS_TOKEN,
    ).toBe('t'.repeat(48));
  });
});
