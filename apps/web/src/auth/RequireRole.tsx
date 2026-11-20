import { Outlet, Link } from 'react-router';
import type { UserRole } from '@chillops/shared/auth';
import { useAuth } from './AuthContext';
import { PageHeader } from '../components/ui';
export function RequireRole({ roles }: { roles: readonly UserRole[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role))
    return (
      <>
        <PageHeader
          title="Access denied"
          description="Your role does not have access to jobs."
        />
        <Link to="/">Return to home</Link>
      </>
    );
  return <Outlet />;
}
