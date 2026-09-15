import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { useStore } from '../store.jsx';

function burstConfetti(origin) {
  const defaults = {
    origin: origin || { x: 0.5, y: 0.6 },
    scalar: 1,
    ticks: 200,
    disableForReducedMotion: true,
  };
  confetti({
    ...defaults,
    particleCount: 80,
    spread: 90,
    startVelocity: 45,
  });
  setTimeout(
    () =>
      confetti({
        ...defaults,
        particleCount: 60,
        spread: 120,
        startVelocity: 35,
      }),
    120
  );
  setTimeout(
    () =>
      confetti({
        ...defaults,
        particleCount: 40,
        spread: 160,
        startVelocity: 25,
        gravity: 0.7,
      }),
    260
  );
}
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SIZES = [
  { id: 'klein', label: 'Klein', icon: '🔹', color: '#0ea5e9' },
  { id: 'groot', label: 'Groot', icon: '🔶', color: '#f97316' },
];

function sizeMeta(id) {
  return SIZES.find((s) => s.id === id) || null;
}

const PERSON_SUGGESTIONS = ['Tom', 'Rinske', 'Samen', 'Lotte', 'Anne'];

const PERSON_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#f43f5e'];
function personColor(name) {
  if (!name) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}

const ROOM_SUGGESTIONS = [
  'Woonkamer',
  'Keuken',
  'Slaapkamer',
  'Kinderkamer',
  'Badkamer',
  'Toilet',
  'Hal / gang',
  'Zolder',
  'Kelder',
  'Tuin',
  'Schuur',
  'Buiten',
];

