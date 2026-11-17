import { useOutletContext } from 'react-router';
import { PageHeader } from '../components/ui';
import type { ApiHealth } from '../hooks/useApiHealth';

export function HomePage() {
  const { result } = useOutletContext<ApiHealth>();

  return (
    <>
      <PageHeader
        title="API health"
        description="Connection status for the service operations API."
      />
      <section className="panel" aria-labelledby="health-heading">
        <h2 id="health-heading">Health response</h2>
        <p className="text-secondary text-sm mt-2">
          The web app requests the API health endpoint once when the app loads.
        </p>
        <p role="status" className="health-result">
          {result}
        </p>
      </section>
    </>
  );
}
