import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';

const TYPES = [
  { id: 'bezichtiging', label: 'Bezichtiging', icon: '👀', color: 'var(--accent)' },
  { id: 'klus', label: 'Klus', icon: '🔧', color: 'var(--warning)' },
  { id: 'mijlpaal', label: 'Mijlpaal', icon: '🏁', color: 'var(--success)' },
  { id: 'overig', label: 'Overig', icon: '📌', color: 'var(--text-muted)' },
];

const NL_FULL = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function typeMeta(id) {
  return TYPES.find((t) => t.id === id) || TYPES[3];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Timeline() {
  const { state, actions } = useStore();
  const [form, setForm] = useState({
    date: todayIso(),
    title: '',
    type: 'klus',
    notes: '',
  });
  const [filter, setFilter] = useState('all');

  const sorted = useMemo(() => {
    return [...state.events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [state.events]);

  const visible = filter === 'all' ? sorted : sorted.filter((e) => e.type === filter);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    actions.addEvent({ ...form, title: form.title.trim() });
    setForm({ date: todayIso(), title: '', type: form.type, notes: '' });
  };

  const grouped = useMemo(() => groupByMonth(visible), [visible]);
  const today = todayIso();

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Timeline — klussen &amp; bezichtigingen</h2>
          <div className="card-sub">{state.events.length} gepland</div>
        </div>
        <div className="chip-row">
          <button
            className={`chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alles
          </button>
          {TYPES.map((t) => (
            <button
              key={t.id}
              className={`chip ${filter === t.id ? 'active' : ''}`}
              onClick={() => setFilter(t.id)}
            >
              <span aria-hidden>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      <form className="event-form" onSubmit={submit}>
        <input
          type="date"
          className="input"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Wat gaat er gebeuren?"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <select
          className="input"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <button className="btn primary" type="submit">
          Plan in
        </button>
      </form>

      <div className="timeline">
        {grouped.length === 0 && (
          <div className="empty">Geen geplande punten in deze filter.</div>
        )}
        {grouped.map(([month, items]) => (
          <div key={month} className="timeline-month">
            <div className="timeline-month-head">{month}</div>
            {items.map((event) => (
              <EventRow key={event.id} event={event} today={today} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function EventRow({ event, today }) {
  const { actions } = useStore();
  const meta = typeMeta(event.type);
  const isPast = event.date < today;
  const isToday = event.date === today;
  const [open, setOpen] = useState(false);

  return (
    <div className={`event ${isPast ? 'is-past' : ''} ${isToday ? 'is-today' : ''}`}>
      <div className="event-dot" style={{ background: meta.color }} aria-hidden>
        {meta.icon}
      </div>
      <div className="event-body">
        <div className="event-head">
          <div>
            <div className="event-date">
              {NL_FULL.format(new Date(event.date + 'T00:00'))}
              {isToday && <span className="pill accent">vandaag</span>}
            </div>
            <input
              className="event-title"
              value={event.title}
              onChange={(e) => actions.updateEvent(event.id, { title: e.target.value })}
            />
          </div>
          <div className="event-actions">
            <select
              className="input small"
              value={event.type}
              onChange={(e) => actions.updateEvent(event.id, { type: e.target.value })}
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input small"
              value={event.date}
              onChange={(e) => actions.updateEvent(event.id, { date: e.target.value })}
            />
            <button className="btn tiny ghost" onClick={() => setOpen((v) => !v)}>
              {event.notes ? '📝' : '＋'}
            </button>
            <button
              className="btn tiny ghost"
              onClick={() => actions.removeEvent(event.id)}
              title="Verwijderen"
            >
              ✕
            </button>
          </div>
        </div>
        {open && (
          <textarea
            className="textarea"
            placeholder="Notities (aannemer, aanbieding, tijden…)"
            value={event.notes}
            onChange={(e) => actions.updateEvent(event.id, { notes: e.target.value })}
            rows={2}
          />
        )}
        {!open && event.notes && (
          <div className="event-notes" onClick={() => setOpen(true)}>
            {event.notes}
          </div>
        )}
      </div>
    </div>
  );
}

const NL_MONTH = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });

function groupByMonth(events) {
  const groups = new Map();
  for (const e of events) {
    const d = new Date(e.date + 'T00:00');
    const key = NL_MONTH.format(d);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return Array.from(groups.entries());
}
