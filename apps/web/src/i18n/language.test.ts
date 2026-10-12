import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('ignora la región', () => {
    expect(detectLanguage(['es-ES'])).toBe('es');
    expect(detectLanguage(['en-GB'])).toBe('en');
  });

  it('respeta el orden de preferencia del móvil', () => {
    expect(detectLanguage(['en-US', 'es-ES'])).toBe('en');
  });

  it('salta los idiomas que la app no tiene', () => {
    expect(detectLanguage(['fr-FR', 'en-US'])).toBe('en');
  });

  it('usa español si no encaja ninguno', () => {
    expect(detectLanguage(['fr-FR', 'de'])).toBe('es');
    expect(detectLanguage([])).toBe('es');
  });

  it('no distingue mayúsculas', () => {
    expect(detectLanguage(['EN'])).toBe('en');
  });
});
