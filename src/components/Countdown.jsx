import React, { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import Plate from './Plate.jsx';

function diffParts(target, now) {
  const totalMs = target - now;
  if (totalMs <= 0) return { over: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  const seconds = Math.floor(totalMs / 1000);
  return {
    over: false,
    totalMs,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

const NL_DATE = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const NL_DATE_SHORT = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const NL_TIME = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });

const pad = (n) => String(n).padStart(2, '0');

function useNow(active) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function useDateEditor(stateKey, value) {
  const { actions } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ? value.slice(0, 16) : '');
  useEffect(() => {
    setDraft(value ? value.slice(0, 16) : '');
  }, [value]);
  return {
    editing,
    draft,
    setDraft,
    toggle: () => setEditing((v) => !v),
    open: () => setEditing(true),
    save: () => {
      actions.setCountdown(stateKey, draft || null);
      setEditing(false);
    },
    clear: () => {
      actions.setCountdown(stateKey, null);
      setDraft('');
      setEditing(false);
    },
  };
}

function Label({ label, plate }) {
  return (
    <span className="milestone-label">
      {label}
      {plate && <> <Plate>{plate}</Plate></>}
    </span>
  );
}

function Editor({ ed, hasValue }) {
  return (
    <div className="milestone-editor">
      <input
        type="datetime-local"
        className="input"
        value={ed.draft}
        onChange={(e) => ed.setDraft(e.target.value)}
      />
      <button className="btn primary small" onClick={ed.save}>Opslaan</button>
      {hasValue && (
        <button className="btn ghost small" onClick={ed.clear}>Verwijderen</button>
      )}
    </div>
  );
}

function EditButton({ ed }) {
  return (
    <button
      className="btn ghost tiny icon-btn"
      onClick={ed.toggle}
      aria-label={ed.editing ? 'Sluit bewerken' : 'Bewerk datum'}
      title={ed.editing ? 'Sluit bewerken' : 'Bewerk datum'}
    >
      {ed.editing ? <X size={16} strokeWidth={1.5} /> : <Pencil size={16} strokeWidth={1.5} />}
    </button>
  );
}

// De eerstvolgende mijlpaal: groot, met een lopende klok.
export function LeadCountdown({ stateKey, label, plate }) {
  const { state } = useStore();
  const value = state[stateKey];
  const target = new Date(value);
  const now = useNow(true);
  const parts = diffParts(target, now);
  const ed = useDateEditor(stateKey, value);

  return (
    <section className="card milestone-lead">
      <div className="milestone-head">
        <div>
          <div className="milestone-kicker">Eerstvolgende</div>
          <Label label={label} plate={plate} />
        </div>
        <EditButton ed={ed} />
      </div>

      {ed.editing && <Editor ed={ed} hasValue />}

      <div className="milestone-figure" role="timer" aria-live="off">
        <span className="milestone-days">{parts.days}</span>
        <span className="milestone-days-unit">{parts.days === 1 ? 'dag' : 'dagen'}</span>
        <span className="milestone-clock">
          {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
        </span>
      </div>

      <div className="milestone-date">
        {NL_DATE.format(target)} om {NL_TIME.format(target)}
      </div>
    </section>
  );
}

// De overige mijlpalen: compacte rijen.
export function CountdownRow({ stateKey, label, plate }) {
  const { state } = useStore();
  const value = state[stateKey];
  const target = value ? new Date(value) : null;
  const now = useNow(false);
  const ed = useDateEditor(stateKey, value);
  const days = target ? Math.ceil((target - now) / 86400000) : null;

  return (
    <li className="milestone-row">
      <div className="milestone-row-main">
        <Label label={label} plate={plate} />
        <span className="milestone-row-date">
          {target ? NL_DATE_SHORT.format(target) : 'Nog niet gepland'}
        </span>
      </div>
      <div className="milestone-row-side">
        {target && (
          <span className="milestone-row-days">
            {days > 0 ? `nog ${days} ${days === 1 ? 'dag' : 'dagen'}` : 'geweest'}
          </span>
        )}
        {target || ed.editing ? (
          <EditButton ed={ed} />
        ) : (
          <button className="btn ghost small" onClick={ed.open}>Datum instellen</button>
        )}
      </div>
      {ed.editing && <Editor ed={ed} hasValue={!!value} />}
    </li>
  );
}
