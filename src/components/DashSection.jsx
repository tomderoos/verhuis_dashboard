import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function DashSection({ id, title, collapsed, onToggle, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 5 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={`dash-section ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="dash-section-controls">
        <button
          type="button"
          className="dash-drag"
          aria-label={`Sleep ${title}`}
          title="Sleep om te ordenen"
          {...listeners}
          {...attributes}
        >
          ⋮⋮
        </button>
        <button
          type="button"
          className="dash-collapse"
          onClick={onToggle}
          aria-label={collapsed ? `${title} uitklappen` : `${title} inklappen`}
          title={collapsed ? 'Uitklappen' : 'Inklappen'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {collapsed ? (
        <button
          type="button"
          className="card dash-collapsed-card"
          onClick={onToggle}
          title="Klik om uit te klappen"
        >
          <span className="dash-collapsed-title">{title}</span>
          <span className="dash-collapsed-hint">uitklappen ▸</span>
        </button>
      ) : (
        children
      )}
    </div>
  );
}
