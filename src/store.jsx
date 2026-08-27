import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient.js';

export const KEY_HANDOVER_DATE = '2026-12-18T10:00:00';
export const COUNTDOWN_KEYS = ['keyDate', 'moveDate', 'kloversdonkKeyDate'];

const IS_DEV = import.meta.env.DEV;
const LOCAL_KEY = 'verhuis-dashboard.local.v1';

const StoreContext = createContext(null);

const DEFAULT_LOCAL = {
  keyDate: KEY_HANDOVER_DATE,
  moveDate: null,
  kloversdonkKeyDate: null,
  todos: [
    { id: uid(), text: 'Woonkamer opruimen voor fotoshoot', done: false, comment: '' },
    { id: uid(), text: 'Kleine reparaties in de keuken', done: false, comment: '' },
    { id: uid(), text: 'Tuin bijhouden', done: false, comment: '' },
  ],
  events: [
    { id: uid(), date: today(), title: 'Makelaar langs voor waardebepaling', type: 'bezichtiging', notes: '' },
  ],
};

const DEFAULT_STATE = {
  keyDate: KEY_HANDOVER_DATE,
  moveDate: null,
  kloversdonkKeyDate: null,
  todos: [],
  events: [],
  loading: true,
  syncError: null,
  localMode: false,
};

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadLocal() {
  if (typeof window === 'undefined') return DEFAULT_LOCAL;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return DEFAULT_LOCAL;
    return { ...DEFAULT_LOCAL, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LOCAL;
  }
}

function saveLocal(state) {
  if (typeof window === 'undefined') return;
  const { loading, syncError, localMode, ...persistable } = state;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(persistable));
  } catch {}
}

function todoFromRow(row) {
  return {
    id: row.id,
    text: row.text,
    done: !!row.done,
    comment: row.comment || '',
    createdAt: row.created_at,
  };
}

function eventFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    type: row.type || 'klus',
    notes: row.notes || '',
  };
}

