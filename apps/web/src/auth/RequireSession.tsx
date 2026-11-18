import { Navigate, Outlet, useOutletContext } from 'react-router';
import { useAuth } from './AuthContext';
import type { ApiHealth } from '../hooks/useApiHealth';

export function RequireSession() {
  const { user, loading, error } = useAuth();
  const health = useOutletContext<ApiHealth>();
  if (loading) return <p role="status">Checking your session...</p>;
  if (error)
    return (
      <p role="alert" className="field-error">
        {error}
      </p>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet context={health} />;
}
