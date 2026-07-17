import React, { useState, useEffect } from 'react';
import { useStore } from '../store.jsx';
import { parseAmount } from '../utils/format.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionForm({ initial, onSave, onCancel, submitLabel = 'Opslaan' }) {
  const { state } = useStore();
  const [type, setType] = useState(initial?.type || 'expense');
  const [date, setDate] = useState(initial?.date || today());
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount).replace('.', ',') : '');
  const [description, setDescription] = useState(initial?.description || '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '');
  const [userId, setUserId] = useState(initial?.userId || state.settings.activeUserId || state.users[0]?.id || '');

  useEffect(() => {
    // Als type verandert en huidige categorie past niet, leegmaken
    const cat = state.categories.find((c) => c.id === categoryId);
    if (cat && cat.type !== type) setCategoryId('');
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCategories = state.categories.filter((c) => c.type === type);

  const submit = (e) => {
    e.preventDefault();
    const parsedAmount = parseAmount(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      alert('Vul een geldig bedrag in.');
      return;
    }
    onSave({
      type,
      date,
      amount: Math.abs(parsedAmount),
      description: description.trim(),
      categoryId: categoryId || null,
      userId: userId || null,
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="tabs mb-16">
        <button type="button" className={`tab ${type === 'expense' ? 'active' : ''}`} onClick={() => setType('expense')}>
          Uitgave
        </button>
        <button type="button" className={`tab ${type === 'income' ? 'active' : ''}`} onClick={() => setType('income')}>
          Inkomst
        </button>
      </div>
      <div className="form-row mb-12">
        <div className="field">
          <label>Datum</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Bedrag (€)</label>
          <input
            type="text"
            inputMode="decimal"
            className="input mono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>
      </div>
      <div className="form-row mb-12">
        <div className="field">
          <label>Categorie</label>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Kies categorie —</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Wie</label>
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Geen —</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field mb-12">
        <label>Omschrijving</label>
        <input
          type="text"
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bijv. Albert Heijn boodschappen"
        />
      </div>
      <div className="modal-actions">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Annuleren</button>}
        <button type="submit" className="btn primary">{submitLabel}</button>
      </div>
    </form>
  );
}