export function StoreProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState(DEFAULT_STATE);
  const channelsRef = useRef([]);
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    for (const ch of channelsRef.current) supabase.removeChannel(ch);
    channelsRef.current = [];

    if (!session) {
      if (IS_DEV) {
        const local = loadLocal();
        setState({ ...local, loading: false, syncError: null, localMode: true });
      } else {
        setState({ ...DEFAULT_STATE, loading: false });
      }
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, syncError: null, localMode: false }));

    (async () => {
      try {
        const [todosRes, eventsRes, settingsRes] = await Promise.all([
          supabase.from('todos').select('*').order('done').order('created_at', { ascending: false }),
          supabase.from('events').select('*').order('date'),
          supabase.from('settings').select('*').in('key', COUNTDOWN_KEYS),
        ]);
        if (cancelled) return;
        if (todosRes.error) throw todosRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const settingsMap = {};
        for (const row of settingsRes.data || []) {
          const v = row.value;
          settingsMap[row.key] = typeof v === 'string' ? v : v?.raw ?? null;
        }

        setState({
          keyDate: settingsMap.keyDate ?? KEY_HANDOVER_DATE,
          moveDate: settingsMap.moveDate ?? null,
          kloversdonkKeyDate: settingsMap.kloversdonkKeyDate ?? null,
          todos: (todosRes.data || []).map(todoFromRow),
          events: (eventsRes.data || []).map(eventFromRow),
          loading: false,
          syncError: null,
          localMode: false,
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Supabase load error', err);
        setState((s) => ({ ...s, loading: false, syncError: err.message || String(err) }));
      }
    })();

    const todosCh = supabase
      .channel('rt-todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
        setState((s) => applyTodoChange(s, payload));
      })
      .subscribe();

    const eventsCh = supabase
      .channel('rt-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        setState((s) => applyEventChange(s, payload));
      })
      .subscribe();

    const settingsCh = supabase
      .channel('rt-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        setState((s) => applySettingChange(s, payload));
      })
      .subscribe();

    channelsRef.current = [todosCh, eventsCh, settingsCh];

    return () => {
      cancelled = true;
      for (const ch of channelsRef.current) supabase.removeChannel(ch);
      channelsRef.current = [];
    };
  }, [session?.user?.id]);

  const actions = useMemo(() => makeActions(setState, sessionRef), []);

  const value = useMemo(
    () => ({ state, actions, session, authReady }),
    [state, actions, session, authReady]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function makeActions(setState, sessionRef) {
  const isLocal = () => !sessionRef.current;

  const localMutate = (mutator) => {
    setState((s) => {
      const next = mutator(s);
      saveLocal(next);
      return next;
    });
  };

  return {
    addTodo: async (text) => {
      const t = text.trim();
      if (!t) return;
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          todos: [{ id: uid(), text: t, done: false, comment: '' }, ...s.todos],
        }));
        return;
      }
      const { error } = await supabase.from('todos').insert({ text: t });
      if (error) console.error(error);
    },
    updateTodo: async (id, patch) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      const row = {};
      if ('text' in patch) row.text = patch.text;
      if ('done' in patch) row.done = patch.done;
      if ('comment' in patch) row.comment = patch.comment;
      const { error } = await supabase.from('todos').update(row).eq('id', id);
      if (error) console.error(error);
    },
    toggleTodo: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        }));
        return;
      }
      let next;
      setState((s) => {
        const todo = s.todos.find((t) => t.id === id);
        next = todo ? !todo.done : false;
        return { ...s, todos: s.todos.map((t) => (t.id === id ? { ...t, done: next } : t)) };
      });
      const { error } = await supabase.from('todos').update({ done: next }).eq('id', id);
      if (error) console.error(error);
    },
    removeTodo: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) console.error(error);
    },
    clearCompletedTodos: async () => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, todos: s.todos.filter((t) => !t.done) }));
        return;
      }
      setState((s) => ({ ...s, todos: s.todos.filter((t) => !t.done) }));
      const { error } = await supabase.from('todos').delete().eq('done', true);
      if (error) console.error(error);
    },

    addEvent: async (event) => {
      const row = {
        date: event.date,
        title: event.title,
        type: event.type || 'klus',
        notes: event.notes || '',
      };
      if (isLocal()) {
        localMutate((s) => ({ ...s, events: [{ id: uid(), ...row }, ...s.events] }));
        return;
      }
      const { error } = await supabase.from('events').insert(row);
      if (error) console.error(error);
    },
    updateEvent: async (id, patch) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
      const row = {};
      if ('date' in patch) row.date = patch.date;
      if ('title' in patch) row.title = patch.title;
      if ('type' in patch) row.type = patch.type;
      if ('notes' in patch) row.notes = patch.notes;
      const { error } = await supabase.from('events').update(row).eq('id', id);
      if (error) console.error(error);
    },
    removeEvent: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) console.error(error);
    },

    setCountdown: async (key, iso) => {
      if (!COUNTDOWN_KEYS.includes(key)) return;
      const value = iso && iso.length ? iso : null;
      if (isLocal()) {
        localMutate((s) => ({ ...s, [key]: value }));
        return;
      }
      setState((s) => ({ ...s, [key]: value }));
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) console.error(error);
    },

    signInWithEmail: async (email) => {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      return { error };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}

function applyTodoChange(state, payload) {
  const type = payload.eventType;
  if (type === 'INSERT') {
    const t = todoFromRow(payload.new);
    if (state.todos.some((x) => x.id === t.id)) return state;
    return { ...state, todos: [t, ...state.todos] };
  }
  if (type === 'UPDATE') {
    const t = todoFromRow(payload.new);
    return { ...state, todos: state.todos.map((x) => (x.id === t.id ? t : x)) };
  }
  if (type === 'DELETE') {
    return { ...state, todos: state.todos.filter((x) => x.id !== payload.old.id) };
  }
  return state;
}

function applyEventChange(state, payload) {
  const type = payload.eventType;
  if (type === 'INSERT') {
    const e = eventFromRow(payload.new);
    if (state.events.some((x) => x.id === e.id)) return state;
    return { ...state, events: [...state.events, e] };
  }
  if (type === 'UPDATE') {
    const e = eventFromRow(payload.new);
    return { ...state, events: state.events.map((x) => (x.id === e.id ? e : x)) };
  }
  if (type === 'DELETE') {
    return { ...state, events: state.events.filter((x) => x.id !== payload.old.id) };
  }
  return state;
}

function applySettingChange(state, payload) {
  const row = payload.new || payload.old;
  if (!row || !COUNTDOWN_KEYS.includes(row.key)) return state;
  if (payload.eventType === 'DELETE') {
    return { ...state, [row.key]: row.key === 'keyDate' ? KEY_HANDOVER_DATE : null };
  }
  const v = payload.new.value;
  const value = typeof v === 'string' ? v : v?.raw ?? null;
  return { ...state, [row.key]: value };
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore moet binnen <StoreProvider> gebruikt worden');
  return ctx;
}
