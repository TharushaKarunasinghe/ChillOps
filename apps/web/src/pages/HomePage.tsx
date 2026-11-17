import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/ui';

export function HomePage() {
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
    <>
      <PageHeader
        title="API health"
        description="Connection status for the service operations API."
        actions={<Link to="/styleguide">Open styleguide</Link>}
      />
      <section className="panel" aria-labelledby="health-heading">
        <h2 id="health-heading">Health response</h2>
        <p className="text-secondary text-sm mt-2">
          The web app requests the API health endpoint when this page opens.
        </p>
        <p role="status" className="health-result">
          {result}
        </p>
      </section>
    </>
  );
}
