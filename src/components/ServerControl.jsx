import React, { useEffect, useRef, useState } from 'react';

const CONTROL_URL =
  (typeof window !== 'undefined' && window.location.hostname
    ? `http://${window.location.hostname}:5174`
    : 'http://localhost:5174');

function fmtUptime(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}u ${m % 60}m`;
}

export default function ServerControl() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [reachable, setReachable] = useState(true);
  const timer = useRef(null);

  const refresh = async () => {
    try {
      const [s, l] = await Promise.all([
        fetch(`${CONTROL_URL}/api/status`).then((r) => r.json()),
        fetch(`${CONTROL_URL}/api/logs`).then((r) => r.json()),
      ]);
      setStatus(s);
      setLogs(l.lines || []);
      setReachable(true);
    } catch {
      setReachable(false);
    }
  };

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 2000);
    return () => clearInterval(timer.current);
  }, []);

  const toggle = async () => {
    if (!status) return;
    setBusy(true);
    const action = status.running ? 'stop' : 'start';
    try {
      await fetch(`${CONTROL_URL}/api/${action}`, { method: 'POST' });
    } catch {
      setReachable(false);
    }
    setTimeout(() => {
      setBusy(false);
      refresh();
    }, 500);
  };

  if (!reachable) {
    return (
      <section className="card">
        <h2 className="card-title">Dev-server bediening</h2>
        <div className="card-sub" style={{ marginTop: 8 }}>
          Control server niet bereikbaar op {CONTROL_URL}.
        </div>
        <div className="callout">
          Start hem eenmalig in een terminal:
          <pre className="code">npm run control</pre>
          Dat start deze control server op poort 5174 en zet daarna de dev-server op poort
          5173 aan. Vanuit dit paneel kun je hem daarna aan/uit zetten. Je kunt ook direct
          naar <a href={`${CONTROL_URL}/`}>{CONTROL_URL}</a> gaan.
        </div>
      </section>
    );
  }

  const running = status?.running;

  return (
    <div className="stack">
      <section className={`card server-card ${running ? 'is-on' : 'is-off'}`}>
        <div className="server-top">
          <div>
            <div className="eyebrow">Dev-server (Vite)</div>
            <div className="server-state">
              <span className={`dot ${running ? 'on' : 'off'}`} aria-hidden />
              {running ? 'Draait' : 'Uit'}
            </div>
            <div className="card-sub">
              {running
                ? `pid ${status.pid} · ${fmtUptime(status.uptimeMs)}`
                : status?.lastError
                ? `Laatste fout: ${status.lastError}`
                : 'Klik "Aanzetten" om te starten'}
            </div>
          </div>
          <button
            className={`toggle-btn ${running ? 'is-on' : 'is-off'}`}
            onClick={toggle}
            disabled={busy}
          >
            {busy ? '…' : running ? 'Uitzetten' : 'Aanzetten'}
          </button>
        </div>
        <div className="server-links">
          <a href={status?.url || 'http://localhost:5173'} target="_blank" rel="noreferrer">
            {status?.url || 'http://localhost:5173'}
          </a>
          <span className="dim">
            Control: <a href={`${CONTROL_URL}/`}>{CONTROL_URL}</a>
          </span>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Logs</h2>
        <pre className="code log-pre">
          {logs.length === 0 ? '(geen)' : logs.join('\n')}
        </pre>
      </section>
    </div>
  );
}
