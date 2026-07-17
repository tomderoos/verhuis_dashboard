import React from 'react';
import { PERIODS, PERIOD_LABELS, formatPeriodLabel, shiftPeriod } from '../utils/period.js';

export default function PeriodNav({ period, setPeriod, reference, setReference, showPeriodTabs = true }) {
  return (
    <div className="row wrap gap-12">
      {showPeriodTabs && (
        <div className="tabs">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`tab ${p === period ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      )}
      <div className="period-nav">
        <button className="btn icon small" onClick={() => setReference(shiftPeriod(period, reference, -1))} title="Vorige">‹</button>
        <span className="period-label mono">{formatPeriodLabel(period, reference)}</span>
        <button className="btn icon small" onClick={() => setReference(shiftPeriod(period, reference, 1))} title="Volgende">›</button>
        <button className="btn ghost small" onClick={() => setReference(new Date())}>Vandaag</button>
      </div>
    </div>
  );
}
