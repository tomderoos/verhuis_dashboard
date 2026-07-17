import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency, formatDate } from '../utils/format.js';
import { parseCsv, detectFormat, rowToTransaction, suggestCategoryId, BANK_FORMATS } from '../utils/csv.js';

const EMPTY_MAPPING = {
  date: '',
  amount: '',
  description: '',
  notes: '',
  typeColumn: '',
  typeIncomeValue: '',
  typeExpenseValue: '',
};

export default function CsvImport({ onClose }) {
  const { state, actions } = useStore();
  const [step, setStep] = useState(1); // 1: upload, 2: mapping, 3: preview
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState(EMPTY_MAPPING);
  const [defaultUserId, setDefaultUserId] = useState(state.settings.activeUserId || state.users[0]?.id || '');
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [items, setItems] = useState([]); // {selected, tx, key}
  const [error, setError] = useState(null);

  const onFile = async (file) => {
    setError(null);
    try {
      const text = await file.text();
      const { rows, headers, errors } = parseCsv(text);
      if (errors && errors.length > 0) {
        console.warn('CSV parse waarschuwingen:', errors);
      }
      if (rows.length === 0) throw new Error('Geen rijen gevonden in bestand.');
      setRawRows(rows);
      setHeaders(headers);
      const format = detectFormat(headers);
      setDetectedFormat(format || null);
      if (format) {
        setMapping({ ...EMPTY_MAPPING, ...format.mapping });
      } else {
        setMapping(EMPTY_MAPPING);
      }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Kon bestand niet lezen.');
    }
  };

  const goToPreview = () => {
    if (!mapping.date || !mapping.amount) {
      setError('Datum en Bedrag zijn verplicht.');
      return;
    }
    setError(null);
    const parsed = rawRows
      .map((row, i) => {
        const tx = rowToTransaction(row, mapping, { userId: defaultUserId });
        if (!tx) return null;
        const suggestedCat = suggestCategoryId(tx.description, state.categories.filter((c) => c.type === tx.type));
        return {
          key: `row_${i}`,
          selected: true,
          tx: { ...tx, categoryId: suggestedCat || null },
        };
      })
      .filter(Boolean);
    if (parsed.length === 0) {
      setError('Geen geldige transacties gevonden. Controleer je kolom-mapping.');
      return;
    }
    setItems(parsed);
    setStep(3);
  };

  const toggle = (key) => setItems((prev) => prev.map((it) => it.key === key ? { ...it, selected: !it.selected } : it));
  const toggleAll = () => {
    const allSelected = items.every((it) => it.selected);
    setItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })));
  };

  const updateItem = (key, patch) => setItems((prev) => prev.map((it) => it.key === key ? { ...it, tx: { ...it.tx, ...patch } } : it));

  const doImport = () => {
    const toImport = items.filter((it) => it.selected).map((it) => it.tx);
    if (toImport.length === 0) return;
    actions.addTransactions(toImport);
    onClose();
  };

  const selectedCount = items.filter((it) => it.selected).length;
  const selectedIncome = items.filter((it) => it.selected && it.tx.type === 'income').reduce((s, it) => s + it.tx.amount, 0);
  const selectedExpense = items.filter((it) => it.selected && it.tx.type === 'expense').reduce((s, it) => s + it.tx.amount, 0);

  return (
    <Modal title="CSV importeren" onClose={onClose}>
      <div className="tabs mb-16">
        <div className={`tab ${step === 1 ? 'active' : ''}`}>1. Bestand</div>
        <div className={`tab ${step === 2 ? 'active' : ''}`}>2. Kolommen</div>
        <div className={`tab ${step === 3 ? 'active' : ''}`}>3. Controleren</div>
      </div>

      {error && <div className="card mb-12" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'var(--danger)' }}>{error}</div>}

      {step === 1 && (
        <>
          <p className="text-muted mb-12">
            Upload een CSV van je bank. Formaten van ING, Rabobank en ABN AMRO worden automatisch herkend.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
            className="input"
          />
          <div className="text-subtle mt-12" style={{ fontSize: 12 }}>
            Tip: exporteer in je bankier-omgeving als CSV (bij ING is dat "Downloaden" onder Mutaties).
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {detectedFormat ? (
            <div className="badge mb-12" style={{ background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success)' }}>
              <span className="dot" /> Formaat herkend: {detectedFormat.name}
            </div>
          ) : (
            <div className="badge mb-12" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
              <span className="dot" /> Formaat niet herkend — kies zelf de kolommen
            </div>
          )}
          <div className="form-row mb-12">
            <MapField label="Datum *" value={mapping.date} onChange={(v) => setMapping((m) => ({ ...m, date: v }))} headers={headers} />
            <MapField label="Bedrag *" value={mapping.amount} onChange={(v) => setMapping((m) => ({ ...m, amount: v }))} headers={headers} />
          </div>
          <div className="form-row mb-12">
            <MapField label="Omschrijving" value={mapping.description} onChange={(v) => setMapping((m) => ({ ...m, description: v }))} headers={headers} />
            <MapField label="Extra info (mededelingen)" value={mapping.notes} onChange={(v) => setMapping((m) => ({ ...m, notes: v }))} headers={headers} />
          </div>
          <div className="form-row mb-12">
            <MapField label="Type-kolom (optioneel)" value={mapping.typeColumn} onChange={(v) => setMapping((m) => ({ ...m, typeColumn: v }))} headers={headers} />
            {mapping.typeColumn && (
              <>
                <div className="field">
                  <label>Waarde voor uitgave</label>
                  <input className="input" value={mapping.typeExpenseValue} onChange={(e) => setMapping((m) => ({ ...m, typeExpenseValue: e.target.value }))} placeholder="Af" />
                </div>
                <div className="field">
                  <label>Waarde voor inkomst</label>
                  <input className="input" value={mapping.typeIncomeValue} onChange={(e) => setMapping((m) => ({ ...m, typeIncomeValue: e.target.value }))} placeholder="Bij" />
                </div>
              </>
            )}
          </div>
          <div className="field mb-12">
            <label>Standaard gebruiker voor deze import</label>
            <select className="select" value={defaultUserId} onChange={(e) => setDefaultUserId(e.target.value)}>
              <option value="">— Geen —</option>
              {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setStep(1)}>← Terug</button>
            <button className="btn primary" onClick={goToPreview}>Verder →</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="between mb-12">
            <div className="row gap-12">
              <span><strong>{selectedCount}</strong> geselecteerd</span>
              <span className="text-muted mono">+{formatCurrency(selectedIncome)} · −{formatCurrency(selectedExpense)}</span>
            </div>
            <button className="btn ghost small" onClick={toggleAll}>{items.every((it) => it.selected) ? 'Deselecteer alles' : 'Selecteer alles'}</button>
          </div>
          <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Datum</th>
                  <th>Omschrijving</th>
                  <th>Categorie</th>
                  <th className="right">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key} style={{ opacity: it.selected ? 1 : 0.4 }}>
                    <td><input type="checkbox" checked={it.selected} onChange={() => toggle(it.key)} /></td>
                    <td className="mono">{formatDate(it.tx.date)}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.tx.description}>
                      {it.tx.description}
                    </td>
                    <td>
                      <select
                        className="select"
                        style={{ padding: '4px 8px', fontSize: 13 }}
                        value={it.tx.categoryId || ''}
                        onChange={(e) => updateItem(it.key, { categoryId: e.target.value || null })}
                      >
                        <option value="">— Geen —</option>
                        {state.categories.filter((c) => c.type === it.tx.type).map((c) => (
                          <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`right mono amount ${it.tx.type}`}>
                      {it.tx.type === 'expense' ? '−' : '+'}{formatCurrency(it.tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setStep(2)}>← Terug</button>
            <button className="btn primary" onClick={doImport} disabled={selectedCount === 0}>
              {selectedCount} transacties importeren
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function MapField({ label, value, onChange, headers }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Geen —</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}
