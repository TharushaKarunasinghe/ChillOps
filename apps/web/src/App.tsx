import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { PageHeader } from './components/ui';
import { HomePage } from './pages/HomePage';
import { StyleguidePage } from './pages/StyleguidePage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider } from './auth/AuthContext';
import { RequireSession } from './auth/RequireSession';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="styleguide" element={<StyleguidePage />} />
            <Route element={<RequireSession />}>
              <Route index element={<HomePage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
