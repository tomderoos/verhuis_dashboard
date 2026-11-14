import { Eye, Hammer, Flag, Pin } from 'lucide-react';

// Gedeeld door Timeline en Agenda. Alleen een bezichtiging krijgt het accent;
// de rest blijft in rustige tinten.
export const EVENT_TYPES = [
  { id: 'bezichtiging', label: 'Bezichtiging', icon: Eye, color: 'var(--accent)' },
  { id: 'klus', label: 'Klus', icon: Hammer, color: 'var(--warning)' },
  { id: 'mijlpaal', label: 'Mijlpaal', icon: Flag, color: 'var(--success)' },
  { id: 'overig', label: 'Overig', icon: Pin, color: 'var(--text-subtle)' },
];

export const EVENT_META = Object.fromEntries(EVENT_TYPES.map((t) => [t.id, t]));
