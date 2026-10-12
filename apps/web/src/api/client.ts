import { HealthResponseSchema, type HealthResponse } from '@psq/shared';

/** Joins the API base URL and a path, without double slashes. */
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
    throw new Error(`API responded with ${response.status}`);
  }
  // Validated with the same schema the API uses: if the contract changes, it fails here.
  return HealthResponseSchema.parse(await response.json());
}
