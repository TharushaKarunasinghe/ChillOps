import { APP_NAME } from '@chillops/shared';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

document.title = APP_NAME;

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

function App() {
  const [result, setResult] = useState('Checking API health...');

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL?.trim();

    async function checkHealth() {
      if (!apiUrl) {
        setResult(
          'API URL is not configured. Set VITE_API_URL and restart or rebuild the web app.',
        );
        return;
      }

      try {
        const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/health`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setResult(`API health check failed: HTTP ${response.status}.`);
          return;
        }
        const body: unknown = await response.json();
        if (!controller.signal.aborted) setResult(JSON.stringify(body));
      } catch {
        if (!controller.signal.aborted) {
          setResult(
            'Unable to read API health. Check that the API is reachable, VITE_API_URL is correct, and WEB_ORIGIN allows this page.',
          );
        }
      }
    }

    void checkHealth();
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p role="status">{result}</p>
    </main>
  );
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
