const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function apiRequest(path, token, options = {}) {
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
    throw new Error(data.error || 'Request failed');
  }

  return response.json();
}
