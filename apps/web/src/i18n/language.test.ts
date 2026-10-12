import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('ignores the region', () => {
    expect(detectLanguage(['en-GB'])).toBe('en');
    expect(detectLanguage(['es-MX'])).toBe('es');
  });

  it("follows the device's order of preference", () => {
    expect(detectLanguage(['es-ES', 'en-US'])).toBe('es');
  });

  it('skips languages the app does not have', () => {
    expect(detectLanguage(['fr-FR', 'es-ES'])).toBe('es');
  });

  it('falls back to English when none match', () => {
    expect(detectLanguage(['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(detectLanguage(['ES'])).toBe('es');
  });
});
