import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const EUR_PRECISE = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});
const MONTH_LONG = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });
const MONTH_SHORT = new Intl.DateTimeFormat('nl-NL', { month: 'short' });
const DAY_MONTH = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

function pad2(n) {
  return String(n).padStart(2, '0');
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isoMonth(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}
function isoDay(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function parseIsoDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function monthDate(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
function shiftMonth(monthKey, delta) {
  const d = monthDate(monthKey);
  d.setMonth(d.getMonth() + delta);
  return isoMonth(d);
}
function monthsBetween(from, to) {
  const list = [];
  let cur = from;
  let i = 0;
  while (cur <= to && i++ < 240) {
    list.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return list;
}

// Monday-based ISO week
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon=0, ..., Sun=6
  d.setDate(d.getDate() - dow);
  return d;
}
function endOfWeek(date) {
  const s = startOfWeek(date);
  s.setDate(s.getDate() + 6);
  return s;
}
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = d - firstThursday;
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

function periodRange(period, anchorIso) {
  const anchor = parseIsoDay(anchorIso);
  if (period === 'day') return { start: isoDay(anchor), end: isoDay(anchor) };
  if (period === 'week') return { start: isoDay(startOfWeek(anchor)), end: isoDay(endOfWeek(anchor)) };
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return { start: isoDay(first), end: isoDay(last) };
}
function shiftPeriod(period, anchorIso, delta) {
  const d = parseIsoDay(anchorIso);
  if (period === 'day') d.setDate(d.getDate() + delta);
  else if (period === 'week') d.setDate(d.getDate() + delta * 7);
  else d.setMonth(d.getMonth() + delta);
  return isoDay(d);
}
function periodLabel(period, anchorIso) {
  const anchor = parseIsoDay(anchorIso);
  if (period === 'day') {
    return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(anchor);
  }
  if (period === 'week') {
    const s = startOfWeek(anchor);
    const e = endOfWeek(anchor);
    const fmtShort = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
    return `Week ${isoWeekNumber(anchor)} · ${fmtShort.format(s)} – ${fmtShort.format(e)}`;
  }
  return capitalize(MONTH_LONG.format(anchor));
}
function daysInPeriod(period, anchorIso) {
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  const { start, end } = periodRange('month', anchorIso);
  return (parseIsoDay(end).getDate() - parseIsoDay(start).getDate()) + 1;
}
function daysSoFarInPeriod(period, anchorIso, todayIsoStr) {
  const { start, end } = periodRange(period, anchorIso);
  if (todayIsoStr < start) return 0;
  if (todayIsoStr > end) return daysInPeriod(period, anchorIso);
  return (parseIsoDay(todayIsoStr).getTime() - parseIsoDay(start).getTime()) / 86400000 + 1;
}

export default function Finances() {
  const { state, actions } = useStore();
  const categories = state.categories || [];
  const budgetMap = state.budget || {};
  const transactions = state.transactions || [];

  const [period, setPeriod] = useState('month');
  const [anchor, setAnchor] = useState(() => {
    const today = todayIso();
    const withData = new Set();
    for (const c of categories) {
      const per = budgetMap[c.id] || {};
      for (const k of Object.keys(per)) withData.add(k);
    }
    if (withData.has(today.slice(0, 7))) return today;
    const sorted = [...withData].sort();
    if (sorted.length) return `${sorted[0]}-15`;
    return today;
  });
  const [view, setView] = useState('overzicht');
  const month = anchor.slice(0, 7);
  const setMonth = (m) => setAnchor(`${m}-15`);

  const rangeMonths = useMemo(() => {
    const set = new Set();
    for (const c of categories) {
      const per = budgetMap[c.id] || {};
      for (const k of Object.keys(per)) set.add(k);
    }
    for (const t of transactions) set.add(t.date.slice(0, 7));
    set.add(month);
    set.add(isoMonth());
    const list = [...set].sort();
    if (list.length === 0) return [isoMonth()];
    return monthsBetween(list[0], list[list.length - 1]);
  }, [categories, budgetMap, transactions, month]);

  const monthlyTotals = useMemo(
    () => computeMonthlyTotals(categories, budgetMap, transactions, rangeMonths),
    [categories, budgetMap, transactions, rangeMonths]
  );
  const current = monthlyTotals.find((m) => m.month === month) || monthlyTotals[0];

  if (state.loading) {
    return (
      <div className="card">
        <div className="card-sub">Financiële data laden…</div>
      </div>
    );
  }

  const empty = categories.length === 0;

  const showPeriodPicker = view === 'overzicht' || view === 'transacties';

  return (
    <div className="stack finance">
      <div className="fin-header card">
        <div className="fin-month-nav">
          <button
            className="btn ghost small"
            onClick={() => setAnchor(showPeriodPicker ? shiftPeriod(period, anchor, -1) : `${shiftMonth(month, -1)}-15`)}
            aria-label="Vorige"
          >‹</button>
          <div>
            <div className="eyebrow">Periode</div>
            <div className="fin-month-title">
              {showPeriodPicker ? periodLabel(period, anchor) : capitalize(MONTH_LONG.format(monthDate(month)))}
            </div>
          </div>
          <button
            className="btn ghost small"
            onClick={() => setAnchor(showPeriodPicker ? shiftPeriod(period, anchor, 1) : `${shiftMonth(month, 1)}-15`)}
            aria-label="Volgende"
          >›</button>
          <button className="btn small" onClick={() => setAnchor(todayIso())}>Nu</button>
        </div>
        <div className="fin-header-right">
          {showPeriodPicker && (
            <div className="chip-row">
              <button className={`chip ${period === 'day' ? 'active' : ''}`} onClick={() => setPeriod('day')}>Dag</button>
              <button className={`chip ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>Week</button>
              <button className={`chip ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Maand</button>
            </div>
          )}
          <nav className="chip-row fin-view-tabs">
            <button className={`chip ${view === 'overzicht' ? 'active' : ''}`} onClick={() => setView('overzicht')}>📊 Overzicht</button>
            <button className={`chip ${view === 'transacties' ? 'active' : ''}`} onClick={() => setView('transacties')}>💳 Uitgaven boeken</button>
            <button className={`chip ${view === 'begroting' ? 'active' : ''}`} onClick={() => setView('begroting')}>📋 Begroting</button>
          </nav>
        </div>
      </div>

      {empty && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Geen begroting gevonden</h2>
              <div className="card-sub">
                Start met een standaard begroting op basis van het kasboek — je kunt daarna alles bewerken.
              </div>
            </div>
            <button className="btn primary" onClick={() => actions.seedFinanceDefaults()}>
              Standaard begroting laden
            </button>
          </div>
        </section>
      )}

      {!empty && view === 'overzicht' && (
        <OverviewView
          state={state}
          actions={actions}
          period={period}
          anchor={anchor}
          month={month}
          monthlyTotals={monthlyTotals}
          categories={categories}
          budgetMap={budgetMap}
          transactions={transactions}
        />
      )}

      {!empty && view === 'transacties' && (
        <TransactionsView
          actions={actions}
          period={period}
          anchor={anchor}
          setAnchor={setAnchor}
          categories={categories}
          transactions={transactions}
          budgetMap={budgetMap}
        />
      )}

      {!empty && view === 'begroting' && (
        <BudgetView
          actions={actions}
          month={month}
          setMonth={setMonth}
          rangeMonths={rangeMonths}
          categories={categories}
          budgetMap={budgetMap}
        />
      )}
    </div>
  );
}

/* ============ Overview ============ */

function OverviewView({ state, actions, period, anchor, month, monthlyTotals, categories, budgetMap, transactions }) {
  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);
  const catType = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.type])),
    [categories]
  );

  // Actuals within selected period
  const periodActual = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      if (t.date < range.start || t.date > range.end) continue;
      const type = catType[t.categoryId];
      const v = Number(t.amount) || 0;
      if (type === 'income') income += v;
      else if (type === 'expense') expense += v;
    }
    return { income, expense };
  }, [transactions, range, catType]);

  // Prorated budget for the selected period
  const periodBudget = useMemo(() => {
    const daysMonth = daysInPeriod('month', anchor);
    const daysPer = period === 'day' ? 1 : period === 'week' ? 7 : daysMonth;
    let income = 0, expense = 0;
    for (const c of categories) {
      const monthlyBudget = Number((budgetMap[c.id] || {})[month]) || 0;
      let target = 0;
      if (period === 'month') target = monthlyBudget;
      else if (period === 'week' && c.weeklyTarget != null && c.weeklyTarget > 0) target = Number(c.weeklyTarget);
      else if (period === 'day' && c.weeklyTarget != null && c.weeklyTarget > 0) target = Number(c.weeklyTarget) / 7;
      else target = monthlyBudget * (daysPer / daysMonth);
      if (c.type === 'income') income += target;
      else expense += target;
    }
    return { income, expense };
  }, [categories, budgetMap, month, period, anchor]);

  const progress = useMemo(
    () => computePeriodProgress(categories, budgetMap, transactions, period, anchor),
    [categories, budgetMap, transactions, period, anchor]
  );

  const cumulative = useMemo(() => {
    let running = Number(state.financeStartBalance) || 0;
    return monthlyTotals.map((m) => {
      running += m.incomeActual - m.expenseActual;
      return { ...m, running };
    });
  }, [monthlyTotals, state.financeStartBalance]);

  const daysTotal = daysInPeriod(period, anchor);
  const daysSoFar = daysSoFarInPeriod(period, anchor, todayIso());
  const timePct = Math.max(0, Math.min(100, Math.round((daysSoFar / daysTotal) * 100)));

  const runningToDate =
    cumulative.filter((m) => m.month <= month).slice(-1)[0]?.running ?? (Number(state.financeStartBalance) || 0);

  const periodShortLabel =
    period === 'day' ? 'vandaag' : period === 'week' ? 'deze week' : 'deze maand';

  return (
    <>
      <div className="fin-kpis">
        <KpiCard label={`Inkomsten ${periodShortLabel}`} amount={periodActual.income} budget={periodBudget.income} tone="income" />
        <KpiCard label={`Uitgaven ${periodShortLabel}`} amount={periodActual.expense} budget={periodBudget.expense} tone="expense" invertBudget />
        <KpiCard label={`Saldo ${periodShortLabel}`} amount={periodActual.income - periodActual.expense} budget={periodBudget.income - periodBudget.expense} tone="balance" />
        <KpiCard label="Cumulatief" amount={runningToDate} hint={state.financeStartBalance ? `Startsaldo ${EUR.format(state.financeStartBalance)}` : 'Sinds start'} tone="cumulative" />
      </div>

      {period !== 'day' && (
        <section className="card fin-period-card">
          <div className="fin-period-time">
            <div className="fin-period-time-label">
              <span>Tijd verstreken in {period === 'week' ? 'de week' : 'de maand'}</span>
              <span className="dim">{Math.min(Math.floor(daysSoFar), daysTotal)}/{daysTotal} dagen · {timePct}%</span>
            </div>
            <div className="fin-cat-bar-track">
              <div className="fin-period-time-fill" style={{ width: `${timePct}%` }} />
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Cashflow per maand</h2>
            <div className="card-sub">Werkelijk vs. begroot per maand · lijn = cumulatief saldo</div>
          </div>
          <div className="fin-legend">
            <LegendDot color="#10b981" label="Inkomsten actueel" />
            <LegendDot color="#10b98155" label="Inkomsten begroot" />
            <LegendDot color="#ef4444" label="Uitgaven actueel" />
            <LegendDot color="#ef444455" label="Uitgaven begroot" />
            <LegendDot color="#6366f1" label="Cumulatief" line />
          </div>
        </div>
        <CashflowChart cumulative={cumulative} selectedMonth={month} />
      </section>

      <div className="grid-2 fin-grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Uitgaven per categorie</h2>
              <div className="card-sub">{capitalize(periodLabel(period, anchor))}</div>
            </div>
          </div>
          <PeriodProgressBars stats={progress.expenses} tone="expense" period={period} timePct={timePct} />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Inkomsten per categorie</h2>
              <div className="card-sub">{capitalize(periodLabel(period, anchor))}</div>
            </div>
          </div>
          <PeriodProgressBars stats={progress.income} tone="income" period={period} timePct={timePct} />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Startsaldo</h2>
            <div className="card-sub">Startbedrag voor de cumulatieve berekening</div>
          </div>
          <StartBalanceInput value={state.financeStartBalance || 0} onCommit={(v) => actions.setFinanceStartBalance(v)} />
        </div>
      </section>
    </>
  );
}

function StartBalanceInput({ value, onCommit }) {
  const [local, setLocal] = useState(String(value ?? 0));
  useEffect(() => {
    setLocal(String(value ?? 0));
  }, [value]);
  return (
    <div className="input-amount">
      <span className="euro-prefix">€</span>
      <input
        className="input small"
        type="number"
        step="0.01"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const num = Number(local) || 0;
          if (num !== Number(value)) onCommit(num);
        }}
        style={{ width: 140 }}
      />
    </div>
  );
}

