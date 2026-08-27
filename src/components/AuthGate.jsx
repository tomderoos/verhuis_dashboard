import React, { useState } from 'react';
import { useStore } from '../store.jsx';

const IS_DEV = import.meta.env.DEV;

export default function AuthGate({ children }) {
  const { session, authReady, actions, state } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!authReady) {
    return <div className="loading-screen">Laden…</div>;
  }

  if (IS_DEV && !session) {
    if (state.loading) return <div className="loading-screen">Data laden…</div>;
    return children;
  }

  if (!session) {
    const submit = async (e) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      const { error } = await actions.signInWithEmail(email);
      setBusy(false);
      if (error) setError(error.message);
      else setSent(true);
    };

    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-icon">🏠</span>
            <div>
              <div className="brand-title">Huis Dashboard</div>
              <div className="brand-sub">Verkoop Kloversdonk 213 · Verhuizing Bloemheuvellaan 51</div>
            </div>
          </div>
          {sent ? (
            <div className="stack">
              <h2 className="card-title">Check je mail</h2>
              <p className="dim">
                We hebben een inloglink gestuurd naar <strong>{email}</strong>. Klik daarop om binnen te komen.
              </p>
              <button className="btn ghost" onClick={() => { setSent(false); setEmail(''); }}>
                Ander adres gebruiken
              </button>
            </div>
          ) : (
            <form className="stack" onSubmit={submit}>
              <label className="dim" style={{ fontSize: 13 }}>E-mail (magic link)</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jij@voorbeeld.nl"
                required
                autoFocus
              />
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? 'Bezig…' : 'Stuur inloglink'}
              </button>
              {error && <div className="error-msg">{error}</div>}
              <div className="dim" style={{ fontSize: 12 }}>
                Alleen adressen die door de eigenaar zijn uitgenodigd kunnen inloggen.
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (state.loading) {
    return <div className="loading-screen">Data laden…</div>;
  }

  return children;
}
