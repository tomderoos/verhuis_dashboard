import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import Countdown from './components/Countdown.jsx';
import TodoList from './components/TodoList.jsx';
import Timeline from './components/Timeline.jsx';
import Agenda from './components/Agenda.jsx';
import Weather from './components/Weather.jsx';
import Expenses from './components/Expenses.jsx';
import SaleItems from './components/SaleItems.jsx';
import Finances from './components/Finances.jsx';
import ServerControl from './components/ServerControl.jsx';
import AuthGate from './components/AuthGate.jsx';
import DashSection from './components/DashSection.jsx';
import { useStore } from './store.jsx';

const LAYOUT_KEY = 'huis-dashboard.layout.v1';
const DEFAULT_SECTIONS = ['todos', 'timeline', 'agenda'];
const SECTION_META = {
  todos: { title: 'To do — huidige huis' },
  timeline: { title: 'Timeline — klussen & bezichtigingen' },
  agenda: { title: 'Agenda — plan je klussen' },
};

function loadLayout() {
  if (typeof window === 'undefined') return { order: DEFAULT_SECTIONS, collapsed: {} };
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { order: DEFAULT_SECTIONS, collapsed: {} };
    const parsed = JSON.parse(raw);
    const order = Array.isArray(parsed.order)
      ? [...parsed.order.filter((id) => DEFAULT_SECTIONS.includes(id)), ...DEFAULT_SECTIONS.filter((id) => !parsed.order.includes(id))]
      : DEFAULT_SECTIONS;
    return { order, collapsed: parsed.collapsed || {} };
  } catch {
    return { order: DEFAULT_SECTIONS, collapsed: {} };
  }
}
function saveLayout(layout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {}
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'financien', label: 'Financiën', icon: '💶' },
  { id: 'uitgaven', label: 'Verbouwing', icon: '💰' },
  { id: 'verkopen', label: 'Verkopen', icon: '🏷️' },
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

  const headerImg = `${import.meta.env.BASE_URL}header.jpg`;

  return (
    <div className="page">
      <header
        className="hero"
        style={{ backgroundImage: `url(${headerImg})` }}
      >
        <div className="hero-overlay">
          <div className="hero-top">
            <div className="brand">
              <span className="brand-icon">🏠</span>
              <div>
                <div className="brand-title">Huis Dashboard</div>
                <div className="brand-sub">
                  <span className="brand-sub-part">Verkoop Kloversdonk 213</span>
                  <span className="brand-sub-sep"> · </span>
                  <a
                    href="https://www.funda.nl/detail/koop/apeldoorn/huis-bloemheuvellaan-51/44475822/"
                    target="_blank"
                    rel="noreferrer"
                    className="brand-link brand-sub-part"
                  >
                    Verhuizing Bloemheuvellaan 51
                  </a>
                </div>
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
                  <span
                    className="pill accent"
                    title="Lokale testmodus — data staat alleen in deze browser"
                  >
                    Lokaal
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      {state.syncError && (
        <div className="callout error-callout">
          Kon niet synchroniseren met Supabase: {state.syncError}
        </div>
      )}

      {route === 'dashboard' && <DashboardBody />}

      {route === 'financien' && <Finances />}

      {route === 'uitgaven' && <Expenses />}

      {route === 'verkopen' && <SaleItems />}

      {route === 'server' && <ServerControl />}

      <footer className="page-foot">
        Data synchroniseert live via Supabase · dev-server via <code>npm run control</code>
      </footer>
    </div>
  );
}

function DashboardBody() {
  const [layout, setLayout] = useState(loadLayout);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggle = (id) =>
    setLayout((l) => ({ ...l, collapsed: { ...l.collapsed, [id]: !l.collapsed[id] } }));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setLayout((l) => {
      const from = l.order.indexOf(active.id);
      const to = l.order.indexOf(over.id);
      if (from < 0 || to < 0) return l;
      return { ...l, order: arrayMove(l.order, from, to) };
    });
  };

  const renderSection = (id) => {
    if (id === 'todos') return <TodoList />;
    if (id === 'timeline') return <Timeline />;
    if (id === 'agenda') return <Agenda />;
    return null;
  };

  return (
    <>
      <div className="countdown-row countdown-row-4">
        <Countdown stateKey="salePrepDate" eyebrow="Klaar voor verkoop" />
        <Countdown stateKey="kloversdonkKeyDate" eyebrow="Overdracht Kloversdonk 213" />
        <Countdown stateKey="moveDate" eyebrow="Verhuisdatum" />
        <Countdown stateKey="keyDate" eyebrow="Sleutels Bloemheuvellaan 51" />
      </div>
      <Weather />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.order} strategy={verticalListSortingStrategy}>
          <div className="dash-sections">
            {layout.order.map((id) => (
              <DashSection
                key={id}
                id={id}
                title={SECTION_META[id]?.title || id}
                collapsed={!!layout.collapsed[id]}
                onToggle={() => toggle(id)}
              >
                {renderSection(id)}
              </DashSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}
