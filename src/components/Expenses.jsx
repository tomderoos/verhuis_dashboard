import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';

export const CATEGORIES = [
  { id: 'verf', label: 'Verf', icon: '🎨', color: '#ec4899' },
  { id: 'materialen', label: 'Materialen', icon: '🧱', color: '#f97316' },
  { id: 'gereedschap', label: 'Gereedschap', icon: '🧰', color: '#f59e0b' },
  { id: 'klusser', label: 'Klusser', icon: '👷', color: '#0ea5e9' },
  { id: 'tuin', label: 'Tuin', icon: '🌱', color: '#10b981' },
  { id: 'verhuis', label: 'Verhuis', icon: '📦', color: '#8b5cf6' },
  { id: 'overig', label: 'Overig', icon: '📌', color: '#64748b' },
];

function catMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const NL_DATE_SHORT = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Expenses() {
  const { state, actions } = useStore();
  const [form, setForm] = useState({
    description: '',
    category: 'verf',
    amount: '',
    planned: false,
    date: todayIso(),
  });
  const [filter, setFilter] = useState('all');

  const totals = useMemo(() => {
    let done = 0;
    let planned = 0;
    const perCategory = {};
    for (const e of state.expenses) {
      const bucket = perCategory[e.category] || { done: 0, planned: 0, count: 0 };
      if (e.planned) planned += e.amount;
      else done += e.amount;
      bucket[e.planned ? 'planned' : 'done'] += e.amount;
      bucket.count += 1;
      perCategory[e.category] = bucket;
    }
    return { done, planned, total: done + planned, perCategory };
  }, [state.expenses]);

  const visible = useMemo(() => {
    let list = [...state.expenses];
    if (filter === 'planned') list = list.filter((e) => e.planned);
    else if (filter === 'done') list = list.filter((e) => !e.planned);
    else if (filter !== 'all') list = list.filter((e) => e.category === filter);
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return list;
  }, [state.expenses, filter]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    actions.addExpense({
      ...form,
      amount: Number(form.amount),
      description: form.description.trim(),
    });
    setForm({ ...form, description: '', amount: '' });
  };

  return (
    <div className="stack">
      <div className="expense-summary">
        <SummaryCard label="Uitgegeven" amount={totals.done} tone="done" />
        <SummaryCard label="Nog verwacht" amount={totals.planned} tone="planned" />
        <SummaryCard label="Totaal" amount={totals.total} tone="total" />
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Uitgave toevoegen</h2>
            <div className="card-sub">
              Categoriseer om per soort je totaal te zien
            </div>
          </div>
          <div className="planned-toggle">
            <label className={`chip ${!form.planned ? 'active' : ''}`}>
              <input
                type="radio"
                checked={!form.planned}
                onChange={() => setForm({ ...form, planned: false })}
                style={{ display: 'none' }}
              />
              Uitgegeven
            </label>
            <label className={`chip ${form.planned ? 'active' : ''}`}>
              <input
                type="radio"
                checked={form.planned}
                onChange={() => setForm({ ...form, planned: true })}
                style={{ display: 'none' }}
              />
              Verwacht
            </label>
          </div>
        </div>

        <form className="expense-form" onSubmit={submit}>
          <input
            className="input"
            placeholder="Waar is 't voor?"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <div className="input-amount">
            <span className="euro-prefix">€</span>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <button className="btn primary" type="submit">
            Toevoegen
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Overzicht</h2>
            <div className="card-sub">{state.expenses.length} regels</div>
          </div>
          <div className="chip-row">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Alles</button>
            <button className={`chip ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>Uitgegeven</button>
            <button className={`chip ${filter === 'planned' ? 'active' : ''}`} onClick={() => setFilter('planned')}>Verwacht</button>
            {CATEGORIES.filter((c) => totals.perCategory[c.id]).map((c) => (
              <button
                key={c.id}
                className={`chip ${filter === c.id ? 'active' : ''}`}
                onClick={() => setFilter(c.id)}
              >
                <span aria-hidden>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        <CategoryBreakdown perCategory={totals.perCategory} />

        <div className="expense-list">
          {visible.length === 0 && <div className="empty">Nog geen regels in deze filter.</div>}
          {visible.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, amount, tone }) {
  return (
    <div className={`card summary-card summary-${tone}`}>
      <div className="eyebrow">{label}</div>
      <div className="summary-amount">{EUR.format(amount || 0)}</div>
    </div>
  );
}

function CategoryBreakdown({ perCategory }) {
  const rows = CATEGORIES.filter((c) => perCategory[c.id]).map((c) => {
    const b = perCategory[c.id];
    return { ...c, ...b, total: b.done + b.planned };
  });
  if (rows.length === 0) return null;
  const maxTotal = Math.max(...rows.map((r) => r.total));
  return (
    <div className="cat-breakdown">
      {rows.map((r) => (
        <div key={r.id} className="cat-row">
          <div className="cat-label">
            <span aria-hidden>{r.icon}</span> {r.label}
          </div>
          <div className="cat-bar-wrap" title={`Uitgegeven ${EUR.format(r.done)} · Verwacht ${EUR.format(r.planned)}`}>
            <div
              className="cat-bar-done"
              style={{ width: `${(r.done / maxTotal) * 100}%`, background: r.color }}
            />
            <div
              className="cat-bar-planned"
              style={{ width: `${(r.planned / maxTotal) * 100}%`, background: r.color }}
            />
          </div>
          <div className="cat-total">{EUR.format(r.total)}</div>
        </div>
      ))}
    </div>
  );
}

function ExpenseRow({ expense }) {
  const { actions } = useStore();
  const meta = catMeta(expense.category);

  return (
    <div className={`expense-row ${expense.planned ? 'is-planned' : ''}`}>
      <div className="expense-cat" style={{ background: meta.color }} aria-hidden>
        {meta.icon}
      </div>
      <div className="expense-body">
        <input
          className="expense-desc"
          value={expense.description}
          onChange={(e) => actions.updateExpense(expense.id, { description: e.target.value })}
        />
        <div className="expense-meta">
          <select
            className="input tiny"
            value={expense.category}
            onChange={(e) => actions.updateExpense(expense.id, { category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input tiny"
            value={expense.date}
            onChange={(e) => actions.updateExpense(expense.id, { date: e.target.value })}
          />
          <button
            className={`chip small ${expense.planned ? '' : 'active'}`}
            onClick={() => actions.updateExpense(expense.id, { planned: !expense.planned })}
            title="Wissel tussen Uitgegeven en Verwacht"
          >
            {expense.planned ? 'Verwacht' : 'Uitgegeven'}
          </button>
        </div>
      </div>
      <div className="expense-amount-wrap">
        <div className="expense-amount">{EUR.format(expense.amount)}</div>
        <div className="expense-date">{NL_DATE_SHORT.format(new Date(expense.date + 'T00:00'))}</div>
      </div>
      <button
        className="btn tiny ghost"
        onClick={() => actions.removeExpense(expense.id)}
        title="Verwijderen"
      >
        ✕
      </button>
    </div>
  );
}