export default function TodoList() {
  const { state, actions } = useStore();
  const [text, setText] = useState('');
  const [room, setRoom] = useState('');
  const [filter, setFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [photosExpandedId, setPhotosExpandedId] = useState(null);

  const roomList = useMemo(() => {
    const set = new Set();
    let hasEmpty = false;
    for (const t of state.todos) {
      if (t.done) continue;
      if (t.room) set.add(t.room);
      else hasEmpty = true;
    }
    return { rooms: [...set].sort((a, b) => a.localeCompare(b, 'nl')), hasEmpty };
  }, [state.todos]);

  const progress = useMemo(() => {
    const byRoom = new Map();
    for (const t of state.todos) {
      const key = t.room || '__empty__';
      const bucket = byRoom.get(key) || { room: t.room || '', done: 0, total: 0 };
      bucket.total += 1;
      if (t.done) bucket.done += 1;
      byRoom.set(key, bucket);
    }
    const rows = [...byRoom.values()].sort((a, b) => {
      if (!a.room && b.room) return 1;
      if (a.room && !b.room) return -1;
      return a.room.localeCompare(b.room, 'nl');
    });
    return rows;
  }, [state.todos]);

  const matchesRoom = (t) => {
    if (filter === 'all') return true;
    if (filter === '__empty__') return !t.room;
    return t.room === filter;
  };
  const matchesSize = (t) => {
    if (sizeFilter === 'all') return true;
    if (sizeFilter === '__empty__') return !t.size;
    return t.size === sizeFilter;
  };
  const matchesPerson = (t) => {
    if (personFilter === 'all') return true;
    if (personFilter === '__empty__') return !t.assignee;
    return t.assignee === personFilter;
  };
  const matchesFilter = (t) => matchesRoom(t) && matchesSize(t) && matchesPerson(t);

  const personList = useMemo(() => {
    const set = new Set();
    let hasEmpty = false;
    for (const t of state.todos) {
      if (t.done) continue;
      if (t.assignee) set.add(t.assignee);
      else hasEmpty = true;
    }
    return { persons: [...set].sort((a, b) => a.localeCompare(b, 'nl')), hasEmpty };
  }, [state.todos]);

  const sizeCounts = useMemo(() => {
    const counts = { klein: 0, groot: 0, __empty__: 0 };
    for (const t of state.todos) {
      if (t.done) continue;
      if (t.size === 'klein' || t.size === 'groot') counts[t.size] += 1;
      else counts.__empty__ += 1;
    }
    return counts;
  }, [state.todos]);

  const { open, done } = useMemo(() => {
    const sortByOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const openList = state.todos.filter((t) => !t.done).filter(matchesFilter).slice().sort(sortByOrder);
    const doneList = state.todos.filter((t) => t.done).filter(matchesFilter).slice().sort(sortByOrder);
    return { open: openList, done: doneList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.todos, filter, sizeFilter, personFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    actions.addTodo(value, { room });
    setText('');
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = open.findIndex((t) => t.id === active.id);
    const newIndex = open.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(open, oldIndex, newIndex);
    const before = reordered[newIndex - 1];
    const after = reordered[newIndex + 1];

    let newSort;
    if (!before) newSort = (after?.sortOrder ?? 0) - 1000;
    else if (!after) newSort = (before.sortOrder ?? 0) + 1000;
    else newSort = ((before.sortOrder ?? 0) + (after.sortOrder ?? 0)) / 2;

    actions.moveTodo(active.id, newSort);
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">To do — huidige huis</h2>
          <div className="card-sub">
            {open.length} open · {done.length} klaar · sleep om te ordenen
          </div>
        </div>
        {done.length > 0 && (
          <button className="btn ghost small" onClick={actions.clearCompletedTodos}>
            Klaar verwijderen
          </button>
        )}
      </div>

      <form className="todo-form" onSubmit={submit}>
        <input
          className="input"
          placeholder="Nieuwe taak…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          className="input todo-room-input"
          list="room-suggestions"
          placeholder="Ruimte (optioneel)"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
        <datalist id="room-suggestions">
          {ROOM_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <datalist id="person-suggestions">
          {PERSON_SUGGESTIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <button className="btn primary" type="submit">
          Toevoegen
        </button>
      </form>

      {progress.length > 1 && (
        <div className="room-progress">
          {progress.map((r) => {
            const key = r.room || '__empty__';
            const pct = r.total === 0 ? 0 : Math.round((r.done / r.total) * 100);
            const active = filter === key;
            const complete = r.done === r.total;
            return (
              <button
                key={key}
                className={`room-progress-row ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
                onClick={() => setFilter(active ? 'all' : key)}
                title={active ? 'Filter opheffen' : `Filter op ${r.room || 'zonder ruimte'}`}
              >
                <span className="room-progress-label">
                  {r.room || 'Zonder ruimte'}
                </span>
                <span className="room-progress-bar-wrap">
                  <span className="room-progress-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="room-progress-count">
                  {r.done}/{r.total}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(roomList.rooms.length > 0 || roomList.hasEmpty) && (
        <div className="chip-row">
          <button
            className={`chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alles
          </button>
          {roomList.rooms.map((r) => (
            <button
              key={r}
              className={`chip ${filter === r ? 'active' : ''}`}
              onClick={() => setFilter(r)}
            >
              {r}
            </button>
          ))}
          {roomList.hasEmpty && (
            <button
              className={`chip ${filter === '__empty__' ? 'active' : ''}`}
              onClick={() => setFilter('__empty__')}
            >
              Zonder ruimte
            </button>
          )}
        </div>
      )}

      {(personList.persons.length > 0 || personList.hasEmpty) && (
        <div className="chip-row">
          <span className="chip-row-label">Wie:</span>
          <button
            className={`chip ${personFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPersonFilter('all')}
          >
            Alles
          </button>
          {personList.persons.map((p) => (
            <button
              key={p}
              className={`chip ${personFilter === p ? 'active' : ''}`}
              onClick={() => setPersonFilter(p)}
              style={personFilter === p ? undefined : { borderColor: personColor(p), color: personColor(p) }}
            >
              {p}
            </button>
          ))}
          {personList.hasEmpty && (
            <button
              className={`chip ${personFilter === '__empty__' ? 'active' : ''}`}
              onClick={() => setPersonFilter('__empty__')}
            >
              Onbepaald
            </button>
          )}
        </div>
      )}

      {(sizeCounts.klein > 0 || sizeCounts.groot > 0 || sizeCounts.__empty__ > 0) && (
        <div className="chip-row">
          <span className="chip-row-label">Klus:</span>
          <button
            className={`chip ${sizeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSizeFilter('all')}
          >
            Alles
          </button>
          {SIZES.filter((s) => sizeCounts[s.id] > 0).map((s) => (
            <button
              key={s.id}
              className={`chip ${sizeFilter === s.id ? 'active' : ''}`}
              onClick={() => setSizeFilter(s.id)}
            >
              <span aria-hidden>{s.icon}</span> {s.label} ({sizeCounts[s.id]})
            </button>
          ))}
          {sizeCounts.__empty__ > 0 && (
            <button
              className={`chip ${sizeFilter === '__empty__' ? 'active' : ''}`}
              onClick={() => setSizeFilter('__empty__')}
            >
              Onbepaald ({sizeCounts.__empty__})
            </button>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={open.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="todo-list">
            {open.map((todo) => (
              <SortableTodoItem
                key={todo.id}
                todo={todo}
                expanded={expandedId === todo.id}
                onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                photosExpanded={photosExpandedId === todo.id}
                onExpandPhotos={() => setPhotosExpandedId(photosExpandedId === todo.id ? null : todo.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {done.length > 0 && (
        <ul className="todo-list todo-done-list">
          {done.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              expanded={expandedId === todo.id}
              onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
              photosExpanded={photosExpandedId === todo.id}
              onExpandPhotos={() => setPhotosExpandedId(photosExpandedId === todo.id ? null : todo.id)}
            />
          ))}
        </ul>
      )}

      {state.todos.length === 0 && (
        <div className="empty">Nog geen taken — voeg je eerste taak toe.</div>
      )}
    </section>
  );
}

function SortableTodoItem({ todo, expanded, onExpand, photosExpanded, onExpandPhotos }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <TodoItem
      todo={todo}
      expanded={expanded}
      onExpand={onExpand}
      photosExpanded={photosExpanded}
      onExpandPhotos={onExpandPhotos}
      dragHandleProps={{ ref: setNodeRef, style, listeners, attributes, isDragging }}
    />
  );
}

function TodoItem({ todo, expanded, onExpand, photosExpanded, onExpandPhotos, dragHandleProps }) {
  const { state, actions } = useStore();
  const photos = useMemo(
    () => (state.todoPhotos || []).filter((p) => p.todoId === todo.id),
    [state.todoPhotos, todo.id]
  );
  const hasPhoto = photos.length > 0;
  const rootProps = dragHandleProps
    ? { ref: dragHandleProps.ref, style: dragHandleProps.style }
    : {};

  return (
    <li className={`todo-item ${todo.done ? 'is-done' : ''}`} {...rootProps}>
      <div className="todo-row">
        {dragHandleProps && (
          <button
            type="button"
            className="drag-handle"
            aria-label="Sleep om te ordenen"
            {...dragHandleProps.listeners}
            {...dragHandleProps.attributes}
          >
            ⋮⋮
          </button>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={todo.done}
            onChange={(e) => {
              if (!todo.done) {
                const rect = e.currentTarget.getBoundingClientRect();
                burstConfetti({
                  x: (rect.left + rect.width / 2) / window.innerWidth,
                  y: (rect.top + rect.height / 2) / window.innerHeight,
                });
              }
              actions.toggleTodo(todo.id);
            }}
          />
          <span />
        </label>
        <input
          className="todo-text"
          value={todo.text}
          onChange={(e) => actions.updateTodo(todo.id, { text: e.target.value })}
        />
        {todo.room ? (
          <RoomTag
            room={todo.room}
            onChange={(next) => actions.updateTodo(todo.id, { room: next })}
          />
        ) : (
          <AddRoomButton onSet={(next) => actions.updateTodo(todo.id, { room: next })} />
        )}
        <PersonTag
          person={todo.assignee}
          onChange={(next) => actions.updateTodo(todo.id, { assignee: next })}
        />
        <SizeTag
          size={todo.size}
          onChange={(next) => actions.updateTodo(todo.id, { size: next })}
        />
        <DateTag
          date={todo.plannedDate}
          onChange={(next) => actions.updateTodo(todo.id, { plannedDate: next || null })}
        />
        <button
          className={`btn tiny ${todo.comment ? 'accent' : 'ghost'}`}
          onClick={onExpand}
          title="Opmerking"
        >
          {todo.comment ? '📝' : '＋'}
        </button>
        <button
          className={`btn tiny ${hasPhoto ? 'accent' : 'ghost'}`}
          onClick={onExpandPhotos}
          title="Voor- en na-foto's"
        >
          📷
        </button>
        <button
          className="btn tiny ghost"
          onClick={() => actions.removeTodo(todo.id)}
          title="Verwijderen"
        >
          ✕
        </button>
      </div>
      {expanded && (
        <textarea
          className="textarea"
          placeholder="Opmerkingen, links, meetgegevens…"
          value={todo.comment}
          onChange={(e) => actions.updateTodo(todo.id, { comment: e.target.value })}
          rows={3}
        />
      )}
      {!expanded && todo.comment && (
        <div className="todo-comment-preview" onClick={onExpand}>
          {todo.comment}
        </div>
      )}
      {photosExpanded && <PhotoPanel todoId={todo.id} photos={photos} />}
    </li>
  );
}

function PhotoPanel({ todoId, photos }) {
  const { state, actions } = useStore();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const byKind = { before: null, after: null };
  for (const p of photos) if (p.kind in byKind) byKind[p.kind] = p;

  const handleFile = async (kind, file) => {
    if (!file) return;
    setError(null);
    setBusy(kind);
    const res = await actions.uploadTodoPhoto(todoId, kind, file);
    if (res?.error) {
      setError(res.error.message || 'Uploaden mislukt');
    }
    setBusy(null);
  };

  return (
    <div className="todo-photos">
      {['before', 'after'].map((kind) => {
        const photo = byKind[kind];
        const url = photo ? state.todoPhotoUrls?.[photo.path] : null;
        const label = kind === 'before' ? 'Voor' : 'Na';
        const inputId = `photo-${todoId}-${kind}`;
        return (
          <div key={kind} className={`todo-photo-slot ${photo ? 'has-photo' : ''}`}>
            <div className="todo-photo-label">{label}</div>
            {photo ? (
              <div className="todo-photo-preview">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`${label}-foto`} loading="lazy" />
                  </a>
                ) : (
                  <div className="empty">Laden…</div>
                )}
                <div className="todo-photo-actions">
                  <label className="btn tiny ghost" htmlFor={inputId}>
                    Vervangen
                  </label>
                  <button
                    type="button"
                    className="btn tiny ghost"
                    onClick={() => actions.removeTodoPhoto(todoId, kind)}
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              <label className="todo-photo-drop" htmlFor={inputId}>
                {busy === kind ? 'Uploaden…' : '📎 Foto toevoegen'}
              </label>
            )}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleFile(kind, file);
              }}
            />
          </div>
        );
      })}
      {error && <div className="callout error-callout small">{error}</div>}
    </div>
  );
}

function RoomTag({ room, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(room);
  if (!editing) {
    return (
      <button
        type="button"
        className="room-tag"
        onClick={() => {
          setDraft(room);
          setEditing(true);
        }}
        title="Klik om aan te passen"
      >
        {room}
      </button>
    );
  }
  const commit = () => {
    onChange(draft.trim());
    setEditing(false);
  };
  return (
    <input
      className="input tiny room-edit"
      list="room-suggestions"
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function PersonTag({ person, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person || '');
  useEffect(() => setDraft(person || ''), [person]);

  if (!editing) {
    if (!person) {
      return (
        <button
          type="button"
          className="person-tag person-tag-empty"
          title="Wie doet deze klus?"
          onClick={() => setEditing(true)}
        >
          👤 wie?
        </button>
      );
    }
    const color = personColor(person);
    return (
      <button
        type="button"
        className="person-tag"
        style={{ borderColor: color, color }}
        title={`Toegewezen aan ${person} — klik om te wijzigen`}
        onClick={() => setEditing(true)}
      >
        <span className="person-dot" style={{ background: color }} aria-hidden />
        {person}
      </button>
    );
  }

  const commit = () => {
    onChange(draft.trim());
    setEditing(false);
  };
  return (
    <input
      className="input tiny person-edit"
      list="person-suggestions"
      value={draft}
      autoFocus
      placeholder="Naam"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setDraft(person || ''); setEditing(false); }
      }}
    />
  );
}

function SizeTag({ size, onChange }) {
  const meta = sizeMeta(size);
  const nextSize = size === 'klein' ? 'groot' : size === 'groot' ? null : 'klein';
  const label = meta ? meta.label : 'klus';
  const title = meta
    ? `${meta.label} klus — klik om te wisselen (${size === 'klein' ? 'wordt Groot' : 'wordt Onbepaald'})`
    : 'Zet klasse: klik voor Klein, nogmaals voor Groot';
  return (
    <button
      type="button"
      className={`size-tag ${meta ? `is-${meta.id}` : 'is-empty'}`}
      style={meta ? { borderColor: meta.color, color: meta.color } : undefined}
      onClick={() => onChange(nextSize)}
      title={title}
    >
      {meta ? <><span aria-hidden>{meta.icon}</span> {label}</> : '⚪ klus'}
    </button>
  );
}

const DATE_SHORT = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

function DateTag({ date, onChange }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    if (!date) {
      return (
        <button
          type="button"
          className="date-tag date-tag-empty"
          title="Plan deze taak in de agenda"
          onClick={() => setEditing(true)}
        >
          📅
        </button>
      );
    }
    const label = DATE_SHORT.format(new Date(date + 'T00:00'));
    return (
      <button
        type="button"
        className="date-tag"
        title={`Gepland: ${label} — klik om te wijzigen`}
        onClick={() => setEditing(true)}
      >
        📅 {label}
      </button>
    );
  }
  return (
    <input
      type="date"
      className="input tiny date-edit"
      value={date || ''}
      autoFocus
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function AddRoomButton({ onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!editing) {
    return (
      <button
        type="button"
        className="room-add"
        onClick={() => setEditing(true)}
        title="Ruimte toevoegen"
      >
        + ruimte
      </button>
    );
  }
  const commit = () => {
    const v = draft.trim();
    if (v) onSet(v);
    setEditing(false);
    setDraft('');
  };
  return (
    <input
      className="input tiny room-edit"
      list="room-suggestions"
      placeholder="Ruimte"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft('');
          setEditing(false);
        }
      }}
    />
  );
}
