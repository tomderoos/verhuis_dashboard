import React, { useEffect, useState } from 'react';
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Thermometer, Droplet, Wind, PaintRoller } from 'lucide-react';

const APELDOORN = { lat: 52.2112, lon: 5.9699 };

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${APELDOORN.lat}&longitude=${APELDOORN.lon}` +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
  '&timezone=Europe%2FAmsterdam&forecast_days=7';

// Voor buiten schilderen: min 10°C, weinig regen (<30%), wind onder 30 km/u.
function isPaintFriendly(day) {
  return (
    day.tMax >= 10 &&
    day.rainProb < 30 &&
    day.rainMm < 1 &&
    day.wind < 30
  );
}

function iconForCode(code) {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Thermometer;
}

function labelForCode(code) {
  if (code === 0) return 'Zonnig';
  if (code === 1) return 'Vrijwel zonnig';
  if (code === 2) return 'Deels bewolkt';
  if (code === 3) return 'Bewolkt';
  if (code === 45 || code === 48) return 'Mist';
  if (code >= 51 && code <= 57) return 'Motregen';
  if (code >= 61 && code <= 65) return 'Regen';
  if (code === 66 || code === 67) return 'IJzelregen';
  if (code >= 71 && code <= 77) return 'Sneeuw';
  if (code >= 80 && code <= 82) return 'Buien';
  if (code === 85 || code === 86) return 'Sneeuwbuien';
  if (code >= 95) return 'Onweer';
  return '—';
}

const NL_DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'short' });
const NL_DAY_NUM = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

export default function Weather() {
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(WEATHER_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const d = json.daily;
        const items = d.time.map((iso, i) => ({
          date: iso,
          code: d.weather_code[i],
          tMax: Math.round(d.temperature_2m_max[i]),
          tMin: Math.round(d.temperature_2m_min[i]),
          rainMm: d.precipitation_sum[i],
          rainProb: d.precipitation_probability_max[i] ?? 0,
          wind: Math.round(d.wind_speed_10m_max[i]),
        }));
        setDays(items);
        setUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Weer Apeldoorn — komende 7 dagen</h2>
          <div className="card-sub">
            Klusdag: geschikt om buiten te schilderen (vanaf 10 °C, droog, wind onder 30 km/u)
            {updatedAt && ` · Bijgewerkt ${updatedAt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>
      </div>

      {error && <div className="callout error-callout">Weerdata niet gelukt: {error}</div>}

      {!days && !error && <div className="empty">Weerdata laden…</div>}

      {days && (
        <div className="weather-row">
          {days.map((day, i) => (
            <DayTile key={day.date} day={day} isToday={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function DayTile({ day, isToday }) {
  const paint = isPaintFriendly(day);
  const date = new Date(day.date + 'T00:00');
  const Icon = iconForCode(day.code);
  return (
    <div className={`weather-tile ${paint ? 'is-paint-ok' : ''} ${isToday ? 'is-today' : ''}`}>
      <div className="weather-day">
        {isToday ? 'Vandaag' : NL_DAY.format(date).replace('.', '')}
      </div>
      <div className="weather-date">{NL_DAY_NUM.format(date)}</div>
      <div className="weather-icon" title={labelForCode(day.code)} aria-label={labelForCode(day.code)}>
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <div className="weather-temp">
        <span className="temp-max">{day.tMax}°</span>
        <span className="temp-min">{day.tMin}°</span>
      </div>
      <div className="weather-detail">
        <Droplet size={12} strokeWidth={1.5} aria-hidden /> {Math.round(day.rainProb)}%
        {day.rainMm >= 0.5 && <span className="dim"> · {day.rainMm.toFixed(1)}mm</span>}
      </div>
      <div className="weather-detail"><Wind size={12} strokeWidth={1.5} aria-hidden /> {day.wind} km/u</div>
      {paint && <div className="paint-badge" title="Geschikt voor schilderen"><PaintRoller size={12} strokeWidth={1.5} aria-hidden /> Klusdag</div>}
    </div>
  );
}
