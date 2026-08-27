import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';

export default function TodoList() {
  const { state, actions } = useStore();
  const [text, setText] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { open, done } = useMemo(() => {
    const openList = state.todos.filter((t) => !t.done);
    const doneList = state.todos.filter((t) => t.done);
    return { open: openList, done: doneList };
  }, [state.todos]);

  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    actions.addTodo(value);
    setText('');
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">To do — huidige huis</h2>
          <div className="card-sub">
            {open.length} open · {done.length} klaar
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

      <ul className="todo-list">
        {open.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            expanded={expandedId === todo.id}
            onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
          />
        ))}
        {done.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            expanded={expandedId === todo.id}
            onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
          />
        ))}
        {state.todos.length === 0 && (
          <li className="empty">Nog geen taken — voeg je eerste taak toe.</li>
        )}
      </ul>
    </section>
  );
}

function TodoItem({ todo, expanded, onExpand }) {
  const { actions } = useStore();
  return (
    <li className={`todo-item ${todo.done ? 'is-done' : ''}`}>
      <div className="todo-row">
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
