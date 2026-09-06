import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
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

export default function TodoList() {
  const { state, actions } = useStore();
  const [text, setText] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { open, done } = useMemo(() => {
    const sortByOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const openList = state.todos.filter((t) => !t.done).slice().sort(sortByOrder);
    const doneList = state.todos.filter((t) => t.done).slice().sort(sortByOrder);
    return { open: openList, done: doneList };
  }, [state.todos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    actions.addTodo(value);
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

      <form className="row" onSubmit={submit}>
        <input
          className="input"
          placeholder="Nieuwe taak…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn primary" type="submit">
          Toevoegen
        </button>
      </form>

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
            onChange={() => actions.toggleTodo(todo.id)}
          />
          <span />
        </label>
        <input
          className="todo-text"
          value={todo.text}
          onChange={(e) => actions.updateTodo(todo.id, { text: e.target.value })}
        />
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
