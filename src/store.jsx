import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { uid } from './utils/uid.js';

const STORAGE_KEY = 'huis-dashboard.v1';

const DEFAULT_USERS = [
  { id: 'user_a', name: 'Partner 1', color: '#6366f1' },
  { id: 'user_b', name: 'Partner 2', color: '#ec4899' },
];

const DEFAULT_CATEGORIES = [
  // Inkomsten
  { id: 'cat_salaris', name: 'Salaris', type: 'income', color: '#10b981', icon: '💰' },
  { id: 'cat_toeslagen', name: 'Toeslagen', type: 'income', color: '#22c55e', icon: '🏛️' },
  { id: 'cat_overboeking_in', name: 'Overboeking (in)', type: 'income', color: '#a3a3a3', icon: '↘️' },
  { id: 'cat_overig_in', name: 'Overig inkomen', type: 'income', color: '#84cc16', icon: '📈' },
  // Vaste lasten
  { id: 'cat_woning', name: 'Woning', type: 'expense', color: '#ef4444', icon: '🏠' },
  { id: 'cat_nuts', name: 'Nutsvoorzieningen', type: 'expense', color: '#f97316', icon: '💡' },
  { id: 'cat_verzekering', name: 'Verzekeringen', type: 'expense', color: '#f59e0b', icon: '🛡️' },
  { id: 'cat_belasting', name: 'Belastingen', type: 'expense', color: '#78716c', icon: '📋' },
  { id: 'cat_abonnementen', name: 'Abonnementen', type: 'expense', color: '#eab308', icon: '📱' },
  // Boodschappen & huishouden
  { id: 'cat_boodschappen', name: 'Boodschappen', type: 'expense', color: '#84cc16', icon: '🛒' },
  { id: 'cat_huishouden', name: 'Huishouden', type: 'expense', color: '#a3e635', icon: '🧻' },
  // Transport
  { id: 'cat_auto', name: 'Auto / Transport', type: 'expense', color: '#0ea5e9', icon: '🚗' },
  // Zorg & kinderen
  { id: 'cat_zorg', name: 'Zorg', type: 'expense', color: '#06b6d4', icon: '⚕️' },
  { id: 'cat_kinderen', name: 'Kinderen', type: 'expense', color: '#14b8a6', icon: '🧒' },
  // Vrije tijd
  { id: 'cat_uiteten', name: 'Uit eten', type: 'expense', color: '#8b5cf6', icon: '🍽️' },
  { id: 'cat_vrijetijd', name: 'Vrije tijd', type: 'expense', color: '#a855f7', icon: '🎉' },
  { id: 'cat_kleding', name: 'Kleding', type: 'expense', color: '#d946ef', icon: '👕' },
  { id: 'cat_vakantie', name: 'Vakantie', type: 'expense', color: '#ec4899', icon: '✈️' },
  // Sparen & overig
  { id: 'cat_sparen', name: 'Sparen', type: 'expense', color: '#3b82f6', icon: '🐖' },
  { id: 'cat_overboeking_uit', name: 'Overboeking (uit)', type: 'expense', color: '#94a3b8', icon: '↗️' },
  { id: 'cat_overig_uit', name: 'Overig', type: 'expense', color: '#64748b', icon: '📌' },
];

const DEFAULT_BUDGETS = {}; // {categoryId: {week?: number, month?: number, year?: number}}

const DEFAULT_STATE = {
  version: 1,
  users: DEFAULT_USERS,
  categories: DEFAULT_CATEGORIES,
  budgets: DEFAULT_BUDGETS,
  transactions: [],
  settings: {
    activeUserId: null, // null = alle gebruikers
    theme: 'auto',
  },
};

function loadState() {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    // Migratie: nieuwe default-categorieën die nog niet in de opgeslagen state staan aanvullen.
    const existingIds = new Set((parsed.categories || []).map((c) => c.id));
    const missingCats = DEFAULT_CATEGORIES.filter((c) => !existingIds.has(c.id));
    const categories = parsed.categories ? [...parsed.categories, ...missingCats] : DEFAULT_CATEGORIES;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      categories,
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
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

  const actions = useMemo(() => ({
    // Users
    addUser: (name, color = '#6366f1') =>
      setState((s) => ({ ...s, users: [...s.users, { id: uid('user'), name, color }] })),
    updateUser: (id, patch) =>
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      })),
    removeUser: (id) =>
      setState((s) => ({
        ...s,
        users: s.users.filter((u) => u.id !== id),
        transactions: s.transactions.map((t) =>
          t.userId === id ? { ...t, userId: null } : t
        ),
        settings: {
          ...s.settings,
          activeUserId: s.settings.activeUserId === id ? null : s.settings.activeUserId,
        },
      })),

    // Categories
    addCategory: (data) =>
      setState((s) => ({
        ...s,
        categories: [...s.categories, { id: uid('cat'), color: '#64748b', icon: '📌', ...data }],
      })),
    updateCategory: (id, patch) =>
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    removeCategory: (id) =>
      setState((s) => ({
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        transactions: s.transactions.map((t) =>
          t.categoryId === id ? { ...t, categoryId: null } : t
        ),
        budgets: Object.fromEntries(
          Object.entries(s.budgets).filter(([cid]) => cid !== id)
        ),
      })),

    // Budgets
    setBudget: (categoryId, period, amount) =>
      setState((s) => {
        const current = s.budgets[categoryId] || {};
        const next = { ...current };
        if (amount === '' || amount === null || amount === undefined || Number.isNaN(amount)) {
          delete next[period];
        } else {
          next[period] = Number(amount);
        }
        const budgets = { ...s.budgets };
        if (Object.keys(next).length === 0) {
          delete budgets[categoryId];
        } else {
          budgets[categoryId] = next;
        }
        return { ...s, budgets };
      }),

    // Transactions
    addTransaction: (tx) =>
      setState((s) => ({
        ...s,
        transactions: [
          { id: uid('tx'), ...tx },
          ...s.transactions,
        ],
      })),
    addTransactions: (txs) =>
      setState((s) => ({
        ...s,
        transactions: [
          ...txs.map((t) => ({ id: uid('tx'), ...t })),
          ...s.transactions,
        ],
      })),
    updateTransaction: (id, patch) =>
      setState((s) => ({
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    removeTransaction: (id) =>
      setState((s) => ({
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
      })),
    removeTransactions: (ids) =>
      setState((s) => {
        const idSet = new Set(ids);
        return { ...s, transactions: s.transactions.filter((t) => !idSet.has(t.id)) };
      }),

    // Settings
    setActiveUser: (id) =>
      setState((s) => ({ ...s, settings: { ...s.settings, activeUserId: id } })),
    setTheme: (theme) =>
      setState((s) => ({ ...s, settings: { ...s.settings, theme } })),

    // Backup
    exportJson: () => JSON.stringify(state, null, 2),
    importJson: (json) => {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      setState({ ...DEFAULT_STATE, ...parsed, settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) } });
    },
    resetAll: () => setState(DEFAULT_STATE),
    clearTransactions: () => setState((s) => ({ ...s, transactions: [] })),
  }), [state]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore moet binnen <StoreProvider> gebruikt worden');
  return ctx;
}

// Handige selector-hooks
export function useCategoryMap() {
  const { state } = useStore();
  return useMemo(() => {
    const map = {};
    state.categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [state.categories]);
}

export function useUserMap() {
  const { state } = useStore();
  return useMemo(() => {
    const map = {};
    state.users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [state.users]);
}
