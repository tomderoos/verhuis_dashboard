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

export default function Finances() {
  const { state, actions } = useStore();
  const categories = state.categories || [];
  const budgetMap = state.budget || {};
  const transactions = state.transactions || [];

  const [month, setMonth] = useState(() => {
    const t = isoMonth();
    const withData = new Set();
    for (const c of categories) {
      const per = budgetMap[c.id] || {};
      for (const k of Object.keys(per)) withData.add(k);
    }
    if (withData.has(t)) return t;
    const sorted = [...withData].sort();
    return sorted[0] || t;
  });
  const [view, setView] = useState('overzicht');

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

  return (
    <div className="stack finance">
      <div className="fin-header card">
        <div className="fin-month-nav">
          <button className="btn ghost small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Vorige maand">‹</button>
          <div>
            <div className="eyebrow">Actuele maand</div>
            <div className="fin-month-title">{capitalize(MONTH_LONG.format(monthDate(month)))}</div>
          </div>
          <button className="btn ghost small" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Volgende maand">›</button>
          <button className="btn small" onClick={() => setMonth(isoMonth())}>Deze maand</button>
        </div>
        <nav className="chip-row fin-view-tabs">
          <button className={`chip ${view === 'overzicht' ? 'active' : ''}`} onClick={() => setView('overzicht')}>📊 Overzicht</button>
          <button className={`chip ${view === 'transacties' ? 'active' : ''}`} onClick={() => setView('transacties')}>💳 Uitgaven boeken</button>
          <button className={`chip ${view === 'begroting' ? 'active' : ''}`} onClick={() => setView('begroting')}>📋 Begroting</button>
        </nav>
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
          month={month}
          monthlyTotals={monthlyTotals}
          current={current}
          categories={categories}
          budgetMap={budgetMap}
          transactions={transactions}
        />
      )}

      {!empty && view === 'transacties' && (
        <TransactionsView
          actions={actions}
          month={month}
          categories={categories}
          transactions={transactions}
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

function OverviewView({ state, actions, month, monthlyTotals, current, categories, budgetMap, transactions }) {
  const currentTotals = current || { incomeActual: 0, incomeBudget: 0, expenseActual: 0, expenseBudget: 0 };
  const categoryStats = useMemo(
    () => computeCategoryStats(categories, budgetMap, transactions, month),
    [categories, budgetMap, transactions, month]
  );

  const cumulative = useMemo(() => {
    let running = Number(state.financeStartBalance) || 0;
    return monthlyTotals.map((m) => {
      running += m.incomeActual - m.expenseActual;
      return { ...m, running };
    });
  }, [monthlyTotals, state.financeStartBalance]);
  const runningToDate =
    cumulative.filter((m) => m.month <= month).slice(-1)[0]?.running ?? (Number(state.financeStartBalance) || 0);

  return (
    <>
      <div className="fin-kpis">
        <KpiCard label="Inkomsten" amount={currentTotals.incomeActual} budget={currentTotals.incomeBudget} tone="income" />
        <KpiCard label="Uitgaven" amount={currentTotals.expenseActual} budget={currentTotals.expenseBudget} tone="expense" invertBudget />
        <KpiCard label="Saldo deze maand" amount={currentTotals.incomeActual - currentTotals.expenseActual} budget={currentTotals.incomeBudget - currentTotals.expenseBudget} tone="balance" />
        <KpiCard label="Cumulatief" amount={runningToDate} hint={state.financeStartBalance ? `Startsaldo ${EUR.format(state.financeStartBalance)}` : 'Sinds start'} tone="cumulative" />
      </div>

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
              <div className="card-sub">Begroot en werkelijk in {capitalize(MONTH_LONG.format(monthDate(month)))}</div>
            </div>
          </div>
          <CategoryBars stats={categoryStats.expenses} tone="expense" />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Inkomsten per categorie</h2>
              <div className="card-sub">Werkelijk t.o.v. begroot in {capitalize(MONTH_LONG.format(monthDate(month)))}</div>
            </div>
          </div>
          <CategoryBars stats={categoryStats.income} tone="income" />
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

function TransactionsView({ actions, month, categories, transactions }) {
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

  const monthTx = useMemo(() => {
    let list = transactions.filter((t) => t.date.slice(0, 7) === month);
    if (filterType !== 'all') list = list.filter((t) => catById[t.categoryId]?.type === filterType);
    if (filterCat !== 'all') list = list.filter((t) => t.categoryId === filterCat);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, month, filterType, filterCat, catById]);

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
  };

  const monthTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthTx) {
      const cat = catById[t.categoryId];
      if (!cat) continue;
      if (cat.type === 'income') income += Number(t.amount) || 0;
      else expense += Number(t.amount) || 0;
    }
    return { income, expense, net: income - expense };
  }, [monthTx, catById]);

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
        <MiniStat label="Inkomsten deze maand" amount={monthTotals.income} tone="income" />
        <MiniStat label="Uitgaven deze maand" amount={monthTotals.expense} tone="expense" />
        <MiniStat label="Netto" amount={monthTotals.net} tone={monthTotals.net >= 0 ? 'income' : 'expense'} />
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Boekingen in {capitalize(MONTH_LONG.format(monthDate(month)))}</h2>
            <div className="card-sub">{monthTx.length} regels</div>
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
          {monthTx.length === 0 && <div className="empty">Nog geen boekingen deze maand.</div>}
          {monthTx.map((t) => (
            <TransactionRow key={t.id} tx={t} catById={catById} categories={categories} actions={actions} />
          ))}
        </div>
      </section>
    </>
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
            <tr className="fin-budget-section"><td colSpan={monthsWindow.length + 3}>Inkomsten</td></tr>
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
              <td colSpan={monthsWindow.length + 3}>
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

            <tr className="fin-budget-section"><td colSpan={monthsWindow.length + 3}>Uitgaven</td></tr>
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
              <td colSpan={monthsWindow.length + 3}>
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
              {monthsWindow.map((m) => (
                <td key={m}>{EUR.format(sumOf(income, budgetMap, m))}</td>
              ))}
              <td>{EUR.format(avgOf(income, budgetMap, monthsWindow))}</td>
              <td></td>
            </tr>
            <tr className="fin-budget-totals">
              <td>Totaal uitgaven</td>
              {monthsWindow.map((m) => (
                <td key={m}>{EUR.format(sumOf(expenses, budgetMap, m))}</td>
              ))}
              <td>{EUR.format(avgOf(expenses, budgetMap, monthsWindow))}</td>
              <td></td>
            </tr>
            <tr className="fin-budget-totals is-net">
              <td>Netto (over)</td>
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
