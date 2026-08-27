import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient.js';

export const KEY_HANDOVER_DATE = '2026-12-18T10:00:00';

const StoreContext = createContext(null);

const DEFAULT_STATE = {
  keyDate: KEY_HANDOVER_DATE,
  todos: [],
  events: [],
  loading: true,
  syncError: null,
};

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
      setState({ ...DEFAULT_STATE, loading: false });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, syncError: null }));

    (async () => {
      try {
        const [todosRes, eventsRes, settingsRes] = await Promise.all([
          supabase.from('todos').select('*').order('done').order('created_at', { ascending: false }),
          supabase.from('events').select('*').order('date'),
          supabase.from('settings').select('*').eq('key', 'keyDate').maybeSingle(),
        ]);
        if (cancelled) return;
        if (todosRes.error) throw todosRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const keyDate =
          (settingsRes.data && (settingsRes.data.value?.raw || settingsRes.data.value)) ||
          KEY_HANDOVER_DATE;

        setState({
          keyDate: typeof keyDate === 'string' ? keyDate : KEY_HANDOVER_DATE,
          todos: (todosRes.data || []).map(todoFromRow),
          events: (eventsRes.data || []).map(eventFromRow),
          loading: false,
          syncError: null,
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

  const actions = useMemo(() => makeActions(setState), []);

  const value = useMemo(
    () => ({ state, actions, session, authReady }),
    [state, actions, session, authReady]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function makeActions(setState) {
  return {
    addTodo: async (text) => {
      const t = text.trim();
      if (!t) return;
      const { error } = await supabase.from('todos').insert({ text: t }).select().single();
      if (error) console.error(error);
    },
    updateTodo: async (id, patch) => {
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
      setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) console.error(error);
    },
    clearCompletedTodos: async () => {
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
      const { error } = await supabase.from('events').insert(row);
      if (error) console.error(error);
    },
    updateEvent: async (id, patch) => {
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
      setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) console.error(error);
    },

    setKeyDate: async (iso) => {
      setState((s) => ({ ...s, keyDate: iso }));
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'keyDate', value: iso }, { onConflict: 'key' });
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
  if (!row || row.key !== 'keyDate') return state;
  if (payload.eventType === 'DELETE') return { ...state, keyDate: KEY_HANDOVER_DATE };
  const v = payload.new.value;
  const keyDate = typeof v === 'string' ? v : v?.raw || KEY_HANDOVER_DATE;
  return { ...state, keyDate };
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore moet binnen <StoreProvider> gebruikt worden');
  return ctx;
}
