import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('ignora la región', () => {
    expect(detectLanguage(['en-GB'])).toBe('en');
    expect(detectLanguage(['es-MX'])).toBe('es');
  });

  it('respeta el orden de preferencia del móvil', () => {
    expect(detectLanguage(['es-ES', 'en-US'])).toBe('es');
  });

  it('salta los idiomas que la app no tiene', () => {
    expect(detectLanguage(['fr-FR', 'es-ES'])).toBe('es');
  });

  it('usa inglés si no encaja ninguno', () => {
    expect(detectLanguage(['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('no distingue mayúsculas', () => {
    expect(detectLanguage(['ES'])).toBe('es');
  });
});
