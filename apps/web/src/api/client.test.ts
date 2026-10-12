import { describe, expect, it } from 'vitest';
import { apiUrl } from './client';

describe('apiUrl', () => {
  it('usa rutas relativas si no hay URL base', () => {
    expect(apiUrl('/api/health')).toBe('/api/health');
  });

  it('evita barras dobles', () => {
    expect(apiUrl('/api/health', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/health',
    );
  });

  it('añade la barra inicial si falta', () => {
    expect(apiUrl('api/health', 'https://api.example.com')).toBe(
      'https://api.example.com/api/health',
    );
  });
});
