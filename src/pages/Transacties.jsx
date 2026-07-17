import React, { useMemo, useState } from 'react';
import { useStore, useCategoryMap, useUserMap } from '../store.jsx';
import { formatCurrency, formatDate } from '../utils/format.js';
import { isInPeriod, formatPeriodLabel } from '../utils/period.js';
import PeriodNav from '../components/PeriodNav.jsx';
import UserFilter from '../components/UserFilter.jsx';
import Modal from '../components/Modal.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import CsvImport from './CsvImport.jsx';

export default function Transacties() {
  const { state, actions } = useStore();
  const categoryMap = useCategoryMap();
  const userMap = useUserMap();
  const [period, setPeriod] = useState('month');
  const [reference, setReference] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState('all'); // all / income / expense
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const activeUserId = state.settings.activeUserId;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.transactions
      .filter((t) => {
        if (activeUserId && t.userId !== activeUserId) return false;
        if (!isInPeriod(t.date, period, reference)) return false;
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
        if (q && !`${t.description || ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.transactions, activeUserId, period, reference, typeFilter, categoryFilter, search]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filtered.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return { income, expense, net: income - expense };
  }, [filtered]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} transacties verwijderen?`)) return;
    actions.removeTransactions(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transacties</h1>
          <p className="page-subtitle">{filtered.length} in {formatPeriodLabel(period, reference)}</p>
        </div>
        <div className="row wrap gap-12">
          <button className="btn" onClick={() => setShowImport(true)}>📥 CSV importeren</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>+ Nieuwe transactie</button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="row wrap gap-12 mb-12">
          <UserFilter />
          <PeriodNav period={period} setPeriod={setPeriod} reference={reference} setReference={setReference} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Zoeken</label>
            <input
              type="search"
              className="input"
              placeholder="Zoek in omschrijving…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Alles</option>
              <option value="income">Inkomsten</option>
              <option value="expense">Uitgaven</option>
            </select>
          </div>
          <div className="field">
            <label>Categorie</label>
            <select className="select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">Alle categorieën</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid cols-3 mb-16">
        <div className="card stat">
          <span className="stat-label">Inkomsten</span>
          <span className="stat-value positive mono">{formatCurrency(totals.income)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Uitgaven</span>
          <span className="stat-value negative mono">{formatCurrency(totals.expense)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Saldo</span>
          <span className={`stat-value mono ${totals.net >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(totals.net)}</span>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card mb-16 between">
          <span><strong>{selected.size}</strong> geselecteerd</span>
          <div className="row gap-8">
            <button className="btn ghost small" onClick={() => setSelected(new Set())}>Deselecteer</button>
            <button className="btn danger small" onClick={deleteSelected}>Verwijder geselecteerde</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card empty">
          <div className="icon">💳</div>
          Geen transacties gevonden. Pas de filters aan of voeg er een toe.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th>Datum</th>
                <th>Omschrijving</th>
                <th>Categorie</th>
                <th>Wie</th>
                <th className="right">Bedrag</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const cat = categoryMap[t.categoryId];
                const usr = userMap[t.userId];
                return (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </td>
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
                    <td>
                      <div className="row gap-4">
                        <button className="btn ghost icon small" onClick={() => setEditing(t)} title="Bewerken">✎</button>
                        <button
                          className="btn ghost icon small"
                          onClick={() => { if (confirm('Deze transactie verwijderen?')) actions.removeTransaction(t.id); }}
                          title="Verwijderen"
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Nieuwe transactie" onClose={() => setShowAdd(false)}>
          <TransactionForm
            onSave={(tx) => { actions.addTransaction(tx); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
            submitLabel="Toevoegen"
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Transactie bewerken" onClose={() => setEditing(null)}>
          <TransactionForm
            initial={editing}
            onSave={(tx) => { actions.updateTransaction(editing.id, tx); setEditing(null); }}
            onCancel={() => setEditing(null)}
            submitLabel="Opslaan"
          />
        </Modal>
      )}

      {showImport && (
        <CsvImport onClose={() => setShowImport(false)} />
      )}
    </>
  );
}
