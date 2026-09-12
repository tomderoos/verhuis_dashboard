import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';

const MONTH_LONG = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });
const DAY_LONG = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const DOW = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const EVENT_META = {
  bezichtiging: { icon: '👀', color: 'var(--accent)' },
  klus: { icon: '🔧', color: 'var(--warning)' },
  mijlpaal: { icon: '🏁', color: 'var(--success)' },
  overig: { icon: '📌', color: 'var(--text-muted)' },
};

function pad2(n) {
  return String(n).padStart(2, '0');
}
function isoDay(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseIso(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayIso() {
  return isoDay(new Date());
}
function currentIsoMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthGridDays(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const dow = (first.getDay() + 6) % 7; // Mon = 0
  const start = new Date(y, m - 1, 1 - dow);
  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Agenda() {
  const { state, actions } = useStore();
  const [monthKey, setMonthKey] = useState(currentIsoMonth);
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [assignForm, setAssignForm] = useState({ todoId: '', date: todayIso() });

  useEffect(() => {
    setAssignForm((f) => ({ ...f, date: selectedDay }));
  }, [selectedDay]);

  const days = useMemo(() => monthGridDays(monthKey), [monthKey]);

  const itemsByDay = useMemo(() => {
    const map = new Map();
    const push = (dayIso, item) => {
      if (!map.has(dayIso)) map.set(dayIso, []);
      map.get(dayIso).push(item);
    };
    for (const t of state.todos) {
      if (t.plannedDate) push(t.plannedDate, { kind: 'todo', ref: t });
    }
    for (const e of state.events) {
      push(e.date, { kind: 'event', ref: e });
    }
    return map;
  }, [state.todos, state.events]);

  const unplannedTodos = useMemo(
    () => state.todos.filter((t) => !t.done && !t.plannedDate).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [state.todos]
  );

  const daySelectedItems = itemsByDay.get(selectedDay) || [];

  const shiftMonth = (delta) => {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    setMonthKey(next);
    if (!selectedDay.startsWith(next)) setSelectedDay(`${next}-01`);
  };

  const monthLabel = capitalize(MONTH_LONG.format(parseIso(`${monthKey}-01`)));
  const dayLabel = capitalize(DAY_LONG.format(parseIso(selectedDay)));

  return (
    <section className="card agenda-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Agenda — plan je klussen</h2>
          <div className="card-sub">Koppel to-do's aan een dag en zie alles op één plek.</div>
        </div>
        <div className="agenda-nav">
          <button className="btn ghost small" onClick={() => shiftMonth(-1)} aria-label="Vorige maand">‹</button>
          <div className="agenda-month-label">{monthLabel}</div>
          <button className="btn ghost small" onClick={() => shiftMonth(1)} aria-label="Volgende maand">›</button>
          <button className="btn small" onClick={() => { setMonthKey(currentIsoMonth()); setSelectedDay(todayIso()); }}>Vandaag</button>
        </div>
      </div>

      <div className="agenda-grid">
        <div className="agenda-dow-row">
          {DOW.map((d) => <div key={d} className="agenda-dow">{d}</div>)}
        </div>
        <div className="agenda-days">
          {days.map((d) => {
            const dayIso = isoDay(d);
            const items = itemsByDay.get(dayIso) || [];
            const inMonth = dayIso.slice(0, 7) === monthKey;
            const isToday = dayIso === todayIso();
            const isSelected = dayIso === selectedDay;
            return (
              <button
                key={dayIso}
                className={`agenda-day ${inMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelectedDay(dayIso)}
              >
                <span className="agenda-day-num">{d.getDate()}</span>
                {items.length > 0 && (
                  <div className="agenda-day-items">
                    {items.slice(0, 4).map((it, i) => {
                      const color = it.kind === 'todo'
                        ? (it.ref.done ? 'var(--success)' : 'var(--accent)')
                        : (EVENT_META[it.ref.type] || EVENT_META.overig).color;
                      return (
                        <span
                          key={i}
                          className={`agenda-dot ${it.kind === 'todo' && it.ref.done ? 'is-done' : ''}`}
                          style={{ background: color }}
                          title={it.kind === 'todo' ? it.ref.text : it.ref.title}
                        />
                      );
                    })}
                    {items.length > 4 && <span className="agenda-more">+{items.length - 4}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="agenda-detail">
        <div className="agenda-detail-head">
          <div>
            <div className="eyebrow">Geselecteerde dag</div>
            <h3 className="agenda-day-title">{dayLabel}</h3>
          </div>
        </div>

        <div className="agenda-detail-list">
          {daySelectedItems.length === 0 && (
            <div className="empty">Geen items op deze dag — plan er hieronder een to-do bij.</div>
          )}
          {daySelectedItems.map((it, i) => (
            <AgendaItem key={i} item={it} actions={actions} />
          ))}
        </div>

        {unplannedTodos.length > 0 && (
          <form
            className="agenda-assign"
            onSubmit={(e) => {
              e.preventDefault();
              if (!assignForm.todoId) return;
              const date = assignForm.date || selectedDay;
              actions.updateTodo(assignForm.todoId, { plannedDate: date });
              setSelectedDay(date);
              setAssignForm({ todoId: '', date });
            }}
          >
            <select
              className="input"
              value={assignForm.todoId}
              onChange={(e) => setAssignForm({ ...assignForm, todoId: e.target.value })}
            >
              <option value="">Kies een to-do om te plannen…</option>
              {unplannedTodos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.text}{t.room ? ` · ${t.room}` : ''}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input"
              value={assignForm.date}
              onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })}
            />
            <button type="submit" className="btn primary">Plannen</button>
          </form>
        )}
      </div>
    </section>
  );
}

function AgendaItem({ item, actions }) {
  if (item.kind === 'todo') {
    const t = item.ref;
    return (
      <div className={`agenda-item is-todo ${t.done ? 'is-done' : ''}`}>
        <input
          type="checkbox"
          className="agenda-item-check"
          checked={t.done}
          onChange={() => actions.toggleTodo(t.id)}
        />
        <div className="agenda-item-body">
          <div className="agenda-item-text">{t.text}</div>
          {t.room && <div className="agenda-item-sub">{t.room}</div>}
        </div>
        <input
          type="date"
          className="input tiny"
          value={t.plannedDate || ''}
          onChange={(e) => actions.updateTodo(t.id, { plannedDate: e.target.value || null })}
        />
        <button
          className="btn tiny ghost"
          title="Loskoppelen van datum"
          onClick={() => actions.updateTodo(t.id, { plannedDate: null })}
        >
          ✕
        </button>
      </div>
    );
  }
  const e = item.ref;
  const meta = EVENT_META[e.type] || EVENT_META.overig;
  return (
    <div className="agenda-item is-event">
      <div className="agenda-item-icon" style={{ background: meta.color }} aria-hidden>{meta.icon}</div>
      <div className="agenda-item-body">
        <div className="agenda-item-text">{e.title}</div>
        {e.notes && <div className="agenda-item-sub">{e.notes}</div>}
      </div>
      <span className="agenda-item-tag dim">Timeline</span>
    </div>
  );
}
