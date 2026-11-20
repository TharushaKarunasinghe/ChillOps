import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { PageHeader } from './components/ui';
import { HomePage } from './pages/HomePage';
import { StyleguidePage } from './pages/StyleguidePage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider } from './auth/AuthContext';
import { RequireSession } from './auth/RequireSession';
import { RequireRole } from './auth/RequireRole';
import { JobsQueryProvider } from './jobs/queries';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { NewJobPage } from './pages/NewJobPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <JobsQueryProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="styleguide" element={<StyleguidePage />} />
              <Route element={<RequireSession />}>
                <Route index element={<HomePage />} />
                <Route element={<RequireRole roles={['ops', 'director']} />}>
                  <Route path="jobs" element={<JobsPage />} />
                  <Route path="jobs/:id" element={<JobDetailPage />} />
                </Route>
                <Route element={<RequireRole roles={['ops']} />}>
                  <Route path="jobs/new" element={<NewJobPage />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <>
                      <PageHeader
                        title="Page not found"
                        description="This page is not available."
                      />
                      <Link to="/">Return to API health</Link>
                    </>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </JobsQueryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
