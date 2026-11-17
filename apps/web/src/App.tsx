import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { PageHeader } from './components/ui';
import { HomePage } from './pages/HomePage';
import { StyleguidePage } from './pages/StyleguidePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="styleguide" element={<StyleguidePage />} />
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
      </Routes>
    </BrowserRouter>
  );
}
