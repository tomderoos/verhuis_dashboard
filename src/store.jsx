import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { uid } from './utils/uid.js';

const STORAGE_KEY = 'huis-verkoop-dashboard.v1';

export const KEY_HANDOVER_DATE = '2026-12-18T10:00:00';

const DEFAULT_TODOS = [
  { id: uid('todo'), text: 'Woonkamer opruimen voor fotoshoot', done: false, comment: '' },
  { id: uid('todo'), text: 'Kleine reparaties in de keuken', done: false, comment: '' },
  { id: uid('todo'), text: 'Tuin bijhouden', done: false, comment: '' },
];

const DEFAULT_EVENTS = [
  {
    id: uid('evt'),
    date: new Date().toISOString().slice(0, 10),
    title: 'Makelaar langs voor waardebepaling',
    type: 'bezichtiging',
    notes: '',
  },
];

const DEFAULT_STATE = {
  version: 1,
  keyDate: KEY_HANDOVER_DATE,
  todos: DEFAULT_TODOS,
  events: DEFAULT_EVENTS,
};

function loadState() {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      todos: Array.isArray(parsed.todos) ? parsed.todos : DEFAULT_TODOS,
      events: Array.isArray(parsed.events) ? parsed.events : DEFAULT_EVENTS,
    };
  } catch (err) {
    console.warn('Kon opgeslagen data niet lezen, opnieuw beginnen.', err);
    return DEFAULT_STATE;
  }
}

function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Opslaan mislukt.', err);
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const actions = useMemo(
    () => ({
      setKeyDate: (iso) => setState((s) => ({ ...s, keyDate: iso })),

      addTodo: (text) =>
        setState((s) => ({
          ...s,
          todos: [{ id: uid('todo'), text, done: false, comment: '' }, ...s.todos],
        })),
      updateTodo: (id, patch) =>
        setState((s) => ({
          ...s,
          todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      toggleTodo: (id) =>
        setState((s) => ({
          ...s,
          todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),
      removeTodo: (id) =>
        setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) })),
      clearCompletedTodos: () =>
        setState((s) => ({ ...s, todos: s.todos.filter((t) => !t.done) })),

      addEvent: (event) =>
        setState((s) => ({
          ...s,
          events: [{ id: uid('evt'), notes: '', type: 'klus', ...event }, ...s.events],
        })),
      updateEvent: (id, patch) =>
        setState((s) => ({
          ...s,
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEvent: (id) =>
        setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) })),

      resetAll: () => setState(DEFAULT_STATE),
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore moet binnen <StoreProvider> gebruikt worden');
  return ctx;
}
