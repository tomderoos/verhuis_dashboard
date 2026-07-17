import React, { useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import Modal from '../components/Modal.jsx';

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#64748b',
];

export default function Instellingen() {
  const { state, actions } = useStore();
  const fileInputRef = useRef(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [editingCat, setEditingCat] = useState(null);

  const exportData = () => {
    const json = actions.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huis-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file) => {
    try {
      const text = await file.text();
      if (!confirm('Weet je zeker dat je de huidige data wilt vervangen door deze backup?')) return;
      actions.importJson(text);
      alert('Backup geïmporteerd.');
    } catch (err) {
      alert('Kon backup niet lezen: ' + err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Instellingen</h1>
          <p className="page-subtitle">Gebruikers, categorieën en backup</p>
        </div>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Gebruikers</h3>
            <p className="card-subtitle">Wie hoort er bij dit huishouden</p>
          </div>
          <button className="btn primary small" onClick={() => actions.addUser('Nieuwe gebruiker', pickColor(state.users.length))}>+ Toevoegen</button>
        </div>
        <div className="grid gap-12">
          {state.users.map((u) => (
            <UserRow key={u.id} user={u} onUpdate={(patch) => actions.updateUser(u.id, patch)} onRemove={() => {
              if (confirm(`Gebruiker "${u.name}" verwijderen? Transacties blijven bestaan maar worden losgekoppeld.`)) {
                actions.removeUser(u.id);
              }
            }} />
          ))}
        </div>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Categorieën</h3>
            <p className="card-subtitle">{state.categories.length} categorieën</p>
          </div>
          <button className="btn primary small" onClick={() => setShowAddCat(true)}>+ Toevoegen</button>
        </div>
        <div className="grid cols-2">
          {['expense', 'income'].map((type) => (
            <div key={type}>
              <h4 className="text-muted" style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {type === 'expense' ? 'Uitgaven' : 'Inkomsten'}
              </h4>
              <div className="grid gap-8">
                {state.categories.filter((c) => c.type === type).map((c) => (
                  <div key={c.id} className="between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <span className="row gap-8">
                      <span style={{ fontSize: 20 }}>{c.icon}</span>
                      <span className="color-swatch" style={{ background: c.color }} />
                      <span>{c.name}</span>
                    </span>
                    <div className="row gap-4">
                      <button className="btn ghost icon small" onClick={() => setEditingCat(c)}>✎</button>
                      <button className="btn ghost icon small" onClick={() => {
                        if (confirm(`Categorie "${c.name}" verwijderen? Bestaande transacties raken hun categorie kwijt.`)) {
                          actions.removeCategory(c.id);
                        }
                      }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Weergave</h3>
          </div>
        </div>
        <div className="tabs">
          {[
            { id: 'auto', label: 'Automatisch' },
            { id: 'light', label: 'Licht' },
            { id: 'dark', label: 'Donker' },
          ].map((t) => (
            <button key={t.id} className={`tab ${state.settings.theme === t.id ? 'active' : ''}`} onClick={() => actions.setTheme(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-16">
        <div className="between mb-16">
          <div>
            <h3 className="card-title">Backup</h3>
            <p className="card-subtitle">Exporteer of importeer al je data als JSON-bestand</p>
          </div>
        </div>
        <div className="row wrap gap-8">
          <button className="btn" onClick={exportData}>⬇︎ Exporteer backup</button>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>⬆︎ Importeer backup</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <div className="between mb-12">
          <div>
            <h3 className="card-title" style={{ color: 'var(--danger)' }}>Gevarenzone</h3>
            <p className="card-subtitle">Onomkeerbare acties</p>
          </div>
        </div>
        <div className="row wrap gap-8">
          <button className="btn" onClick={() => {
            if (confirm('Alle transacties verwijderen? Categorieën en budgetten blijven staan.')) {
              actions.clearTransactions();
            }
          }}>Wis alle transacties</button>
          <button className="btn danger" onClick={() => {
            if (confirm('ALLES resetten? Gebruikers, categorieën, budgetten en transacties worden verwijderd.')) {
              actions.resetAll();
            }
          }}>Reset alles</button>
        </div>
      </div>

      {showAddCat && (
        <CategoryModal
          onClose={() => setShowAddCat(false)}
          onSave={(data) => { actions.addCategory(data); setShowAddCat(false); }}
        />
      )}

      {editingCat && (
        <CategoryModal
          initial={editingCat}
          onClose={() => setEditingCat(null)}
          onSave={(data) => { actions.updateCategory(editingCat.id, data); setEditingCat(null); }}
        />
      )}
    </>
  );
}

function pickColor(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function UserRow({ user, onUpdate, onRemove }) {
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color);
  return (
    <div className="row wrap gap-12" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <input
        className="input grow"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== user.name && onUpdate({ name: name.trim() })}
      />
      <input
        type="color"
        value={color}
        onChange={(e) => { setColor(e.target.value); onUpdate({ color: e.target.value }); }}
        style={{ width: 44, height: 40, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'transparent' }}
      />
      <button className="btn ghost" onClick={onRemove}>Verwijder</button>
    </div>
  );
}

function CategoryModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'expense');
  const [icon, setIcon] = useState(initial?.icon || '📌');
  const [color, setColor] = useState(initial?.color || '#6366f1');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), type, icon: icon.trim() || '📌', color });
  };

  return (
    <Modal title={initial ? 'Categorie bewerken' : 'Nieuwe categorie'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="tabs mb-12">
          <button type="button" className={`tab ${type === 'expense' ? 'active' : ''}`} onClick={() => setType('expense')}>Uitgave</button>
          <button type="button" className={`tab ${type === 'income' ? 'active' : ''}`} onClick={() => setType('income')}>Inkomst</button>
        </div>
        <div className="form-row mb-12">
          <div className="field">
            <label>Naam</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="field">
            <label>Emoji</label>
            <input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} style={{ fontSize: 20 }} />
          </div>
        </div>
        <div className="field mb-12">
          <label>Kleur</label>
          <div className="row wrap gap-8">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: color === c ? '2px solid var(--text)' : '1px solid var(--border)',
                  background: c,
                  cursor: 'pointer',
                }}
                title={c}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 32, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'transparent' }} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Annuleren</button>
          <button type="submit" className="btn primary">{initial ? 'Opslaan' : 'Toevoegen'}</button>
        </div>
      </form>
    </Modal>
  );
}
