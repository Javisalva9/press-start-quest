import { HealthResponseSchema, type HealthResponse } from '@psq/shared';

/** Une la URL base de la API con una ruta, sin barras dobles. */
export function apiUrl(path: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/+$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${base}${route}`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(
    apiUrl('/api/health', import.meta.env.VITE_API_URL),
  );
  if (!response.ok) {
    throw new Error(`La API respondió ${response.status}`);
  }
  // Se valida con el mismo esquema que usa la API: si cambia el contrato, falla aquí.
  return HealthResponseSchema.parse(await response.json());
}
