import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';

export const PLATFORMS = [
  { id: 'marktplaats', label: 'Marktplaats', icon: '🟠', color: '#f97316' },
  { id: 'vinted', label: 'Vinted', icon: '🟢', color: '#10b981' },
  { id: 'ebay', label: 'eBay', icon: '🔵', color: '#0ea5e9' },
  { id: 'facebook', label: 'Facebook', icon: '🔷', color: '#1877f2' },
  { id: 'overig', label: 'Overig', icon: '📌', color: '#64748b' },
];

function platformMeta(id) {
  return PLATFORMS.find((p) => p.id === id) || PLATFORMS[PLATFORMS.length - 1];
}

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

export default function SaleItems() {
  const { state, actions } = useStore();
  const [form, setForm] = useState({
    title: '',
    platform: 'marktplaats',
    url: '',
    askingPrice: '',
  });
  const [filter, setFilter] = useState('all');

  const totals = useMemo(() => {
    let openCount = 0;
    let openAsking = 0;
    let soldCount = 0;
    let earned = 0;
    for (const it of state.saleItems) {
      if (it.sold) {
        soldCount += 1;
        earned += it.soldPrice || 0;
      } else {
        openCount += 1;
        openAsking += it.askingPrice || 0;
      }
    }
    return { openCount, openAsking, soldCount, earned };
  }, [state.saleItems]);

  const visible = useMemo(() => {
    let list = [...state.saleItems];
    if (filter === 'open') list = list.filter((it) => !it.sold);
    else if (filter === 'sold') list = list.filter((it) => it.sold);
    list.sort((a, b) => {
      if (a.sold !== b.sold) return a.sold ? 1 : -1;
      return 0;
    });
    return list;
  }, [state.saleItems, filter]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    actions.addSaleItem({
      ...form,
      askingPrice: Number(form.askingPrice) || 0,
      title: form.title.trim(),
      url: form.url.trim(),
    });
    setForm({ title: '', platform: form.platform, url: '', askingPrice: '' });
  };

  return (
    <div className="stack">
      <div className="sale-summary">
        <SummaryCard label="Te koop" value={`${totals.openCount}`} sub={EUR.format(totals.openAsking)} tone="planned" />
        <SummaryCard label="Verkocht" value={`${totals.soldCount}`} sub={EUR.format(totals.earned)} tone="done" />
        <SummaryCard label="Verdiend" value={EUR.format(totals.earned)} sub="totale opbrengst" tone="total" />
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Nieuw item</h2>
            <div className="card-sub">Voeg iets toe wat je gaat verkopen</div>
          </div>
        </div>
        <form className="sale-form" onSubmit={submit}>
          <input
            className="input"
            placeholder="Wat verkoop je?"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select
            className="input"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>
          <div className="input-amount">
            <span className="euro-prefix">€</span>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Vraagprijs"
              value={form.askingPrice}
              onChange={(e) => setForm({ ...form, askingPrice: e.target.value })}
            />
          </div>
          <input
            className="input"
            type="url"
            placeholder="Link naar advertentie (optioneel)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <button className="btn primary" type="submit">
            Toevoegen
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Overzicht</h2>
            <div className="card-sub">
              {state.saleItems.length} items · {totals.soldCount} verkocht
            </div>
          </div>
          <div className="chip-row">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              Alles
            </button>
            <button className={`chip ${filter === 'open' ? 'active' : ''}`} onClick={() => setFilter('open')}>
              Te koop
            </button>
            <button className={`chip ${filter === 'sold' ? 'active' : ''}`} onClick={() => setFilter('sold')}>
              Verkocht
            </button>
          </div>
        </div>

        <div className="sale-list">
          {visible.length === 0 && <div className="empty">Nog niks in deze filter.</div>}
          {visible.map((item) => (
            <SaleRow key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, sub, tone }) {
  return (
    <div className={`card summary-card summary-${tone}`}>
      <div className="eyebrow">{label}</div>
      <div className="summary-amount">{value}</div>
      {sub && <div className="dim" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

function SaleRow({ item }) {
  const { actions } = useStore();
  const meta = platformMeta(item.platform);
  const [editingSold, setEditingSold] = useState(false);
  const [soldDraft, setSoldDraft] = useState(item.soldPrice ?? item.askingPrice ?? '');

  const openMarkSold = () => {
    setSoldDraft(item.soldPrice ?? item.askingPrice ?? '');
    setEditingSold(true);
  };

  const confirmSold = () => {
    actions.updateSaleItem(item.id, {
      sold: true,
      soldPrice: soldDraft === '' ? null : Number(soldDraft),
    });
    setEditingSold(false);
  };

  const unmarkSold = () => {
    actions.updateSaleItem(item.id, { sold: false, soldPrice: null });
  };

  return (
    <div className={`sale-item ${item.sold ? 'is-sold' : ''}`}>
      <div className="sale-badge" style={{ background: meta.color }} aria-hidden>
        {meta.icon}
      </div>
      <div className="sale-body">
        <div className="sale-title-row">
          <input
            className="sale-title"
            value={item.title}
            onChange={(e) => actions.updateSaleItem(item.id, { title: e.target.value })}
          />
          {item.url && (
            <a
              className="sale-link"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              title="Open advertentie"
            >
              ↗
            </a>
          )}
        </div>
        <div className="sale-meta">
          <select
            className="input tiny"
            value={item.platform}
            onChange={(e) => actions.updateSaleItem(item.id, { platform: e.target.value })}
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>
          <input
            className="input tiny sale-url"
            type="url"
            placeholder="Link"
            value={item.url}
            onChange={(e) => actions.updateSaleItem(item.id, { url: e.target.value })}
          />
        </div>
      </div>
      <div className="sale-prices">
        <div className="sale-asking">
          <span className="dim" style={{ fontSize: 11 }}>Vraagprijs</span>
          <input
            className="input tiny sale-price-input"
            type="number"
            step="0.01"
            min="0"
            value={item.askingPrice || ''}
            onChange={(e) => actions.updateSaleItem(item.id, { askingPrice: e.target.value })}
          />
        </div>
        {item.sold ? (
          <div className="sale-earned">
            <span className="dim" style={{ fontSize: 11 }}>Opbrengst</span>
            <input
              className="input tiny sale-price-input"
              type="number"
              step="0.01"
              min="0"
              value={item.soldPrice ?? ''}
              onChange={(e) =>
                actions.updateSaleItem(item.id, {
                  soldPrice: e.target.value === '' ? null : e.target.value,
                })
              }
            />
          </div>
        ) : editingSold ? (
          <div className="sale-mark">
            <input
              className="input tiny sale-price-input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Opbrengst"
              autoFocus
              value={soldDraft}
              onChange={(e) => setSoldDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmSold()}
            />
            <button className="btn primary tiny" onClick={confirmSold}>
              OK
            </button>
          </div>
        ) : (
          <button className="btn tiny sale-sold-btn" onClick={openMarkSold}>
            Verkocht ✓
          </button>
        )}
      </div>
      <div className="sale-actions">
        {item.sold && (
          <button className="btn tiny ghost" onClick={unmarkSold} title="Terug naar te koop">
            ↺
          </button>
        )}
        <button className="btn tiny ghost" onClick={() => actions.removeSaleItem(item.id)} title="Verwijderen">
          ✕
        </button>
      </div>
    </div>
  );
}
