// Minimal iCalendar parser: pulls VEVENT records out of a .ics feed.
// Returns { uid, date, endDate, allDay, timeLabel, endTimeLabel, summary, location, description } per event.

export function parseIcs(text) {
  if (!text) return [];
  // RFC 5545 line folding: a line that begins with SP/HTAB continues the previous line.
  const unfolded = String(text)
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) {
        const ev = finalizeEvent(current);
        if (ev) events.push(ev);
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...paramParts] = head.split(';');
    const params = {};
    for (const p of paramParts) {
      const eq = p.indexOf('=');
      if (eq === -1) continue;
      params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    const key = name.toUpperCase();
    if (key === 'DTSTART') current.dtstart = { value, params };
    else if (key === 'DTEND') current.dtend = { value, params };
    else if (key === 'SUMMARY') current.summary = unescapeText(value);
    else if (key === 'LOCATION') current.location = unescapeText(value);
    else if (key === 'DESCRIPTION') current.description = unescapeText(value);
    else if (key === 'UID') current.uid = value;
  }
  return events;
}

function unescapeText(s) {
  return String(s)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseDatePart(raw) {
  if (!raw || raw.length < 8) return null;
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  if (!y || !mo || !d) return null;
  let time = null;
  if (raw.length >= 15 && raw[8] === 'T') {
    const h = Number(raw.slice(9, 11));
    const mi = Number(raw.slice(11, 13));
    if (!Number.isNaN(h) && !Number.isNaN(mi)) time = { h, mi };
  }
  return { y, mo, d, time };
}

function finalizeEvent(raw) {
  if (!raw.dtstart) return null;
  const start = parseDatePart(raw.dtstart.value);
  if (!start) return null;
  const date = `${start.y}-${pad2(start.mo)}-${pad2(start.d)}`;
  const allDay = raw.dtstart.params?.VALUE === 'DATE' || !start.time;
  const timeLabel = start.time ? `${pad2(start.time.h)}:${pad2(start.time.mi)}` : null;
  let endDate = date;
  let endTimeLabel = null;
  if (raw.dtend) {
    const end = parseDatePart(raw.dtend.value);
    if (end) {
      endDate = `${end.y}-${pad2(end.mo)}-${pad2(end.d)}`;
      if (end.time) endTimeLabel = `${pad2(end.time.h)}:${pad2(end.time.mi)}`;
    }
  }
  return {
    uid: raw.uid || `${raw.dtstart.value}-${raw.summary || ''}`,
    date,
    endDate,
    allDay,
    timeLabel,
    endTimeLabel,
    summary: raw.summary || '',
    location: raw.location || '',
    description: raw.description || '',
  };
}
