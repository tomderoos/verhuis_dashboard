import React, { useMemo, useState } from 'react';
import { useStore, useCategoryMap } from '../store.jsx';
import { formatCurrency } from '../utils/format.js';
import UserFilter from '../components/UserFilter.jsx';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';

const RANGES = [
  { id: '3m', label: 'Laatste 3 maanden', months: 3 },
  { id: '6m', label: 'Laatste 6 maanden', months: 6 },
  { id: '12m', label: 'Laatste 12 maanden', months: 12 },
  { id: '24m', label: 'Laatste 24 maanden', months: 24 },
];

export default function Rapportages() {
  const { state } = useStore();
  const categoryMap = useCategoryMap();
  const [range, setRange] = useState('6m');
  const activeUserId = state.settings.activeUserId;

  const months = useMemo(() => {
    const monthsBack = RANGES.find((r) => r.id === range).months;
    const now = new Date();
    const arr = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      arr.push({
        key: format(d, 'yyyy-MM'),
        label: format(d, 'MMM yy'),
        start: startOfMonth(d),
        end: endOfMonth(d),
      });
    }
    return arr;
  }, [range]);

  const filteredTx = useMemo(() => {
    return state.transactions.filter((t) => {
      if (activeUserId && t.userId !== activeUserId) return false;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return false;
      const first = months[0].start;
      const last = months[months.length - 1].end;
      return isWithinInterval(d, { start: first, end: last });
    });
  }, [state.transactions, activeUserId, months]);

  const monthly = useMemo(() => {
    const map = new Map();
    months.forEach((m) => map.set(m.key, { key: m.key, label: m.label, income: 0, expense: 0 }));
    filteredTx.forEach((t) => {
      const d = new Date(t.date);
      const key = format(d, 'yyyy-MM');
      const bucket = map.get(key);
      if (!bucket) return;
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') bucket.income += amt;
      else bucket.expense += amt;
    });
    return Array.from(map.values()).map((m) => ({ ...m, net: m.income - m.expense }));
  }, [filteredTx, months]);

  // Recharts plaatst gegroepeerde staven verkeerd als er lege maanden tussen zitten,
  // dus alleen maanden met daadwerkelijke activiteit doorgeven aan de grafiek.
  const monthlyForChart = useMemo(
    () => monthly.filter((m) => m.income > 0 || m.expense > 0),
    [monthly],
  );


  const categoryTotals = useMemo(() => {
    const map = new Map();
    filteredTx.forEach((t) => {
      if (t.type !== 'expense') return;
      const catId = t.categoryId || 'onbekend';
      const cat = categoryMap[catId];
      const name = cat ? cat.name : 'Onbekend';
      const color = cat ? cat.color : '#94a3b8';
      const current = map.get(catId) || { id: catId, name, color, value: 0 };
      current.value += Number(t.amount) || 0;
      map.set(catId, current);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filteredTx, categoryMap]);

  const totalExpense = categoryTotals.reduce((s, c) => s + c.value, 0);

  const stackedByCategory = useMemo(() => {
    const topCatIds = categoryTotals.slice(0, 6).map((c) => c.id);
    const rows = months.map((m) => {
      const row = { label: m.label };
      topCatIds.forEach((id) => { row[id] = 0; });
      row.overig = 0;
      return row;
    });
    filteredTx.forEach((t) => {
      if (t.type !== 'expense') return;
      const d = new Date(t.date);
      const key = format(d, 'yyyy-MM');
      const idx = months.findIndex((m) => m.key === key);
      if (idx < 0) return;
      const amt = Number(t.amount) || 0;
      if (topCatIds.includes(t.categoryId)) {
        rows[idx][t.categoryId] += amt;
      } else {
        rows[idx].overig += amt;
      }
    });
    // Lege maanden weglaten om Recharts-uitlijnbug te voorkomen.
    const nonEmptyRows = rows.filter((r) => topCatIds.some((id) => r[id] > 0) || r.overig > 0);
    return { rows: nonEmptyRows, topCatIds };
  }, [filteredTx, categoryTotals, months]);

  const userSplit = useMemo(() => {
    const map = new Map();
    state.users.forEach((u) => map.set(u.id, { name: u.name, color: u.color, expense: 0, income: 0 }));
    map.set('none', { name: 'Geen', color: '#94a3b8', expense: 0, income: 0 });
    filteredTx.forEach((t) => {
      const key = t.userId || 'none';
      if (!map.has(key)) return;
      const b = map.get(key);
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') b.income += amt; else b.expense += amt;
    });
    return Array.from(map.values()).filter((u) => u.expense > 0 || u.income > 0);
  }, [filteredTx, state.users]);

  const avgIncome = monthly.reduce((s, m) => s + m.income, 0) / (monthly.length || 1);
  const avgExpense = monthly.reduce((s, m) => s + m.expense, 0) / (monthly.length || 1);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapportages</h1>
          <p className="page-subtitle">Trends en verdeling over de tijd</p>
        </div>
        <div className="row wrap gap-12">
          <UserFilter />
          <div className="tabs">
            {RANGES.map((r) => (
              <button key={r.id} className={`tab ${range === r.id ? 'active' : ''}`} onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-3 mb-16">
        <div className="card stat">
          <span className="stat-label">Gem. inkomen / maand</span>
          <span className="stat-value positive mono">{formatCurrency(avgIncome)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Gem. uitgaven / maand</span>
          <span className="stat-value negative mono">{formatCurrency(avgExpense)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Gem. saldo / maand</span>
          <span className={`stat-value mono ${avgIncome - avgExpense >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(avgIncome - avgExpense)}
          </span>
        </div>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Inkomsten & uitgaven per maand</h3>
            <p className="card-subtitle">Vergelijk trends over tijd</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyForChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--border-strong)" />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="var(--border-strong)"
              tickFormatter={(v) => `€${Math.round(v)}`}
              domain={[0, (dataMax) => Math.ceil(dataMax * 1.1 / 100) * 100]}
              allowDataOverflow={false}
            />
            <Tooltip content={<CurrencyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Inkomsten" fill="var(--success)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" name="Uitgaven" fill="var(--danger)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Saldo verloop</h3>
            <p className="card-subtitle">Nettoresultaat per maand</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyForChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--border-strong)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--border-strong)" tickFormatter={(v) => `€${Math.round(v)}`} />
            <Tooltip content={<CurrencyTooltip />} />
            <Line type="monotone" dataKey="net" name="Saldo" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid cols-2 mb-16">
        <div className="card">
          <div className="between mb-16">
            <div>
              <h3 className="card-title">Uitgaven per categorie</h3>
              <p className="card-subtitle">Totaal over gekozen periode</p>
            </div>
          </div>
          {categoryTotals.length === 0 ? (
            <div className="empty"><div className="icon">📊</div>Geen uitgaven om te tonen.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryTotals} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2} isAnimationActive={false}>
                    {categoryTotals.map((c) => <Cell key={c.id} fill={c.color} />)}
                  </Pie>
                  <Tooltip content={<CurrencyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-8 mt-12">
                {categoryTotals.slice(0, 8).map((c) => (
                  <div key={c.id} className="between">
                    <span className="row gap-8">
                      <span className="color-swatch" style={{ background: c.color }} />
                      <span>{c.name}</span>
                    </span>
                    <span className="mono text-muted">
                      {formatCurrency(c.value)} · {totalExpense > 0 ? Math.round((c.value / totalExpense) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="between mb-16">
            <div>
              <h3 className="card-title">Top categorieën per maand</h3>
              <p className="card-subtitle">Gestapelde uitgaven</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stackedByCategory.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--border-strong)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--border-strong)" tickFormatter={(v) => `€${Math.round(v)}`} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {stackedByCategory.topCatIds.map((id) => {
                const cat = categoryMap[id];
                return (
                  <Bar key={id} dataKey={id} name={cat ? cat.name : 'Onbekend'} stackId="a" fill={cat ? cat.color : '#94a3b8'} isAnimationActive={false} />
                );
              })}
              <Bar dataKey="overig" name="Overig" stackId="a" fill="#94a3b8" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {state.users.length > 1 && userSplit.length > 0 && (
        <div className="card">
          <div className="between mb-16">
            <div>
              <h3 className="card-title">Verdeling per persoon</h3>
              <p className="card-subtitle">Wie draagt hoeveel bij en geeft hoeveel uit</p>
            </div>
          </div>
          <div className="grid cols-2">
            <div>
              <div className="text-muted mb-8">Uitgaven</div>
              {userSplit.map((u) => {
                const total = userSplit.reduce((s, x) => s + x.expense, 0);
                const pct = total > 0 ? Math.round((u.expense / total) * 100) : 0;
                return (
                  <div key={`e_${u.name}`} className="mb-12">
                    <div className="between mb-8">
                      <span className="row gap-8"><span className="color-swatch" style={{ background: u.color }} /> {u.name}</span>
                      <span className="mono text-muted">{formatCurrency(u.expense)} · {pct}%</span>
                    </div>
                    <div className="progress"><div className="bar" style={{ width: `${pct}%`, background: u.color }} /></div>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="text-muted mb-8">Inkomsten</div>
              {userSplit.map((u) => {
                const total = userSplit.reduce((s, x) => s + x.income, 0);
                const pct = total > 0 ? Math.round((u.income / total) * 100) : 0;
                return (
                  <div key={`i_${u.name}`} className="mb-12">
                    <div className="between mb-8">
                      <span className="row gap-8"><span className="color-swatch" style={{ background: u.color }} /> {u.name}</span>
                      <span className="mono text-muted">{formatCurrency(u.income)} · {pct}%</span>
                    </div>
                    <div className="progress"><div className="bar" style={{ width: `${pct}%`, background: u.color }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="tooltip-box">
      {label && <div className="tooltip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span style={{ color: p.color || p.payload?.color }}>{p.name}</span>
          <span className="value mono">{formatCurrency(Number(p.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}
