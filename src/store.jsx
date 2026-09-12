import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { BUDGET_INCOME, BUDGET_EXPENSES } from './data/financeSeed.js';

export const KEY_HANDOVER_DATE = '2026-12-18T10:00:00';
export const COUNTDOWN_KEYS = ['keyDate', 'moveDate', 'kloversdonkKeyDate', 'salePrepDate'];
export const FINANCE_START_BALANCE_KEY = 'financeStartBalance';
const SETTINGS_KEYS = [...COUNTDOWN_KEYS, FINANCE_START_BALANCE_KEY];

const INCOME_COLORS = ['#10b981', '#14b8a6', '#22c55e', '#84cc16', '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6'];
const EXPENSE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c', '#64748b',
];

const IS_DEV = import.meta.env.DEV;
const LOCAL_KEY = 'verhuis-dashboard.local.v1';

const StoreContext = createContext(null);

function buildLocalFinance() {
  const categories = [];
  const budget = {};
  BUDGET_INCOME.forEach((row, idx) => {
    const id = uid();
    categories.push({
      id,
      name: row.name,
      type: 'income',
      color: INCOME_COLORS[idx % INCOME_COLORS.length],
      sortOrder: idx,
    });
    budget[id] = { ...row.amounts };
  });
  BUDGET_EXPENSES.forEach((row, idx) => {
    const id = uid();
    categories.push({
      id,
      name: row.name,
      type: 'expense',
      color: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
      sortOrder: idx,
    });
    budget[id] = { ...row.amounts };
  });
  return { categories, budget, transactions: [] };
}

const DEFAULT_LOCAL = {
  keyDate: KEY_HANDOVER_DATE,
  moveDate: null,
  kloversdonkKeyDate: null,
  salePrepDate: null,
  financeStartBalance: 0,
  todos: [
    { id: uid(), text: 'Opruimen voor fotoshoot', done: false, comment: '', room: 'Woonkamer', sortOrder: 1 },
    { id: uid(), text: 'Kleine reparaties', done: false, comment: '', room: 'Keuken', sortOrder: 2 },
    { id: uid(), text: 'Bijhouden', done: false, comment: '', room: 'Tuin', sortOrder: 3 },
  ],
  events: [
    { id: uid(), date: today(), title: 'Makelaar langs voor waardebepaling', type: 'bezichtiging', notes: '' },
  ],
  expenses: [
    { id: uid(), description: 'Muurverf woonkamer', category: 'verf', amount: 85.5, planned: true, date: today(), notes: '' },
  ],
  saleItems: [
    { id: uid(), title: 'Oude eettafel', platform: 'marktplaats', url: '', askingPrice: 75, sold: false, soldPrice: null, notes: '' },
  ],
  ...buildLocalFinance(),
};

