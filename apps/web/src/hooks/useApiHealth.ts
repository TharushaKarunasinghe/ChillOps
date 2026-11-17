import { useEffect, useState } from 'react';

export interface ApiHealth {
  state: 'checking' | 'connected' | 'unreachable';
  result: string;
}

async function checkHealth(): Promise<ApiHealth> {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (!apiUrl) {
    return {
      state: 'unreachable',
      result:
        'API URL is not configured. Set VITE_API_URL and restart or rebuild the web app.',
    };
  }
  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/health`);
    if (!response.ok) {
      return {
        state: 'unreachable',
        result: `API health check failed: HTTP ${response.status}.`,
      };
    }
    const body: unknown = await response.json();
    return { state: 'connected', result: JSON.stringify(body) };
  } catch {
    return {
      state: 'unreachable',
      result:
        'Unable to read API health. Check that the API is reachable, VITE_API_URL is correct, and WEB_ORIGIN allows this page.',
    };
  }
}

// Keep one request per document load, including React StrictMode's effect replay.
let healthRequest: Promise<ApiHealth> | undefined;

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>({
    state: 'checking',
    result: 'Checking API health...',
  });
  useEffect(() => {
    let subscribed = true;
    healthRequest ??= checkHealth();
    void healthRequest.then((result) => {
      if (subscribed) setHealth(result);
    });
    return () => {
      subscribed = false;
    };
  }, []);
  return health;
}
