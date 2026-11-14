import React, { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { LeadCountdown, CountdownRow } from './Countdown.jsx';

const ITEMS = [
  { key: 'salePrepDate', label: "Klaar voor de foto's" },
  { key: 'kloversdonkKeyDate', label: 'Overdracht Kloversdonk', plate: '213' },
  { key: 'moveDate', label: 'Verhuisdatum' },
  { key: 'keyDate', label: 'Sleutels Bloemheuvellaan', plate: '51' },
];

// Eén grote klok voor de eerstvolgende mijlpaal, de rest als rustige lijst.
export default function Milestones() {
  const { state } = useStore();
  // Elke minuut opnieuw kiezen, zodat een verstreken mijlpaal plaatsmaakt.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const withTime = ITEMS.map((it) => ({ ...it, time: state[it.key] ? new Date(state[it.key]).getTime() : null }));
  const upcoming = withTime.filter((it) => it.time && it.time > now).sort((a, b) => a.time - b.time);
  const lead = upcoming[0] || null;
  const rest = withTime
    .filter((it) => it !== lead)
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));

  return (
    <div className={`milestones ${lead ? '' : 'no-lead'}`}>
      {lead && <LeadCountdown stateKey={lead.key} label={lead.label} plate={lead.plate} />}
      <section className="card milestone-list-card">
        <h2 className="card-title">Mijlpalen</h2>
        <ul className="milestone-list">
          {rest.map((it) => (
            <CountdownRow key={it.key} stateKey={it.key} label={it.label} plate={it.plate} />
          ))}
        </ul>
      </section>
    </div>
  );
}
