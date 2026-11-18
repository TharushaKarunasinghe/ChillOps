import { useEffect, useState } from 'react';

export interface ApiHealth {
  state: 'checking' | 'connected' | 'unreachable';
  result: string;
}

async function checkHealth(): Promise<ApiHealth> {
  try {
    const response = await fetch('/api/health');
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
        'Unable to read API health. Check that the API is reachable and try reloading the page.',
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
