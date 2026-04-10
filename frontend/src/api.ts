const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface ApiRequestOptions extends RequestInit {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
}

export async function apiRequest(path: string, token: string, options: ApiRequestOptions = {}): Promise<unknown> {
  const hasBody = Object.prototype.hasOwnProperty.call(options, 'body') && options.body !== undefined;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Request failed');
  }

  return response.json();
}