/* ============ Transactions ============ */

function TransactionsView({ actions, period, anchor, setAnchor, categories, transactions, budgetMap }) {
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('all');

  const [form, setForm] = useState(() => {
    const firstExpense = categories.find((c) => c.type === 'expense');
    return {
      date: todayIso(),
      categoryId: firstExpense?.id || '',
      description: '',
      amount: '',
    };
  });
  useEffect(() => {
    if (!form.categoryId && categories.length) {
      const firstExpense = categories.find((c) => c.type === 'expense') || categories[0];
      setForm((f) => ({ ...f, categoryId: firstExpense.id }));
    }
  }, [categories, form.categoryId]);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);

  const periodTx = useMemo(() => {
    let list = transactions.filter((t) => t.date >= range.start && t.date <= range.end);
    if (filterType !== 'all') list = list.filter((t) => catById[t.categoryId]?.type === filterType);
    if (filterCat !== 'all') list = list.filter((t) => t.categoryId === filterCat);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, range, filterType, filterCat, catById]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.categoryId || !form.amount) return;
    actions.addFinanceTransaction({
      date: form.date,
      categoryId: form.categoryId,
      description: form.description,
      amount: Number(form.amount),
    });
    setForm({ ...form, description: '', amount: '' });
    if (form.date > range.end || form.date < range.start) setAnchor(form.date);
  };

  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of periodTx) {
      const cat = catById[t.categoryId];
      if (!cat) continue;
      if (cat.type === 'income') income += Number(t.amount) || 0;
      else expense += Number(t.amount) || 0;
    }
    return { income, expense, net: income - expense };
  }, [periodTx, catById]);

  const progress = useMemo(
    () => computePeriodProgress(categories, budgetMap, transactions, period, anchor),
    [categories, budgetMap, transactions, period, anchor]
  );
  const daysTotal = daysInPeriod(period, anchor);
  const daysSoFar = daysSoFarInPeriod(period, anchor, todayIso());
  const timePct = Math.max(0, Math.min(100, Math.round((daysSoFar / daysTotal) * 100)));

  const periodLabelStr = periodLabel(period, anchor);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Nieuwe boeking</h2>
            <div className="card-sub">Kies de categorie — het type (inkomst/uitgave) hoort daar bij.</div>
          </div>
        </div>
        <form className="fin-tx-form" onSubmit={submit}>
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <optgroup label="Uitgaven">
              {categories.filter((c) => c.type === 'expense').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="Inkomsten">
              {categories.filter((c) => c.type === 'income').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          </select>
          <input className="input" placeholder="Omschrijving (optioneel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="input-amount">
            <span className="euro-prefix">€</span>
            <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <button type="submit" className="btn primary">Boeken</button>
        </form>
      </section>

      <div className="fin-kpis fin-kpis-compact">
        <MiniStat label={`Inkomsten ${period === 'day' ? 'vandaag' : period === 'week' ? 'deze week' : 'deze maand'}`} amount={periodTotals.income} tone="income" />
        <MiniStat label={`Uitgaven ${period === 'day' ? 'vandaag' : period === 'week' ? 'deze week' : 'deze maand'}`} amount={periodTotals.expense} tone="expense" />
        <MiniStat label="Netto" amount={periodTotals.net} tone={periodTotals.net >= 0 ? 'income' : 'expense'} />
      </div>

      {period !== 'day' && (
        <section className="card fin-period-card">
          <div className="fin-period-time">
            <div className="fin-period-time-label">
              <span>Tijd verstreken</span>
              <span className="dim">{Math.min(Math.floor(daysSoFar), daysTotal)}/{daysTotal} dagen · {timePct}%</span>
            </div>
            <div className="fin-cat-bar-track">
              <div className="fin-period-time-fill" style={{ width: `${timePct}%` }} />
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Voortgang per categorie</h2>
            <div className="card-sub">
              Uitgaven vs. {period === 'week' ? 'weekdoel (of maand ÷ 4,33)' : period === 'day' ? 'dagdeel van je maandbegroting' : 'maandbegroting'} — na elke boeking zie je direct hoe je ervoor staat.
            </div>
          </div>
        </div>
        <PeriodProgressBars stats={progress.expenses} tone="expense" period={period} timePct={timePct} />
        {progress.income.length > 0 && (
          <>
            <div className="fin-progress-divider">Inkomsten</div>
            <PeriodProgressBars stats={progress.income} tone="income" period={period} timePct={timePct} />
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Boekingen — {periodLabelStr}</h2>
            <div className="card-sub">{periodTx.length} regels</div>
          </div>
          <div className="chip-row">
            <button className={`chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>Alles</button>
            <button className={`chip ${filterType === 'expense' ? 'active' : ''}`} onClick={() => setFilterType('expense')}>Uitgaven</button>
            <button className={`chip ${filterType === 'income' ? 'active' : ''}`} onClick={() => setFilterType('income')}>Inkomsten</button>
            <select className="input tiny" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="all">Alle categorieën</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="fin-tx-list">
          {periodTx.length === 0 && <div className="empty">Nog geen boekingen in deze periode.</div>}
          {periodTx.map((t) => (
            <TransactionRow key={t.id} tx={t} catById={catById} categories={categories} actions={actions} />
          ))}
        </div>
      </section>
    </>
  );
}

function PeriodProgressBars({ stats, tone, period, timePct }) {
  if (stats.length === 0) return <div className="empty">Geen categorieën met budget in deze periode.</div>;
  const max = Math.max(1, ...stats.map((s) => Math.max(s.actual, s.target)));
  return (
    <div className="fin-cat-bars">
      {stats.map((s) => {
        const pct = s.target ? Math.round((s.actual / s.target) * 100) : null;
        const over = tone === 'expense' && s.target && s.actual > s.target;
        const onTrack = tone === 'expense' && s.target && pct != null && pct <= timePct + 5;
        const behind = tone === 'expense' && s.target && pct != null && pct > timePct + 5 && !over;
        const badgeClass = over ? 'over' : onTrack ? 'good' : behind ? 'short' : '';
        return (
          <div key={s.id} className="fin-cat-bar">
            <div className="fin-cat-bar-head">
              <span className="fin-cat-bar-name">
                <span className="fin-cat-bar-dot" style={{ background: s.color }} aria-hidden />
                {s.name}
                {s.sourceLabel && <span className="fin-target-source"> · {s.sourceLabel}</span>}
              </span>
              <span className="fin-cat-bar-vals">
                <strong>{EUR_PRECISE.format(s.actual)}</strong>
                {s.target ? (
                  <span className="dim"> / {EUR_PRECISE.format(s.target)}</span>
                ) : (
                  <span className="dim"> · geen doel</span>
                )}
                {pct != null && (
                  <span className={`fin-cat-bar-pct ${badgeClass}`}>{pct}%</span>
                )}
              </span>
            </div>
            <div className="fin-cat-bar-track">
              {period !== 'day' && s.target > 0 && (
                <div className="fin-cat-bar-time" style={{ left: `${(s.target / max) * timePct}%` }} title={`Tijd verstreken: ${timePct}%`} />
              )}
              <div className="fin-cat-bar-fill-budget" style={{ width: `${(s.target / max) * 100}%`, background: s.color }} />
              <div className={`fin-cat-bar-fill-actual ${over ? 'is-over' : ''}`} style={{ width: `${Math.min(s.actual, max) / max * 100}%`, background: s.color }} />
            </div>
            {s.target > 0 && (
              <div className="fin-cat-bar-sub">
                {tone === 'expense' ? (
                  <>Nog {EUR_PRECISE.format(Math.max(0, s.target - s.actual))} te besteden</>
                ) : (
                  <>Nog {EUR_PRECISE.format(Math.max(0, s.target - s.actual))} te ontvangen</>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TransactionRow({ tx, catById, categories, actions }) {
  const cat = catById[tx.categoryId];
  const color = cat?.color || '#94a3b8';
  const isIncome = cat?.type === 'income';
  const [desc, setDesc] = useState(tx.description || '');
  useEffect(() => setDesc(tx.description || ''), [tx.description]);
  return (
    <div className={`fin-tx-row ${isIncome ? 'is-income' : 'is-expense'}`}>
      <div className="fin-tx-dot" style={{ background: color }} aria-hidden />
      <div className="fin-tx-body">
        <div className="fin-tx-top">
          <span className="fin-tx-cat">{cat?.name || 'Onbekend'}</span>
          <input
            className="fin-tx-desc"
            value={desc}
            placeholder="Voeg omschrijving toe"
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => {
              if (desc !== tx.description) actions.updateFinanceTransaction(tx.id, { description: desc });
            }}
          />
        </div>
        <div className="fin-tx-meta">
          <input
            type="date"
            className="input tiny"
            value={tx.date}
            onChange={(e) => actions.updateFinanceTransaction(tx.id, { date: e.target.value })}
          />
          <select
            className="input tiny"
            value={tx.categoryId}
            onChange={(e) => actions.updateFinanceTransaction(tx.id, { categoryId: e.target.value })}
          >
            <optgroup label="Uitgaven">
              {categories.filter((c) => c.type === 'expense').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="Inkomsten">
              {categories.filter((c) => c.type === 'income').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>
      <div className="fin-tx-amount-wrap">
        <div className={`fin-tx-amount ${isIncome ? 'pos' : 'neg'}`}>
          {isIncome ? '+' : '−'} {EUR_PRECISE.format(Number(tx.amount) || 0)}
        </div>
        <div className="fin-tx-date">{DAY_MONTH.format(new Date(tx.date + 'T00:00'))}</div>
      </div>
      <button className="btn tiny ghost" title="Verwijder" onClick={() => actions.removeFinanceTransaction(tx.id)}>✕</button>
    </div>
  );
}

/* ============ Budget editor ============ */

function BudgetView({ actions, month, setMonth, rangeMonths, categories, budgetMap }) {
  const [newIncome, setNewIncome] = useState('');
  const [newExpense, setNewExpense] = useState('');

  const monthsWindow = useMemo(() => {
    const idx = rangeMonths.indexOf(month);
    if (idx < 0) return rangeMonths.slice(0, 6);
    const start = Math.max(0, idx - 1);
    return rangeMonths.slice(start, start + 6);
  }, [rangeMonths, month]);

  const income = categories.filter((c) => c.type === 'income');
  const expenses = categories.filter((c) => c.type === 'expense');

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Begroting bewerken</h2>
          <div className="card-sub">Bedragen zijn per maand. Leeg = niet begroot. Bekijk max 6 maanden tegelijk.</div>
        </div>
        <div className="chip-row">
          <button className="btn ghost small" onClick={() => setMonth(shiftMonth(monthsWindow[0], -6))} title="6 maanden terug">« -6</button>
          <button className="btn ghost small" onClick={() => setMonth(shiftMonth(monthsWindow[monthsWindow.length - 1], 6))} title="6 maanden vooruit">+6 »</button>
        </div>
      </div>

      <div className="fin-budget-scroll">
        <table className="fin-budget-table">
          <thead>
            <tr>
              <th className="fin-budget-cat-head">Categorie</th>
              <th className="fin-budget-week-head" title="Weekdoel — bijvoorbeeld voor boodschappen">Week</th>
              {monthsWindow.map((m) => (
                <th key={m} className={m === month ? 'is-current' : ''}>
                  {capitalize(MONTH_SHORT.format(monthDate(m)))} '{m.slice(2, 4)}
                </th>
              ))}
              <th className="fin-budget-total-head">Gem/mnd</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr className="fin-budget-section"><td colSpan={monthsWindow.length + 4}>Inkomsten</td></tr>
            {income.map((cat) => (
              <BudgetRow
                key={cat.id}
                cat={cat}
                budget={budgetMap[cat.id] || {}}
                months={monthsWindow}
                current={month}
                actions={actions}
              />
            ))}
            <tr className="fin-budget-add-row">
              <td colSpan={monthsWindow.length + 4}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newIncome.trim()) return;
                    actions.addFinanceCategory(newIncome, 'income');
                    setNewIncome('');
                  }}
                  className="fin-cat-add"
                >
                  <input className="input tiny" placeholder="+ Inkomstencategorie toevoegen" value={newIncome} onChange={(e) => setNewIncome(e.target.value)} />
                  <button type="submit" className="btn tiny">Toevoegen</button>
                </form>
              </td>
            </tr>

            <tr className="fin-budget-section"><td colSpan={monthsWindow.length + 4}>Uitgaven</td></tr>
            {expenses.map((cat) => (
              <BudgetRow
                key={cat.id}
                cat={cat}
                budget={budgetMap[cat.id] || {}}
                months={monthsWindow}
                current={month}
                actions={actions}
              />
            ))}
            <tr className="fin-budget-add-row">
              <td colSpan={monthsWindow.length + 4}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newExpense.trim()) return;
                    actions.addFinanceCategory(newExpense, 'expense');
                    setNewExpense('');
                  }}
                  className="fin-cat-add"
                >
                  <input className="input tiny" placeholder="+ Uitgavencategorie toevoegen" value={newExpense} onChange={(e) => setNewExpense(e.target.value)} />
                  <button type="submit" className="btn tiny">Toevoegen</button>
                </form>
              </td>
            </tr>

            <tr className="fin-budget-totals">
              <td>Totaal inkomsten</td>
              <td></td>
              {monthsWindow.map((m) => (
                <td key={m}>{EUR.format(sumOf(income, budgetMap, m))}</td>
              ))}
              <td>{EUR.format(avgOf(income, budgetMap, monthsWindow))}</td>
              <td></td>
            </tr>
            <tr className="fin-budget-totals">
              <td>Totaal uitgaven</td>
              <td></td>
              {monthsWindow.map((m) => (
                <td key={m}>{EUR.format(sumOf(expenses, budgetMap, m))}</td>
              ))}
              <td>{EUR.format(avgOf(expenses, budgetMap, monthsWindow))}</td>
              <td></td>
            </tr>
            <tr className="fin-budget-totals is-net">
              <td>Netto (over)</td>
              <td></td>
              {monthsWindow.map((m) => {
                const v = sumOf(income, budgetMap, m) - sumOf(expenses, budgetMap, m);
                return <td key={m} className={v < 0 ? 'neg' : 'pos'}>{EUR.format(v)}</td>;
              })}
              <td>{EUR.format(avgOf(income, budgetMap, monthsWindow) - avgOf(expenses, budgetMap, monthsWindow))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BudgetRow({ cat, budget, months, current, actions }) {
  const [name, setName] = useState(cat.name);
  useEffect(() => setName(cat.name), [cat.name]);
  const values = months.map((m) => Number(budget[m]) || 0);
  const positive = values.filter((v) => v > 0);
  const avg = positive.length > 0 ? positive.reduce((a, b) => a + b, 0) / positive.length : 0;

  return (
    <tr>
      <td className="fin-budget-cat">
        <span className="fin-budget-dot" style={{ background: cat.color }} aria-hidden />
        <input
          className="fin-budget-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== cat.name) actions.renameFinanceCategory(cat.id, name.trim());
            else if (!name.trim()) setName(cat.name);
          }}
        />
      </td>
      <td className="fin-budget-week">
        <BudgetCell
          value={cat.weeklyTarget}
          onCommit={(v) => actions.setFinanceCategoryWeeklyTarget(cat.id, v)}
        />
      </td>
      {months.map((m) => (
        <td key={m} className={m === current ? 'is-current' : ''}>
          <BudgetCell
            value={budget[m]}
            onCommit={(v) => actions.setBudgetEntry(cat.id, m, v)}
          />
        </td>
      ))}
      <td className="fin-budget-avg">{avg ? EUR.format(avg) : '—'}</td>
      <td>
        <button
          className="btn tiny ghost"
          onClick={() => {
            if (window.confirm(`"${cat.name}" verwijderen? Bijbehorende boekingen en begroting worden ook verwijderd.`)) {
              actions.removeFinanceCategory(cat.id);
            }
          }}
          title="Categorie verwijderen"
        >✕</button>
      </td>
    </tr>
  );
}

function BudgetCell({ value, onCommit }) {
  const [local, setLocal] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setLocal(value == null ? '' : String(value));
  }, [value]);
  return (
    <input
      className="fin-budget-cell"
      type="number"
      step="0.01"
      value={local}
      placeholder="—"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const nextRaw = local;
        const same = String(value ?? '') === nextRaw;
        if (same) return;
        onCommit(nextRaw === '' ? undefined : Number(nextRaw));
      }}
    />
  );
}

function sumOf(cats, budgetMap, month) {
  let sum = 0;
  for (const c of cats) sum += Number((budgetMap[c.id] || {})[month]) || 0;
  return sum;
}
function avgOf(cats, budgetMap, months) {
  if (months.length === 0) return 0;
  let sum = 0;
  for (const m of months) sum += sumOf(cats, budgetMap, m);
  return sum / months.length;
}

/* ============ Chart ============ */

function CashflowChart({ cumulative, selectedMonth }) {
  const width = 780;
  const height = 260;
  const pad = { top: 20, right: 40, bottom: 34, left: 56 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  if (cumulative.length === 0) return <div className="empty">Nog geen data.</div>;

  const maxBar = Math.max(
    1,
    ...cumulative.map((m) => Math.max(m.incomeActual, m.incomeBudget, m.expenseActual, m.expenseBudget))
  );
  const runningValues = cumulative.map((m) => m.running);
  const runMin = Math.min(0, ...runningValues);
  const runMax = Math.max(1, ...runningValues);
  const runningSpan = Math.max(1, runMax - runMin);

  const bandW = chartW / cumulative.length;
  const barW = Math.max(4, Math.min(18, bandW * 0.28));
  const gap = 3;

  const yBar = (v) => pad.top + chartH - (v / maxBar) * chartH;
  const yRun = (v) => pad.top + chartH - ((v - runMin) / runningSpan) * chartH;

  const linePath = cumulative
    .map((m, i) => {
      const x = pad.left + i * bandW + bandW / 2;
      const y = yRun(m.running);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (maxBar * i) / yTicks);

  return (
    <div className="fin-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="fin-chart" preserveAspectRatio="none">
        {ticks.map((t) => {
          const y = yBar(t);
          return (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + chartW} y1={y} y2={y} stroke="var(--border)" strokeDasharray={t === 0 ? '' : '3 3'} />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">{EUR.format(t)}</text>
            </g>
          );
        })}

        {cumulative.map((m, i) => {
          const cx = pad.left + i * bandW + bandW / 2;
          const active = m.month === selectedMonth;
          const inX = cx - barW - gap / 2;
          const outX = cx + gap / 2;
          return (
            <g key={m.month} opacity={active ? 1 : 0.9}>
              {active && (
                <rect x={pad.left + i * bandW} y={pad.top} width={bandW} height={chartH} fill="var(--accent-soft)" opacity="0.5" />
              )}
              <rect x={inX} y={yBar(m.incomeBudget)} width={barW} height={chartH - (yBar(m.incomeBudget) - pad.top)} fill="#10b981" opacity="0.28" />
              <rect x={inX} y={yBar(m.incomeActual)} width={barW} height={chartH - (yBar(m.incomeActual) - pad.top)} fill="#10b981" />
              <rect x={outX} y={yBar(m.expenseBudget)} width={barW} height={chartH - (yBar(m.expenseBudget) - pad.top)} fill="#ef4444" opacity="0.28" />
              <rect x={outX} y={yBar(m.expenseActual)} width={barW} height={chartH - (yBar(m.expenseActual) - pad.top)} fill="#ef4444" />
              <text x={cx} y={height - 12} textAnchor="middle" fontSize="10.5" fill={active ? 'var(--accent)' : 'var(--text-muted)'} fontWeight={active ? 700 : 500}>
                {capitalize(MONTH_SHORT.format(monthDate(m.month)))}
              </text>
              {i === 0 || i === cumulative.length - 1 || active ? (
                <text x={cx} y={Math.max(yRun(m.running) - 6, pad.top + 8)} textAnchor="middle" fontSize="10" fill="#6366f1" fontWeight="600">
                  {EUR.format(m.running)}
                </text>
              ) : null}
            </g>
          );
        })}

        {runMin < 0 && (
          <line x1={pad.left} x2={pad.left + chartW} y1={yRun(0)} y2={yRun(0)} stroke="var(--danger)" strokeDasharray="4 4" opacity="0.4" />
        )}

        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {cumulative.map((m, i) => {
          const cx = pad.left + i * bandW + bandW / 2;
          const cy = yRun(m.running);
          const active = m.month === selectedMonth;
          return (
            <circle key={m.month} cx={cx} cy={cy} r={active ? 4.5 : 3} fill="#fff" stroke="#6366f1" strokeWidth={active ? 2.5 : 1.8} />
          );
        })}
      </svg>
    </div>
  );
}

/* ============ Small pieces ============ */

function KpiCard({ label, amount, budget, tone, hint, invertBudget }) {
  const has = budget != null && !Number.isNaN(budget) && budget !== 0;
  let delta = null;
  if (has) {
    const raw = amount - budget;
    const better = invertBudget ? raw <= 0 : raw >= 0;
    delta = { raw, better };
  }
  const color =
    tone === 'income'
      ? 'var(--success)'
      : tone === 'expense'
      ? 'var(--danger)'
      : tone === 'balance'
      ? (amount >= 0 ? 'var(--success)' : 'var(--danger)')
      : 'var(--accent)';
  return (
    <div className={`card fin-kpi fin-kpi-${tone}`}>
      <div className="eyebrow">{label}</div>
      <div className="fin-kpi-amount" style={{ color }}>{EUR.format(amount || 0)}</div>
      {delta ? (
        <div className={`fin-kpi-delta ${delta.better ? 'is-good' : 'is-bad'}`}>
          {delta.raw >= 0 ? '+' : ''}
          {EUR.format(delta.raw)} t.o.v. begroot ({EUR.format(budget)})
        </div>
      ) : hint ? (
        <div className="fin-kpi-hint">{hint}</div>
      ) : (
        <div className="fin-kpi-hint">Geen begroting</div>
      )}
    </div>
  );
}

function MiniStat({ label, amount, tone }) {
  const color = tone === 'income' ? 'var(--success)' : 'var(--danger)';
  return (
    <div className="card fin-mini">
      <div className="eyebrow">{label}</div>
      <div className="fin-mini-amount" style={{ color }}>{EUR_PRECISE.format(amount || 0)}</div>
    </div>
  );
}

function CategoryBars({ stats, tone }) {
  if (stats.length === 0) return <div className="empty">Geen categorieën in deze maand.</div>;
  const max = Math.max(1, ...stats.map((s) => Math.max(s.actual, s.budget)));
  return (
    <div className="fin-cat-bars">
      {stats.map((s) => {
        const pct = s.budget ? Math.round((s.actual / s.budget) * 100) : null;
        const over = tone === 'expense' && s.budget && s.actual > s.budget;
        const good = tone === 'expense' && s.budget && s.actual <= s.budget;
        const incomeShort = tone === 'income' && s.budget && s.actual < s.budget;
        return (
          <div key={s.id} className="fin-cat-bar">
            <div className="fin-cat-bar-head">
              <span className="fin-cat-bar-name">
                <span className="fin-cat-bar-dot" style={{ background: s.color }} aria-hidden />
                {s.name}
              </span>
              <span className="fin-cat-bar-vals">
                <strong>{EUR.format(s.actual)}</strong>
                {s.budget ? (<span className="dim"> / {EUR.format(s.budget)}</span>) : (<span className="dim"> · geen begroting</span>)}
                {pct != null && (
                  <span className={`fin-cat-bar-pct ${over ? 'over' : good ? 'good' : incomeShort ? 'short' : ''}`}>{pct}%</span>
                )}
              </span>
            </div>
            <div className="fin-cat-bar-track">
              <div className="fin-cat-bar-fill-budget" style={{ width: `${(s.budget / max) * 100}%`, background: s.color }} />
              <div className={`fin-cat-bar-fill-actual ${over ? 'is-over' : ''}`} style={{ width: `${(s.actual / max) * 100}%`, background: s.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LegendDot({ color, label, line }) {
  return (
    <span className="fin-legend-dot">
      {line ? (
        <span className="fin-legend-line" style={{ background: color }} />
      ) : (
        <span className="fin-legend-square" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

/* ============ Helpers ============ */

function computeMonthlyTotals(categories, budgetMap, transactions, months) {
  const catType = Object.fromEntries(categories.map((c) => [c.id, c.type]));
  return months.map((m) => {
    let incomeBudget = 0;
    let expenseBudget = 0;
    for (const c of categories) {
      const v = Number((budgetMap[c.id] || {})[m]) || 0;
      if (c.type === 'income') incomeBudget += v;
      else expenseBudget += v;
    }
    let incomeActual = 0;
    let expenseActual = 0;
    for (const t of transactions) {
      if (t.date.slice(0, 7) !== m) continue;
      const type = catType[t.categoryId];
      const v = Number(t.amount) || 0;
      if (type === 'income') incomeActual += v;
      else if (type === 'expense') expenseActual += v;
    }
    return { month: m, incomeBudget, expenseBudget, incomeActual, expenseActual };
  });
}

function computePeriodProgress(categories, budgetMap, transactions, period, anchorIso) {
  const { start, end } = periodRange(period, anchorIso);
  const monthKey = anchorIso.slice(0, 7);
  const daysInMonth = daysInPeriod('month', anchorIso);

  const perCat = new Map();
  for (const c of categories) {
    const monthBudget = Number((budgetMap[c.id] || {})[monthKey]) || 0;
    let target = 0;
    let sourceLabel = null;
    if (period === 'month') {
      target = monthBudget;
      sourceLabel = 'maand';
    } else if (period === 'week') {
      if (c.weeklyTarget != null && c.weeklyTarget > 0) {
        target = Number(c.weeklyTarget) || 0;
        sourceLabel = 'weekdoel';
      } else if (monthBudget > 0) {
        target = monthBudget / (daysInMonth / 7);
        sourceLabel = 'maand ÷ weken';
      }
    } else {
      // day
      if (c.weeklyTarget != null && c.weeklyTarget > 0) {
        target = Number(c.weeklyTarget) / 7;
        sourceLabel = 'weekdoel ÷ 7';
      } else if (monthBudget > 0) {
        target = monthBudget / daysInMonth;
        sourceLabel = 'maand ÷ dagen';
      }
    }
    perCat.set(c.id, {
      id: c.id,
      name: c.name,
      color: c.color,
      type: c.type,
      target,
      actual: 0,
      sourceLabel,
    });
  }
  for (const t of transactions) {
    if (t.date < start || t.date > end) continue;
    const s = perCat.get(t.categoryId);
    if (s) s.actual += Number(t.amount) || 0;
  }
  const all = [...perCat.values()];
  const sort = (a, b) => (b.actual + b.target) - (a.actual + a.target);
  return {
    income: all.filter((s) => s.type === 'income' && (s.actual || s.target)).sort(sort),
    expenses: all.filter((s) => s.type === 'expense' && (s.actual || s.target)).sort(sort),
  };
}

function computeCategoryStats(categories, budgetMap, transactions, month) {
  const perCat = new Map();
  for (const c of categories) {
    perCat.set(c.id, {
      id: c.id,
      name: c.name,
      color: c.color,
      type: c.type,
      budget: Number((budgetMap[c.id] || {})[month]) || 0,
      actual: 0,
    });
  }
  for (const t of transactions) {
    if (t.date.slice(0, 7) !== month) continue;
    const s = perCat.get(t.categoryId);
    if (s) s.actual += Number(t.amount) || 0;
  }
  const all = [...perCat.values()];
  const sort = (a, b) => (b.actual + b.budget) - (a.actual + a.budget);
  return {
    income: all.filter((s) => s.type === 'income' && (s.actual || s.budget)).sort(sort),
    expenses: all.filter((s) => s.type === 'expense' && (s.actual || s.budget)).sort(sort),
  };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
