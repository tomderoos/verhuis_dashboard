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
  const [feedForm, setFeedForm] = useState({ name: '', url: '' });
  const [feedsOpen, setFeedsOpen] = useState(false);

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
    for (const e of state.icsEvents || []) {
      push(e.date, { kind: 'ics', ref: e });
    }
    return map;
  }, [state.todos, state.events, state.icsEvents]);

  const unplannedTodos = useMemo(
    () => state.todos.filter((t) => !t.done && !t.plannedDate).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [state.todos]
  );

  const daySelectedItems = useMemo(() => {
    const items = (itemsByDay.get(selectedDay) || []).slice();
    const sortKey = (it) => {
      if (it.kind === 'ics') return it.ref.timeLabel || '00:00';
      // Non-timed items after timed ICS entries so a day's shifts read like a schedule.
      return '99:99';
    };
    return items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }, [itemsByDay, selectedDay]);

  const feeds = state.calendarFeeds || [];

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
                      if (it.kind === 'ics') {
                        const title = `${it.ref.summary}${it.ref.timeLabel ? ` (${it.ref.timeLabel})` : ''}`;
                        return <span key={i} className="agenda-ics-marker" title={title} />;
                      }
                      let color;
                      let title;
                      if (it.kind === 'todo') {
                        color = it.ref.done ? 'var(--success)' : 'var(--accent)';
                        title = it.ref.text;
                      } else {
                        color = (EVENT_META[it.ref.type] || EVENT_META.overig).color;
                        title = it.ref.title;
                      }
                      return (
                        <span
                          key={i}
                          className={`agenda-dot ${it.kind === 'todo' && it.ref.done ? 'is-done' : ''}`}
                          style={{ background: color }}
                          title={title}
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

        <div className={`agenda-feeds ${feedsOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="agenda-feeds-toggle"
            onClick={() => setFeedsOpen((v) => !v)}
            aria-expanded={feedsOpen}
          >
            <span>Externe agenda's (.ics)</span>
            <span className="dim">
              {feeds.length === 0
                ? 'geen'
                : `${feeds.length} gekoppeld${state.icsEvents?.length ? ` · ${state.icsEvents.length} afspraken` : ''}`}
            </span>
            <span aria-hidden>{feedsOpen ? '▾' : '▸'}</span>
          </button>
          {feedsOpen && (
            <div className="agenda-feeds-body">
              {state.icsError && <div className="callout error-callout small">Feed-fout: {state.icsError}</div>}
              {feeds.length > 0 && (
                <ul className="agenda-feeds-list">
                  {feeds.map((f) => (
                    <li key={f.id}>
                      <span className="agenda-feeds-dot" style={{ background: f.color || 'var(--accent)' }} />
                      <span className="agenda-feeds-name">{f.name || f.url}</span>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="dim agenda-feeds-url"
                        title={f.url}
                      >
                        bron
                      </a>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        title="Verwijder deze feed"
                        onClick={() => actions.removeCalendarFeed(f.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="agenda-feeds-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!feedForm.url.trim()) return;
                  actions.addCalendarFeed({ name: feedForm.name.trim(), url: feedForm.url.trim() });
                  setFeedForm({ name: '', url: '' });
                }}
              >
                <input
                  className="input"
                  placeholder="Naam (optioneel)"
                  value={feedForm.name}
                  onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
                />
                <input
                  className="input"
                  type="url"
                  placeholder="https://…/calendar.ics"
                  value={feedForm.url}
                  onChange={(e) => setFeedForm({ ...feedForm, url: e.target.value })}
                  required
                />
                <button type="submit" className="btn small">Toevoegen</button>
              </form>
            </div>
          )}
        </div>
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
  if (item.kind === 'ics') {
    const e = item.ref;
    const timeText = e.timeLabel
      ? e.endTimeLabel
        ? `${e.timeLabel}–${e.endTimeLabel}`
        : e.timeLabel
      : e.allDay ? 'Hele dag' : '';
    const subParts = [timeText, e.location].filter(Boolean);
    return (
      <div className="agenda-item is-ics">
        <div
          className="agenda-item-icon"
          style={{ background: e.color || 'var(--accent)' }}
          aria-hidden
        >
          📅
        </div>
        <div className="agenda-item-body">
          <div className="agenda-item-text">{e.summary || '(zonder titel)'}</div>
          {subParts.length > 0 && <div className="agenda-item-sub">{subParts.join(' · ')}</div>}
        </div>
        <span className="agenda-item-tag dim" title={e.feedName}>{e.feedName || 'Externe agenda'}</span>
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
