import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addWeeks,
  addMonths,
  addYears,
  isWithinInterval,
  parseISO,
  format,
} from 'date-fns';

export const PERIODS = ['week', 'month', 'year'];

export const PERIOD_LABELS = {
  week: 'Week',
  month: 'Maand',
  year: 'Jaar',
};

// Weekstart maandag (Nederland)
const WEEK_OPTIONS = { weekStartsOn: 1 };

export function getPeriodRange(period, reference = new Date()) {
  const date = reference instanceof Date ? reference : new Date(reference);
  switch (period) {
    case 'week':
      return {
        start: startOfWeek(date, WEEK_OPTIONS),
        end: endOfWeek(date, WEEK_OPTIONS),
      };
    case 'year':
      return { start: startOfYear(date), end: endOfYear(date) };
    case 'month':
    default:
      return { start: startOfMonth(date), end: endOfMonth(date) };
  }
}

export function shiftPeriod(period, reference, delta) {
  const date = reference instanceof Date ? reference : new Date(reference);
  switch (period) {
    case 'week':
      return addWeeks(date, delta);
    case 'year':
      return addYears(date, delta);
    case 'month':
    default:
      return addMonths(date, delta);
  }
}

export function formatPeriodLabel(period, reference) {
  const date = reference instanceof Date ? reference : new Date(reference);
  const range = getPeriodRange(period, date);
  switch (period) {
    case 'week': {
      const weekNumber = format(range.start, 'I');
      return `Week ${weekNumber} · ${format(range.start, 'd MMM')} – ${format(range.end, 'd MMM yyyy')}`;
    }
    case 'year':
      return format(range.start, 'yyyy');
    case 'month':
    default: {
      const months = [
        'januari', 'februari', 'maart', 'april', 'mei', 'juni',
        'juli', 'augustus', 'september', 'oktober', 'november', 'december',
      ];
      return `${months[range.start.getMonth()]} ${range.start.getFullYear()}`;
    }
  }
}

export function isInPeriod(dateValue, period, reference) {
  const date = dateValue instanceof Date ? dateValue : parseISO(String(dateValue));
  if (Number.isNaN(date.getTime())) return false;
  const range = getPeriodRange(period, reference);
  return isWithinInterval(date, range);
}

// Aantal 'weken/maanden' in een jaar-budget, gebruikt voor omrekening tussen periodes.
export function convertBudget(amount, fromPeriod, toPeriod) {
  if (fromPeriod === toPeriod) return amount;
  const perYear = { week: 52, month: 12, year: 1 };
  const yearly = amount * perYear[fromPeriod];
  return yearly / perYear[toPeriod];
}
