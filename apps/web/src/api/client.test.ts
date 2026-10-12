import { describe, expect, it } from 'vitest';
import { apiUrl } from './client';

describe('apiUrl', () => {
  it('uses relative paths when there is no base URL', () => {
    expect(apiUrl('/api/health')).toBe('/api/health');
  });

  it('avoids double slashes', () => {
    expect(apiUrl('/api/health', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/health',
    );
  });

  it('adds the leading slash when missing', () => {
    expect(apiUrl('api/health', 'https://api.example.com')).toBe(
      'https://api.example.com/api/health',
    );
  });
});
