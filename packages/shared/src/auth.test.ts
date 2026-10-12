import { describe, expect, it } from 'vitest';
import { SteamLoginRequestSchema } from './auth.js';

describe('SteamLoginRequestSchema', () => {
  it('accepts the Steam query string and an optional language', () => {
    expect(
      SteamLoginRequestSchema.safeParse({ query: '?openid.mode=id_res' })
        .success,
    ).toBe(true);
    expect(
      SteamLoginRequestSchema.safeParse({
        query: '?openid.mode=id_res',
        language: 'es',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty query or an unsupported language', () => {
    expect(SteamLoginRequestSchema.safeParse({ query: '' }).success).toBe(
      false,
    );
    expect(
      SteamLoginRequestSchema.safeParse({ query: '?a=b', language: 'fr' })
        .success,
    ).toBe(false);
  });
});
