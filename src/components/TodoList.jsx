import React, { useMemo, useState } from 'react';
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
  const [expandedId, setExpandedId] = useState(null);

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

  const matchesFilter = (t) => {
    if (filter === 'all') return true;
    if (filter === '__empty__') return !t.room;
    return t.room === filter;
  };

  const { open, done } = useMemo(() => {
    const sortByOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const openList = state.todos.filter((t) => !t.done).filter(matchesFilter).slice().sort(sortByOrder);
    const doneList = state.todos.filter((t) => t.done).filter(matchesFilter).slice().sort(sortByOrder);
    return { open: openList, done: doneList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.todos, filter]);

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
        <button className="btn primary" type="submit">
          Toevoegen
        </button>
      </form>

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={open.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="todo-list">
            {open.map((todo) => (
              <SortableTodoItem
                key={todo.id}
                todo={todo}
                expanded={expandedId === todo.id}
                onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
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

function SortableTodoItem({ todo, expanded, onExpand }) {
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
      dragHandleProps={{ ref: setNodeRef, style, listeners, attributes, isDragging }}
    />
  );
}

function TodoItem({ todo, expanded, onExpand, dragHandleProps }) {
  const { actions } = useStore();
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
        <button
          className={`btn tiny ${todo.comment ? 'accent' : 'ghost'}`}
          onClick={onExpand}
          title="Opmerking"
        >
          {todo.comment ? '📝' : '＋'}
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
    </li>
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
