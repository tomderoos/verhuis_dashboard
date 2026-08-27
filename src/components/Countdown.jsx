import React, { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';

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

const VARIANT_CLASS = {
  keyDate: 'variant-primary',
  moveDate: 'variant-warm',
  kloversdonkKeyDate: 'variant-cool',
};

export default function Countdown({ stateKey, eyebrow }) {
  const { state, actions } = useStore();
  const value = state[stateKey];
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ? value.slice(0, 16) : '');

  useEffect(() => {
    if (!value) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [value]);

  useEffect(() => {
    setDraft(value ? value.slice(0, 16) : '');
  }, [value]);

  const save = () => {
    actions.setCountdown(stateKey, draft || null);
    setEditing(false);
  };

  const clearDate = () => {
    actions.setCountdown(stateKey, null);
    setDraft('');
    setEditing(false);
  };

  const target = value ? new Date(value) : null;
  const parts = target ? diffParts(target, now) : null;
  const variant = VARIANT_CLASS[stateKey] || 'variant-primary';

  return (
    <section className={`card countdown-card ${variant} ${value ? '' : 'is-empty'}`}>
      <div className="countdown-head">
        <div className="eyebrow">{eyebrow}</div>
        <button
          className="btn ghost tiny edit-btn"
          onClick={() => setEditing((v) => !v)}
          aria-label={editing ? 'Sluit bewerken' : 'Bewerk datum'}
          title={editing ? 'Sluit bewerken' : 'Bewerk datum'}
        >
          {editing ? '✕' : '✎'}
        </button>
      </div>

      {value ? (
        <div className="countdown-date">{NL_DATE.format(target)}</div>
      ) : (
        <div className="countdown-date muted">Nog niet gepland</div>
      )}

      {editing && (
        <div className="stack">
          <input
            type="datetime-local"
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary small" onClick={save}>Opslaan</button>
            {value && (
              <button className="btn ghost small" onClick={clearDate}>Verwijderen</button>
            )}
          </div>
        </div>
      )}

      {parts && parts.over && <div className="countdown-over">🎉 Het is zover!</div>}

      {parts && !parts.over && (
        <div className="countdown-grid" role="timer" aria-live="polite">
          <CountUnit value={parts.days} label="dagen" />
          <CountUnit value={parts.hours} label="uur" />
          <CountUnit value={parts.minutes} label="min" />
          <CountUnit value={parts.seconds} label="sec" />
        </div>
      )}

      {!parts && !editing && (
        <button className="btn primary set-btn" onClick={() => setEditing(true)}>
          Datum instellen
        </button>
      )}
    </section>
  );
}

function CountUnit({ value, label }) {
  return (
    <div className="count-unit">
      <div className="count-value">{String(value).padStart(2, '0')}</div>
      <div className="count-label">{label}</div>
    </div>
  );
}
