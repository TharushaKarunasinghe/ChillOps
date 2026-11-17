import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { APP_NAME } from '@chillops/shared';
import { useApiHealth } from '../hooks/useApiHealth';

export function AppShell() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const health = useApiHealth();

  useEffect(() => {
    const query = window.matchMedia('(min-width: 48rem)');
    const reset = () => {
      if (
        !query.matches &&
        navigation.current?.contains(document.activeElement)
      )
        toggle.current?.focus();
      setOpen(false);
    };
    query.addEventListener('change', reset);
    return () => query.removeEventListener('change', reset);
  }, []);

  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand">{APP_NAME}</span>
          <button
            ref={toggle}
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav
          ref={navigation}
          id="main-navigation"
          className="navigation"
          data-open={open}
          aria-label="Main navigation"
        >
          <ul>
            {['Jobs', 'Roster', 'Stock', 'Reports'].map((name) => (
              <li key={name} aria-disabled="true" className="nav-placeholder">
                <span>{name}</span>
                <small>Not built yet</small>
              </li>
            ))}
          </ul>
          <p className="nav-caption">SYSTEM</p>
          <ul>
            <li>
              <NavLink to="/" end onClick={() => setOpen(false)}>
                API health
              </NavLink>
            </li>
            <li>
              <NavLink to="/styleguide" onClick={() => setOpen(false)}>
                Styleguide
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="main-column">
        <div className="topbar">
          <span className="text-secondary" aria-live="polite">
            {health.state === 'checking'
              ? 'Checking API...'
              : health.state === 'connected'
                ? 'API connected'
                : 'API unreachable'}
          </span>
        </div>
        <main id="main-content" tabIndex={-1} className="content">
          <Outlet context={health} />
        </main>
      </div>
    </div>
  );
}
