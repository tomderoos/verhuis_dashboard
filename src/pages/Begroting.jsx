import React, { useMemo, useState } from 'react';
import { useStore, useCategoryMap } from '../store.jsx';
import { formatCurrency, parseAmount } from '../utils/format.js';
import { PERIOD_LABELS, PERIODS, convertBudget, formatPeriodLabel, isInPeriod } from '../utils/period.js';
import PeriodNav from '../components/PeriodNav.jsx';

function BudgetInput({ value, onSave }) {
  const [text, setText] = useState(value != null ? String(value).replace('.', ',') : '');

  const commit = () => {
    if (text.trim() === '') {
      onSave(null);
      return;
    }
    const parsed = parseAmount(text);
    onSave(parsed);
    setText(String(parsed).replace('.', ','));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className="input mono right"
      style={{ width: 110 }}
      placeholder="—"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

export default function Begroting() {
  const { state, actions } = useStore();
  const [period, setPeriod] = useState('month');
  const [reference, setReference] = useState(() => new Date());

  const expenseCats = state.categories.filter((c) => c.type === 'expense');
  const incomeCats = state.categories.filter((c) => c.type === 'income');

  const spentByCategory = useMemo(() => {
    const map = {};
    state.transactions.forEach((t) => {
      if (!isInPeriod(t.date, period, reference)) return;
      if (!t.categoryId) return;
      map[t.categoryId] = (map[t.categoryId] || 0) + (Number(t.amount) || 0);
    });
    return map;
  }, [state.transactions, period, reference]);

  // Berekent effectief budget voor deze periode, uitgaande van 'anchor' periode waarin gebruiker het bedrag heeft ingevuld.
  const effectiveBudget = (categoryId) => {
    const b = state.budgets[categoryId];
    if (!b) return { amount: null, anchor: null };
    // Voorkeur: exacte periode > week > maand > jaar
    const order = [period, ...PERIODS.filter((p) => p !== period)];
    for (const p of order) {
      if (b[p] != null) {
        return { amount: convertBudget(b[p], p, period), anchor: p };
      }
    }
    return { amount: null, anchor: null };
  };

  const totalExpenseBudget = expenseCats.reduce((sum, c) => sum + (effectiveBudget(c.id).amount || 0), 0);
  const totalIncomeBudget = incomeCats.reduce((sum, c) => sum + (effectiveBudget(c.id).amount || 0), 0);
  const totalSpent = expenseCats.reduce((sum, c) => sum + (spentByCategory[c.id] || 0), 0);
  const totalIncomeActual = useMemo(() => {
    let sum = 0;
    state.transactions.forEach((t) => {
      if (!isInPeriod(t.date, period, reference)) return;
      if (t.type !== 'income') return;
      sum += Number(t.amount) || 0;
    });
    return sum;
  }, [state.transactions, period, reference]);

  const renderRow = (cat) => {
    const { amount: budgetAmount, anchor } = effectiveBudget(cat.id);
    const raw = state.budgets[cat.id]?.[period] ?? '';
    const spent = spentByCategory[cat.id] || 0;
    const pct = budgetAmount && budgetAmount > 0 ? (spent / budgetAmount) * 100 : null;
    const anchorHint = anchor && anchor !== period
      ? `(afgeleid uit ${PERIOD_LABELS[anchor].toLowerCase()})`
      : null;
    return (
      <tr key={cat.id}>
        <td>
          <span className="row gap-8">
            <span style={{ fontSize: 18 }}>{cat.icon}</span>
            <span>{cat.name}</span>
          </span>
        </td>
        <td className="right">
          <BudgetInput
            value={raw === '' ? null : raw}
            onSave={(v) => actions.setBudget(cat.id, period, v)}
          />
          {anchorHint && <div className="text-subtle" style={{ fontSize: 11, marginTop: 4 }}>{anchorHint}</div>}
        </td>
        <td className="right mono">{formatCurrency(spent)}</td>
        <td style={{ minWidth: 180 }}>
          {budgetAmount ? (
            <>
              <div className="progress">
                <div
                  className={`bar ${pct > 100 ? 'danger' : pct > 80 ? 'warning' : 'success'}`}
                  style={{ width: `${Math.min(100, pct || 0)}%` }}
                />
              </div>
              <div className="between mt-8" style={{ fontSize: 12 }}>
                <span className="text-muted">{Math.round(pct)}%</span>
                <span className={`mono ${budgetAmount - spent < 0 ? 'text-muted' : 'text-muted'}`} style={{ color: budgetAmount - spent < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {budgetAmount - spent >= 0 ? 'Nog: ' : 'Over: '}
                  {formatCurrency(Math.abs(budgetAmount - spent))}
                </span>
              </div>
            </>
          ) : (
            <span className="text-subtle" style={{ fontSize: 12 }}>Geen budget</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Begroting</h1>
          <p className="page-subtitle">Zet een bedrag per {PERIOD_LABELS[period].toLowerCase()} — de app rekent automatisch om.</p>
        </div>
        <PeriodNav period={period} setPeriod={setPeriod} reference={reference} setReference={setReference} />
      </div>

      <div className="grid cols-3 mb-16">
        <div className="card stat">
          <span className="stat-label">Verwacht inkomen</span>
          <span className="stat-value positive mono">{formatCurrency(totalIncomeBudget)}</span>
          <span className="stat-hint">Werkelijk: {formatCurrency(totalIncomeActual)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Totaal uitgavenbudget</span>
          <span className="stat-value negative mono">{formatCurrency(totalExpenseBudget)}</span>
          <span className="stat-hint">Werkelijk: {formatCurrency(totalSpent)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Verwacht overschot</span>
          <span className={`stat-value mono ${totalIncomeBudget - totalExpenseBudget >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(totalIncomeBudget - totalExpenseBudget)}
          </span>
          <span className="stat-hint">Inkomsten − uitgaven (begroot)</span>
        </div>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Uitgaven</h3>
            <p className="card-subtitle">Budget per {PERIOD_LABELS[period].toLowerCase()} · {formatPeriodLabel(period, reference)}</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Categorie</th>
                <th className="right">Budget</th>
                <th className="right">Uitgegeven</th>
                <th>Voortgang</th>
              </tr>
            </thead>
            <tbody>{expenseCats.map(renderRow)}</tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Inkomsten</h3>
            <p className="card-subtitle">Verwachte inkomsten per {PERIOD_LABELS[period].toLowerCase()}</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Categorie</th>
                <th className="right">Verwacht</th>
                <th className="right">Ontvangen</th>
                <th>Voortgang</th>
              </tr>
            </thead>
            <tbody>{incomeCats.map(renderRow)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
