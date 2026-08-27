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

export default function Countdown() {
  const { state, actions } = useStore();
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState(false);

  const target = new Date(state.keyDate);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = diffParts(target, now);

  return (
    <section className="card countdown">
      <div className="countdown-head">
        <div>
          <div className="eyebrow">Sleuteloverdracht nieuwe huis</div>
          <h2 className="countdown-date">{NL_DATE.format(target)}</h2>
        </div>
        <button className="btn ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Klaar' : 'Datum wijzigen'}
        </button>
      </div>

      {editing && (
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="datetime-local"
            className="input"
            value={state.keyDate.slice(0, 16)}
            onChange={(e) => actions.setKeyDate(e.target.value)}
          />
        </div>
      )}

      {parts.over ? (
        <div className="countdown-over">🎉 De sleutels zijn van jullie!</div>
      ) : (
        <div className="countdown-grid" role="timer" aria-live="polite">
          <CountUnit value={parts.days} label="dagen" />
          <CountUnit value={parts.hours} label="uur" />
          <CountUnit value={parts.minutes} label="min" />
          <CountUnit value={parts.seconds} label="sec" />
        </div>
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
