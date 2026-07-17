const currencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const monthFormatter = new Intl.DateTimeFormat('nl-NL', {
  month: 'long',
  year: 'numeric',
});

export function formatCurrency(value) {
  const n = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(n);
}

export function formatCurrencyCompact(value) {
  const n = Number.isFinite(value) ? value : 0;
  return compactCurrencyFormatter.format(n);
}

export function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return dateFormatter.format(d);
}

export function formatLongDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return longDateFormatter.format(d);
}

export function formatMonth(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return monthFormatter.format(d);
}

export function parseAmount(input) {
  if (typeof input === 'number') return input;
  if (!input) return 0;
  const cleaned = String(input)
    .replace(/[€\s]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // duizendtal-punt weghalen
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
