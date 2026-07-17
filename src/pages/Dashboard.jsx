import React, { useMemo, useState } from 'react';
import { useStore, useCategoryMap, useUserMap } from '../store.jsx';
import { formatCurrency, formatDate } from '../utils/format.js';
import { getPeriodRange, isInPeriod, formatPeriodLabel, convertBudget } from '../utils/period.js';
import PeriodNav from '../components/PeriodNav.jsx';
import UserFilter from '../components/UserFilter.jsx';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

export default function Dashboard({ onNavigate }) {
  const { state } = useStore();
  const categoryMap = useCategoryMap();
  const userMap = useUserMap();
  const [period, setPeriod] = useState('month');
  const [reference, setReference] = useState(() => new Date());

  const activeUserId = state.settings.activeUserId;

  const filtered = useMemo(() => {
    return state.transactions.filter((t) => {
      if (activeUserId && t.userId !== activeUserId) return false;
      return isInPeriod(t.date, period, reference);
    });
  }, [state.transactions, activeUserId, period, reference]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filtered.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return { income, expense, net: income - expense };
  }, [filtered]);

  const totalBudget = useMemo(() => {
    let sum = 0;
    Object.entries(state.budgets).forEach(([catId, b]) => {
      const cat = categoryMap[catId];
      if (!cat || cat.type !== 'expense') return;
      const source = b.month ? { p: 'month', a: b.month }
        : b.week ? { p: 'week', a: b.week }
        : b.year ? { p: 'year', a: b.year } : null;
      if (!source) return;
      sum += convertBudget(source.a, source.p, period);
    });
    return sum;
  }, [state.budgets, categoryMap, period]);

  const byCategory = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      if (t.type !== 'expense') return;
      const catId = t.categoryId || 'onbekend';
      const cat = categoryMap[catId];
      const key = cat ? cat.id : 'onbekend';
      const name = cat ? cat.name : 'Onbekend';
      const color = cat ? cat.color : '#94a3b8';
      const current = map.get(key) || { name, color, value: 0 };
      current.value += Number(t.amount) || 0;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filtered, categoryMap]);

  const trendData = useMemo(() => {
    const range = getPeriodRange(period, reference);
    // Groepeer per dag (week/maand) of per maand (jaar)
    const buckets = new Map();
    const useMonth = period === 'year';
    state.transactions.forEach((t) => {
      if (activeUserId && t.userId !== activeUserId) return;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      if (d < range.start || d > range.end) return;
      const key = useMonth
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const b = buckets.get(key) || { key, income: 0, expense: 0 };
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') b.income += amt;
      else b.expense += amt;
      buckets.set(key, b);
    });
    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key)).map((b) => ({
      ...b,
      label: useMonth
        ? new Date(`${b.key}-01`).toLocaleDateString('nl-NL', { month: 'short' })
        : new Date(b.key).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' }),
    }));
  }, [state.transactions, activeUserId, period, reference]);

  const recentTransactions = useMemo(() => {
    return [...filtered]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [filtered]);

  const budgetPercent = totalBudget > 0 ? Math.round((stats.expense / totalBudget) * 100) : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overzicht</h1>
          <p className="page-subtitle">{formatPeriodLabel(period, reference)}</p>
        </div>
        <div className="row wrap gap-12">
          <UserFilter />
          <PeriodNav period={period} setPeriod={setPeriod} reference={reference} setReference={setReference} />
        </div>
      </div>

      <div className="grid cols-4 mb-16">
        <div className="card stat">
          <span className="stat-label">Inkomsten</span>
          <span className="stat-value positive mono">{formatCurrency(stats.income)}</span>
          <span className="stat-hint">{filtered.filter((t) => t.type === 'income').length} transacties</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Uitgaven</span>
          <span className="stat-value negative mono">{formatCurrency(stats.expense)}</span>
          <span className="stat-hint">{filtered.filter((t) => t.type === 'expense').length} transacties</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Saldo</span>
          <span className={`stat-value mono ${stats.net >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(stats.net)}
          </span>
          <span className="stat-hint">Inkomsten − Uitgaven</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Budget benut</span>
          <span className="stat-value mono">{budgetPercent === null ? '—' : `${budgetPercent}%`}</span>
          <div className="progress mt-8">
            <div
              className={`bar ${budgetPercent === null ? '' : budgetPercent > 100 ? 'danger' : budgetPercent > 80 ? 'warning' : 'success'}`}
              style={{ width: `${Math.min(100, budgetPercent || 0)}%` }}
            />
          </div>
          <span className="stat-hint">
            {totalBudget > 0
              ? `${formatCurrency(stats.expense)} van ${formatCurrency(totalBudget)}`
              : 'Nog geen budget ingesteld'}
          </span>
        </div>
      </div>

      <div className="grid cols-2 mb-16">
        <div className="card">
          <div className="between mb-16">
            <div>
              <h3 className="card-title">Uitgaven per categorie</h3>
              <p className="card-subtitle">In deze periode</p>
            </div>
          </div>
          {byCategory.length === 0 ? (
            <div className="empty">
              <div className="icon">📊</div>
              Nog geen uitgaven in deze periode.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {byCategory.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CurrencyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-8">
                {byCategory.slice(0, 6).map((c) => {
                  const pct = stats.expense > 0 ? Math.round((c.value / stats.expense) * 100) : 0;
                  return (
                    <div key={c.name} className="between">
                      <span className="row gap-8">
                        <span className="color-swatch" style={{ background: c.color }} />
                        <span>{c.name}</span>
                      </span>
                      <span className="mono text-muted">
                        {formatCurrency(c.value)} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="between mb-16">
            <div>
              <h3 className="card-title">Trend</h3>
              <p className="card-subtitle">Inkomsten en uitgaven over tijd</p>
            </div>
          </div>
          {trendData.length === 0 ? (
            <div className="empty">
              <div className="icon">📈</div>
              Nog geen data om te tonen.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--border-strong)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--border-strong)" tickFormatter={(v) => `€${v}`} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Inkomsten" fill="var(--success)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expense" name="Uitgaven" fill="var(--danger)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Recente transacties</h3>
            <p className="card-subtitle">Laatste 8 in deze periode</p>
          </div>
          <button className="btn small" onClick={() => onNavigate('transacties')}>Alles bekijken →</button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="empty">
            <div className="icon">💳</div>
            Geen transacties. Voeg je eerste transactie toe via het tabblad Transacties.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Omschrijving</th>
                  <th>Categorie</th>
                  <th>Wie</th>
                  <th className="right">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => {
                  const cat = categoryMap[t.categoryId];
                  const usr = userMap[t.userId];
                  return (
                    <tr key={t.id}>
                      <td className="mono">{formatDate(t.date)}</td>
                      <td>{t.description || '—'}</td>
                      <td>
                        {cat ? (
                          <span className="badge" style={{ color: cat.color, background: `${cat.color}18`, borderColor: `${cat.color}33` }}>
                            <span className="dot" />{cat.name}
                          </span>
                        ) : <span className="text-subtle">Geen</span>}
                      </td>
                      <td>{usr ? <span className="badge" style={{ color: usr.color, background: `${usr.color}18`, borderColor: `${usr.color}33` }}><span className="dot" />{usr.name}</span> : <span className="text-subtle">—</span>}</td>
                      <td className={`right mono amount ${t.type}`}>
                        {t.type === 'expense' ? '−' : '+'}{formatCurrency(Number(t.amount) || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="tooltip-box">
      {label && <div className="tooltip-label">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="tooltip-row">
          <span style={{ color: p.color || p.payload?.color }}>{p.name}</span>
          <span className="value mono">{formatCurrency(Number(p.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}
