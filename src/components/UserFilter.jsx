import React from 'react';
import { useStore } from '../store.jsx';

export default function UserFilter() {
  const { state, actions } = useStore();
  const active = state.settings.activeUserId;
  return (
    <div className="tabs">
      <button
        className={`tab ${!active ? 'active' : ''}`}
        onClick={() => actions.setActiveUser(null)}
      >
        Iedereen
      </button>
      {state.users.map((u) => (
        <button
          key={u.id}
          className={`tab ${active === u.id ? 'active' : ''}`}
          onClick={() => actions.setActiveUser(u.id)}
          style={active === u.id ? { color: u.color, background: `${u.color}22` } : {}}
        >
          {u.name}
        </button>
      ))}
    </div>
  );
}