const DEFAULT_STATE = {
  keyDate: KEY_HANDOVER_DATE,
  moveDate: null,
  kloversdonkKeyDate: null,
  salePrepDate: null,
  financeStartBalance: 0,
  todos: [],
  events: [],
  expenses: [],
  saleItems: [],
  categories: [],
  budget: {},
  transactions: [],
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

function reportWriteError(setState, error) {
  console.error('Supabase write error', error);
  const msg = (error && (error.message || error.hint || String(error))) || 'Onbekende fout';
  setState((s) => ({ ...s, syncError: msg }));
}

const CLOCK_SKEW_SIGNALS = ['issued at future', 'jwt', 'iat', 'nbf'];

async function retryOnClockSkew(fn, keepGoing, { maxAttempts = 5, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = ((err && (err.message || err.error || '')) + '').toLowerCase();
      const transient = CLOCK_SKEW_SIGNALS.some((s) => msg.includes(s));
      if (!transient || !keepGoing()) throw err;
      try {
        await supabase.auth.refreshSession();
      } catch {}
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

function todoFromRow(row) {
  const createdAt = row.created_at;
  const fallbackSort = createdAt ? new Date(createdAt).getTime() : Date.now();
  return {
    id: row.id,
    text: row.text,
    done: !!row.done,
    comment: row.comment || '',
    room: row.room || '',
    plannedDate: row.planned_date || null,
    createdAt,
    sortOrder: row.sort_order == null ? fallbackSort : Number(row.sort_order),
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

function expenseFromRow(row) {
  return {
    id: row.id,
    description: row.description,
    category: row.category || 'overig',
    amount: Number(row.amount) || 0,
    planned: !!row.planned,
    date: row.date,
    notes: row.notes || '',
  };
}

function saleItemFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform || 'marktplaats',
    url: row.url || '',
    askingPrice: Number(row.asking_price) || 0,
    sold: !!row.sold,
    soldPrice: row.sold_price == null ? null : Number(row.sold_price),
    notes: row.notes || '',
  };
}

function financeCategoryFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type === 'income' ? 'income' : 'expense',
    color: row.color || '#64748b',
    sortOrder: row.sort_order == null ? 0 : Number(row.sort_order),
    weeklyTarget: row.weekly_target == null ? null : Number(row.weekly_target),
  };
}

function financeTransactionFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    categoryId: row.category_id,
    description: row.description || '',
    amount: Number(row.amount) || 0,
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
      const loadOne = (label, run) =>
        retryOnClockSkew(async () => {
          const res = await run();
          if (res.error) throw res.error;
          return res.data;
        }, () => !cancelled).catch((err) => ({ __failed: true, label, err }));

      const [todos, events, expenses, saleItems, settings, financeCategories, financeBudget, financeTx] = await Promise.all([
        loadOne('todos', () =>
          supabase.from('todos').select('*').order('done').order('sort_order', { ascending: true, nullsFirst: false })
        ),
        loadOne('events', () => supabase.from('events').select('*').order('date')),
        loadOne('expenses', () =>
          supabase.from('expenses').select('*').order('date', { ascending: false })
        ),
        loadOne('sale_items', () =>
          supabase.from('sale_items').select('*').order('sold').order('created_at', { ascending: false })
        ),
        loadOne('settings', () => supabase.from('settings').select('*').in('key', SETTINGS_KEYS)),
        loadOne('finance_categories', () =>
          supabase.from('finance_categories').select('*').order('sort_order', { ascending: true, nullsFirst: false })
        ),
        loadOne('finance_budget_entries', () => supabase.from('finance_budget_entries').select('*')),
        loadOne('finance_transactions', () =>
          supabase.from('finance_transactions').select('*').order('date', { ascending: false })
        ),
      ]);
      if (cancelled) return;

      const failures = [todos, events, expenses, saleItems, settings, financeCategories, financeBudget, financeTx].filter((r) => r && r.__failed);
      const asRows = (r) => (r && r.__failed ? [] : r || []);

      const settingsMap = {};
      for (const row of asRows(settings)) {
        const v = row.value;
        settingsMap[row.key] = typeof v === 'string' ? v : typeof v === 'number' ? v : v?.raw ?? null;
      }

      const categories = asRows(financeCategories).map(financeCategoryFromRow);
      const budget = {};
      for (const row of asRows(financeBudget)) {
        const key = row.category_id;
        if (!budget[key]) budget[key] = {};
        budget[key][row.month] = Number(row.amount) || 0;
      }
      const transactions = asRows(financeTx).map(financeTransactionFromRow);

      const syncError = failures.length
        ? failures.map((f) => `${f.label}: ${f.err.message || f.err}`).join(' · ')
        : null;
      if (failures.length) console.error('Supabase load errors', failures);

      setState({
        keyDate: settingsMap.keyDate ?? KEY_HANDOVER_DATE,
        moveDate: settingsMap.moveDate ?? null,
        kloversdonkKeyDate: settingsMap.kloversdonkKeyDate ?? null,
        salePrepDate: settingsMap.salePrepDate ?? null,
        financeStartBalance: Number(settingsMap.financeStartBalance) || 0,
        todos: asRows(todos).map(todoFromRow),
        events: asRows(events).map(eventFromRow),
        expenses: asRows(expenses).map(expenseFromRow),
        saleItems: asRows(saleItems).map(saleItemFromRow),
        categories,
        budget,
        transactions,
        loading: false,
        syncError,
        localMode: false,
      });
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

    const expensesCh = supabase
      .channel('rt-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        setState((s) => applyExpenseChange(s, payload));
      })
      .subscribe();

    const saleItemsCh = supabase
      .channel('rt-sale-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, (payload) => {
        setState((s) => applySaleItemChange(s, payload));
      })
      .subscribe();

    const settingsCh = supabase
      .channel('rt-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        setState((s) => applySettingChange(s, payload));
      })
      .subscribe();

    const finCatsCh = supabase
      .channel('rt-finance-categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_categories' }, (payload) => {
        setState((s) => applyFinanceCategoryChange(s, payload));
      })
      .subscribe();

    const finBudgetCh = supabase
      .channel('rt-finance-budget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budget_entries' }, (payload) => {
        setState((s) => applyFinanceBudgetChange(s, payload));
      })
      .subscribe();

    const finTxCh = supabase
      .channel('rt-finance-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, (payload) => {
        setState((s) => applyFinanceTransactionChange(s, payload));
      })
      .subscribe();

    channelsRef.current = [todosCh, eventsCh, expensesCh, saleItemsCh, settingsCh, finCatsCh, finBudgetCh, finTxCh];

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
    addTodo: async (text, options = {}) => {
      const t = text.trim();
      if (!t) return;
      const room = (options.room || '').trim();
      const computeTopSort = (todos) => {
        const openSorts = todos.filter((x) => !x.done).map((x) => x.sortOrder ?? 0);
        return (openSorts.length ? Math.min(...openSorts) : 0) - 1000;
      };
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          todos: [
            { id: uid(), text: t, done: false, comment: '', room, sortOrder: computeTopSort(s.todos) },
            ...s.todos,
          ],
        }));
        return;
      }
      let currentTodos = [];
      setState((s) => {
        currentTodos = s.todos;
        return s;
      });
      const { error } = await supabase
        .from('todos')
        .insert({ text: t, room, sort_order: computeTopSort(currentTodos) });
      if (error) reportWriteError(setState, error);
    },

    moveTodo: async (id, newSortOrder) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          todos: s.todos.map((t) => (t.id === id ? { ...t, sortOrder: newSortOrder } : t)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        todos: s.todos.map((t) => (t.id === id ? { ...t, sortOrder: newSortOrder } : t)),
      }));
      const { error } = await supabase
        .from('todos')
        .update({ sort_order: newSortOrder })
        .eq('id', id);
      if (error) reportWriteError(setState, error);
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
      if ('room' in patch) row.room = patch.room;
      if ('plannedDate' in patch) row.planned_date = patch.plannedDate;
      const { error } = await supabase.from('todos').update(row).eq('id', id);
      if (error) reportWriteError(setState, error);
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
      if (error) reportWriteError(setState, error);
    },
    removeTodo: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) reportWriteError(setState, error);
    },
    clearCompletedTodos: async () => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, todos: s.todos.filter((t) => !t.done) }));
        return;
      }
      setState((s) => ({ ...s, todos: s.todos.filter((t) => !t.done) }));
      const { error } = await supabase.from('todos').delete().eq('done', true);
      if (error) reportWriteError(setState, error);
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
      if (error) reportWriteError(setState, error);
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
      if (error) reportWriteError(setState, error);
    },
    removeEvent: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    addExpense: async (expense) => {
      const row = {
        description: expense.description || '',
        category: expense.category || 'overig',
        amount: Number(expense.amount) || 0,
        planned: !!expense.planned,
        date: expense.date || today(),
        notes: expense.notes || '',
      };
      if (isLocal()) {
        localMutate((s) => ({ ...s, expenses: [{ id: uid(), ...row }, ...s.expenses] }));
        return;
      }
      const { error } = await supabase.from('expenses').insert(row);
      if (error) reportWriteError(setState, error);
    },
    updateExpense: async (id, patch) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
      const row = {};
      if ('description' in patch) row.description = patch.description;
      if ('category' in patch) row.category = patch.category;
      if ('amount' in patch) row.amount = Number(patch.amount) || 0;
      if ('planned' in patch) row.planned = !!patch.planned;
      if ('date' in patch) row.date = patch.date;
      if ('notes' in patch) row.notes = patch.notes;
      const { error } = await supabase.from('expenses').update(row).eq('id', id);
      if (error) reportWriteError(setState, error);
    },
    removeExpense: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    addSaleItem: async (item) => {
      const row = {
        title: item.title || '',
        platform: item.platform || 'marktplaats',
        url: item.url || '',
        asking_price: Number(item.askingPrice) || 0,
        sold: !!item.sold,
        sold_price: item.soldPrice == null || item.soldPrice === '' ? null : Number(item.soldPrice),
        notes: item.notes || '',
      };
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          saleItems: [
            {
              id: uid(),
              title: row.title,
              platform: row.platform,
              url: row.url,
              askingPrice: row.asking_price,
              sold: row.sold,
              soldPrice: row.sold_price,
              notes: row.notes,
            },
            ...s.saleItems,
          ],
        }));
        return;
      }
      const { error } = await supabase.from('sale_items').insert(row);
      if (error) reportWriteError(setState, error);
    },
    updateSaleItem: async (id, patch) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          saleItems: s.saleItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        saleItems: s.saleItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      }));
      const row = {};
      if ('title' in patch) row.title = patch.title;
      if ('platform' in patch) row.platform = patch.platform;
      if ('url' in patch) row.url = patch.url;
      if ('askingPrice' in patch) row.asking_price = Number(patch.askingPrice) || 0;
      if ('sold' in patch) row.sold = !!patch.sold;
      if ('soldPrice' in patch) {
        row.sold_price = patch.soldPrice == null || patch.soldPrice === '' ? null : Number(patch.soldPrice);
      }
      if ('notes' in patch) row.notes = patch.notes;
      const { error } = await supabase.from('sale_items').update(row).eq('id', id);
      if (error) reportWriteError(setState, error);
    },
    removeSaleItem: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, saleItems: s.saleItems.filter((it) => it.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, saleItems: s.saleItems.filter((it) => it.id !== id) }));
      const { error } = await supabase.from('sale_items').delete().eq('id', id);
      if (error) reportWriteError(setState, error);
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
      if (error) reportWriteError(setState, error);
    },

    setFinanceStartBalance: async (raw) => {
      const value = Number(raw) || 0;
      if (isLocal()) {
        localMutate((s) => ({ ...s, financeStartBalance: value }));
        return;
      }
      setState((s) => ({ ...s, financeStartBalance: value }));
      const { error } = await supabase
        .from('settings')
        .upsert({ key: FINANCE_START_BALANCE_KEY, value }, { onConflict: 'key' });
      if (error) reportWriteError(setState, error);
    },

    addFinanceCategory: async (name, type) => {
      const trimmed = (name || '').trim();
      if (!trimmed || (type !== 'income' && type !== 'expense')) return;
      if (isLocal()) {
        localMutate((s) => {
          const palette = type === 'income' ? INCOME_COLORS : EXPENSE_COLORS;
          const idx = s.categories.filter((c) => c.type === type).length;
          const cat = {
            id: uid(),
            name: trimmed,
            type,
            color: palette[idx % palette.length],
            sortOrder: s.categories.length,
          };
          return { ...s, categories: [...s.categories, cat] };
        });
        return;
      }
      let sortOrder = 0;
      let paletteIdx = 0;
      setState((s) => {
        sortOrder = s.categories.length;
        paletteIdx = s.categories.filter((c) => c.type === type).length;
        return s;
      });
      const palette = type === 'income' ? INCOME_COLORS : EXPENSE_COLORS;
      const { error } = await supabase.from('finance_categories').insert({
        name: trimmed,
        type,
        color: palette[paletteIdx % palette.length],
        sort_order: sortOrder,
      });
      if (error) reportWriteError(setState, error);
    },

    setFinanceCategoryWeeklyTarget: async (id, amount) => {
      const isEmpty = amount === undefined || amount === null || amount === '' || Number.isNaN(Number(amount));
      const value = isEmpty ? null : Number(amount);
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          categories: s.categories.map((c) => (c.id === id ? { ...c, weeklyTarget: value } : c)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, weeklyTarget: value } : c)),
      }));
      const { error } = await supabase
        .from('finance_categories')
        .update({ weekly_target: value })
        .eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    renameFinanceCategory: async (id, name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return;
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          categories: s.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      }));
      const { error } = await supabase.from('finance_categories').update({ name: trimmed }).eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    removeFinanceCategory: async (id) => {
      if (isLocal()) {
        localMutate((s) => {
          const nextBudget = { ...s.budget };
          delete nextBudget[id];
          return {
            ...s,
            categories: s.categories.filter((c) => c.id !== id),
            budget: nextBudget,
            transactions: s.transactions.filter((t) => t.categoryId !== id),
          };
        });
        return;
      }
      setState((s) => {
        const nextBudget = { ...s.budget };
        delete nextBudget[id];
        return {
          ...s,
          categories: s.categories.filter((c) => c.id !== id),
          budget: nextBudget,
          transactions: s.transactions.filter((t) => t.categoryId !== id),
        };
      });
      const { error } = await supabase.from('finance_categories').delete().eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    setBudgetEntry: async (categoryId, month, amount) => {
      if (!categoryId || !month) return;
      const isEmpty = amount === undefined || amount === null || amount === '' || Number.isNaN(Number(amount));
      const value = isEmpty ? null : Number(amount);
      if (isLocal()) {
        localMutate((s) => {
          const nextBudget = { ...s.budget };
          const perCat = { ...(nextBudget[categoryId] || {}) };
          if (value === null || value === 0) delete perCat[month];
          else perCat[month] = value;
          if (Object.keys(perCat).length === 0) delete nextBudget[categoryId];
          else nextBudget[categoryId] = perCat;
          return { ...s, budget: nextBudget };
        });
        return;
      }
      setState((s) => {
        const nextBudget = { ...s.budget };
        const perCat = { ...(nextBudget[categoryId] || {}) };
        if (value === null) delete perCat[month];
        else perCat[month] = value;
        if (Object.keys(perCat).length === 0) delete nextBudget[categoryId];
        else nextBudget[categoryId] = perCat;
        return { ...s, budget: nextBudget };
      });
      if (value === null) {
        const { error } = await supabase
          .from('finance_budget_entries')
          .delete()
          .eq('category_id', categoryId)
          .eq('month', month);
        if (error) reportWriteError(setState, error);
      } else {
        const { error } = await supabase
          .from('finance_budget_entries')
          .upsert({ category_id: categoryId, month, amount: value }, { onConflict: 'category_id,month' });
        if (error) reportWriteError(setState, error);
      }
    },

    addFinanceTransaction: async (tx) => {
      const row = {
        date: tx.date || today(),
        category_id: tx.categoryId,
        description: (tx.description || '').trim(),
        amount: Number(tx.amount) || 0,
      };
      if (!row.category_id) return;
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          transactions: [
            { id: uid(), date: row.date, categoryId: row.category_id, description: row.description, amount: row.amount },
            ...s.transactions,
          ],
        }));
        return;
      }
      const { error } = await supabase.from('finance_transactions').insert(row);
      if (error) reportWriteError(setState, error);
    },

    updateFinanceTransaction: async (id, patch) => {
      if (isLocal()) {
        localMutate((s) => ({
          ...s,
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      const row = {};
      if ('date' in patch) row.date = patch.date;
      if ('categoryId' in patch) row.category_id = patch.categoryId;
      if ('description' in patch) row.description = patch.description;
      if ('amount' in patch) row.amount = Number(patch.amount) || 0;
      const { error } = await supabase.from('finance_transactions').update(row).eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    removeFinanceTransaction: async (id) => {
      if (isLocal()) {
        localMutate((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
        return;
      }
      setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
      const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
      if (error) reportWriteError(setState, error);
    },

    seedFinanceDefaults: async () => {
      // Idempotent bulk-insert of the seed budget. Only runs when the user asks
      // (via the empty-state button) - it won't fire itself on every load.
      const seedRows = (rows, type) =>
        rows.map((row, idx) => {
          const palette = type === 'income' ? INCOME_COLORS : EXPENSE_COLORS;
          return {
            id: uid(),
            name: row.name,
            type,
            color: palette[idx % palette.length],
            sortOrder: idx + (type === 'income' ? 0 : 1000),
            amounts: row.amounts,
          };
        });
      const specs = [...seedRows(BUDGET_INCOME, 'income'), ...seedRows(BUDGET_EXPENSES, 'expense')];

      if (isLocal()) {
        localMutate((s) => {
          const categories = [...s.categories];
          const budget = { ...s.budget };
          for (const spec of specs) {
            categories.push({
              id: spec.id,
              name: spec.name,
              type: spec.type,
              color: spec.color,
              sortOrder: spec.sortOrder,
            });
            budget[spec.id] = { ...spec.amounts };
          }
          return { ...s, categories, budget };
        });
        return;
      }

      const catInsert = specs.map((spec) => ({
        id: spec.id,
        name: spec.name,
        type: spec.type,
        color: spec.color,
        sort_order: spec.sortOrder,
      }));
      const { error: catErr } = await supabase.from('finance_categories').insert(catInsert);
      if (catErr) {
        reportWriteError(setState, catErr);
        return;
      }
      const budgetRows = [];
      for (const spec of specs) {
        for (const [month, amount] of Object.entries(spec.amounts)) {
          if (amount == null || amount === 0) continue;
          budgetRows.push({ category_id: spec.id, month, amount: Number(amount) || 0 });
        }
      }
      if (budgetRows.length) {
        const { error: bErr } = await supabase.from('finance_budget_entries').insert(budgetRows);
        if (bErr) reportWriteError(setState, bErr);
      }
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

function applyExpenseChange(state, payload) {
  const type = payload.eventType;
  if (type === 'INSERT') {
    const e = expenseFromRow(payload.new);
    if (state.expenses.some((x) => x.id === e.id)) return state;
    return { ...state, expenses: [e, ...state.expenses] };
  }
  if (type === 'UPDATE') {
    const e = expenseFromRow(payload.new);
    return { ...state, expenses: state.expenses.map((x) => (x.id === e.id ? e : x)) };
  }
  if (type === 'DELETE') {
    return { ...state, expenses: state.expenses.filter((x) => x.id !== payload.old.id) };
  }
  return state;
}

function applySaleItemChange(state, payload) {
  const type = payload.eventType;
  if (type === 'INSERT') {
    const it = saleItemFromRow(payload.new);
    if (state.saleItems.some((x) => x.id === it.id)) return state;
    return { ...state, saleItems: [it, ...state.saleItems] };
  }
  if (type === 'UPDATE') {
    const it = saleItemFromRow(payload.new);
    return { ...state, saleItems: state.saleItems.map((x) => (x.id === it.id ? it : x)) };
  }
  if (type === 'DELETE') {
    return { ...state, saleItems: state.saleItems.filter((x) => x.id !== payload.old.id) };
  }
  return state;
}

function applySettingChange(state, payload) {
  const row = payload.new || payload.old;
  if (!row || !SETTINGS_KEYS.includes(row.key)) return state;
  if (payload.eventType === 'DELETE') {
    const fallback = row.key === 'keyDate' ? KEY_HANDOVER_DATE : row.key === FINANCE_START_BALANCE_KEY ? 0 : null;
    return { ...state, [row.key]: fallback };
  }
  const v = payload.new.value;
  const value = typeof v === 'string' ? v : typeof v === 'number' ? v : v?.raw ?? null;
  const coerced = row.key === FINANCE_START_BALANCE_KEY ? Number(value) || 0 : value;
  return { ...state, [row.key]: coerced };
}

function applyFinanceCategoryChange(state, payload) {
  const type = payload.eventType;
  if (type === 'INSERT') {
    const c = financeCategoryFromRow(payload.new);
    if (state.categories.some((x) => x.id === c.id)) return state;
    return { ...state, categories: [...state.categories, c] };
  }
  if (type === 'UPDATE') {
    const c = financeCategoryFromRow(payload.new);
    return { ...state, categories: state.categories.map((x) => (x.id === c.id ? c : x)) };
  }
  if (type === 'DELETE') {
    const id = payload.old.id;
    const nextBudget = { ...state.budget };
    delete nextBudget[id];
    return {
      ...state,
      categories: state.categories.filter((x) => x.id !== id),
      budget: nextBudget,
      transactions: state.transactions.filter((t) => t.categoryId !== id),
    };
  }
  return state;
}

function applyFinanceBudgetChange(state, payload) {
  const type = payload.eventType;
  const row = payload.new || payload.old;
  if (!row) return state;
  const catId = row.category_id;
  const nextBudget = { ...state.budget };
  const perCat = { ...(nextBudget[catId] || {}) };
  if (type === 'DELETE') {
    delete perCat[row.month];
  } else {
    perCat[row.month] = Number(row.amount) || 0;
  }
  if (Object.keys(perCat).length === 0) delete nextBudget[catId];
  else nextBudget[catId] = perCat;
  return { ...state, budget: nextBudget };
}

function applyFinanceTransactionChange(state, payload) {
  const type = payload.eventType;
  if (type === 'INSERT') {
    const t = financeTransactionFromRow(payload.new);
    if (state.transactions.some((x) => x.id === t.id)) return state;
    return { ...state, transactions: [t, ...state.transactions] };
  }
  if (type === 'UPDATE') {
    const t = financeTransactionFromRow(payload.new);
    return { ...state, transactions: state.transactions.map((x) => (x.id === t.id ? t : x)) };
  }
  if (type === 'DELETE') {
    return { ...state, transactions: state.transactions.filter((x) => x.id !== payload.old.id) };
  }
  return state;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore moet binnen <StoreProvider> gebruikt worden');
  return ctx;
}
