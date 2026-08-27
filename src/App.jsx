import React, { useEffect, useState } from 'react';
import Countdown from './components/Countdown.jsx';
import TodoList from './components/TodoList.jsx';
import Timeline from './components/Timeline.jsx';
import ServerControl from './components/ServerControl.jsx';
import AuthGate from './components/AuthGate.jsx';
import { useStore } from './store.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'server', label: 'Server', icon: '⚙️' },
];

export default function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  );
}

function Shell() {
  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const hash = window.location.hash.replace('#', '');
    return NAV.some((n) => n.id === hash) ? hash : 'dashboard';
  });
  const { session, actions, state } = useStore();

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (NAV.some((n) => n.id === hash)) setRoute(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTo = (id) => {
    setRoute(id);
    window.location.hash = id;
  };

  return (
    <div className="page">
      <header className="page-head">
        <div className="brand">
          <span className="brand-icon">🏠</span>
          <div>
            <div className="brand-title">Huis Dashboard</div>
            <div className="brand-sub">Verkoop Kloversdonk 51 · Verhuizing Bloemheuvellaan 51</div>
          </div>
        </div>
        <div className="header-right">
          <nav className="top-nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={`nav-tab ${route === item.id ? 'active' : ''}`}
                onClick={() => goTo(item.id)}
              >
                <span aria-hidden>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="user-chip">
            {session ? (
              <>
                <span className="dim">{session.user?.email}</span>
                <button className="btn ghost small" onClick={actions.signOut}>
                  Uitloggen
                </button>
              </>
            ) : state.localMode ? (
              <span className="pill accent" title="Lokale testmodus — data staat alleen in deze browser">
                Lokaal
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {state.syncError && (
        <div className="callout error-callout">
          Kon niet synchroniseren met Supabase: {state.syncError}
        </div>
      )}

      {route === 'dashboard' && (
        <>
          <div className="countdown-row">
            <Countdown stateKey="kloversdonkKeyDate" eyebrow="Sleutels Kloversdonk 51" />
            <Countdown stateKey="moveDate" eyebrow="Verhuisdatum" />
            <Countdown stateKey="keyDate" eyebrow="Sleutels Bloemheuvellaan 51" />
          </div>
          <div className="grid-2">
            <TodoList />
            <Timeline />
          </div>
        </>
      )}

      {route === 'server' && <ServerControl />}

      <footer className="page-foot">
        Data synchroniseert live via Supabase · dev-server via <code>npm run control</code>
      </footer>
    </div>
  );
}
