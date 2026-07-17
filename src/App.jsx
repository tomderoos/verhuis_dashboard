import React, { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transacties from './pages/Transacties.jsx';
import Begroting from './pages/Begroting.jsx';
import Rapportages from './pages/Rapportages.jsx';
import Instellingen from './pages/Instellingen.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', component: Dashboard },
  { id: 'transacties', label: 'Transacties', icon: '💳', component: Transacties },
  { id: 'begroting', label: 'Begroting', icon: '🎯', component: Begroting },
  { id: 'rapportages', label: 'Rapportages', icon: '📈', component: Rapportages },
  { id: 'instellingen', label: 'Instellingen', icon: '⚙️', component: Instellingen },
];

export default function App() {
  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const hash = window.location.hash.replace('#', '');
    return NAV.some((n) => n.id === hash) ? hash : 'dashboard';
  });
  const { state } = useStore();

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (NAV.some((n) => n.id === hash)) setRoute(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const theme = state.settings.theme;
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [state.settings.theme]);

  const active = NAV.find((n) => n.id === route) || NAV[0];
  const ActiveComponent = active.component;

  const goTo = (id) => {
    setRoute(id);
    window.location.hash = id;
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏠</span>
          <span>Huis Dashboard</span>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${item.id === route ? 'active' : ''}`}
            onClick={() => goTo(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <div className="sidebar-footer">
          Data wordt lokaal opgeslagen in je browser.
        </div>
      </aside>
      <main className="main">
        <ActiveComponent onNavigate={goTo} />
      </main>
    </div>
  );
}
