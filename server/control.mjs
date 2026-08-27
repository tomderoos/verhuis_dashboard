import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTROL_PORT = Number(process.env.CONTROL_PORT || 5174);
const DEV_PORT = Number(process.env.DEV_PORT || 5173);
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

let child = null;
let startedAt = null;
let lastError = null;
const logBuffer = [];

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
function log(line) {
  const clean = line.replace(ANSI_RE, '');
  const stamped = `[${new Date().toISOString()}] ${clean}`;
  logBuffer.push(stamped);
  if (logBuffer.length > 200) logBuffer.splice(0, logBuffer.length - 200);
  console.log(stamped);
}

function startVite() {
  if (child) return { ok: false, error: 'Server draait al.' };
  if (!fs.existsSync(VITE_BIN)) {
    return { ok: false, error: `Vite niet gevonden op ${VITE_BIN}. Run eerst npm install.` };
  }
  lastError = null;
  const proc = spawn(process.execPath, [VITE_BIN, '--port', String(DEV_PORT)], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child = proc;
  startedAt = Date.now();
  log(`Vite gestart (pid ${proc.pid}) op poort ${DEV_PORT}`);

  proc.stdout.on('data', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (line.trim()) log(`vite: ${line.trim()}`);
    }
  });
  proc.stderr.on('data', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (line.trim()) log(`vite err: ${line.trim()}`);
    }
  });
  proc.on('exit', (code, signal) => {
    log(`Vite gestopt (code ${code}, signal ${signal})`);
    if (child === proc) {
      child = null;
      startedAt = null;
      if (code && code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
        lastError = `Vite eindigde met code ${code}`;
      }
    }
  });
  proc.on('error', (err) => {
    log(`Vite fout: ${err.message}`);
    lastError = err.message;
    if (child === proc) {
      child = null;
      startedAt = null;
    }
  });
  return { ok: true, pid: proc.pid };
}

function stopVite() {
  if (!child) return { ok: false, error: 'Server draait niet.' };
  const proc = child;
  proc.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    if (child === proc) {
      log('SIGTERM negeerde — SIGKILL');
      proc.kill('SIGKILL');
    }
  }, 4000);
  proc.once('exit', () => clearTimeout(killTimer));
  return { ok: true };
}

function status() {
  return {
    running: !!child,
    pid: child ? child.pid : null,
    startedAt,
    uptimeMs: startedAt ? Date.now() - startedAt : 0,
    port: DEV_PORT,
    url: `http://localhost:${DEV_PORT}`,
    lastError,
  };
}

function json(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

const CONTROL_HTML = `<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Huis Dashboard — Server</title>
<style>
  :root { color-scheme: light dark; --accent:#6366f1; --danger:#ef4444; --success:#10b981; --border:#e2e6ee; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 520px; margin: 48px auto; padding: 0 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.sub { color:#64748b; margin-top: 0; }
  .card { border:1px solid var(--border); border-radius: 16px; padding: 24px; margin-top: 24px; }
  .row { display:flex; align-items:center; gap:12px; }
  .dot { width:12px; height:12px; border-radius:50%; background:#94a3b8; }
  .dot.on { background: var(--success); box-shadow: 0 0 0 4px rgba(16,185,129,.15); }
  .dot.off { background: var(--danger); }
  button { border:0; border-radius:10px; padding:12px 20px; font-size:15px; font-weight:600; cursor:pointer; margin-top:16px; }
  .start { background: var(--success); color:#fff; }
  .stop  { background: var(--danger); color:#fff; }
  button[disabled] { opacity: .5; cursor: not-allowed; }
  a { color: var(--accent); }
  pre { background:#0b1220; color:#e2e8f0; padding:12px; border-radius:8px; max-height:240px; overflow:auto; font-size:12px; }
</style></head>
<body>
  <h1>🏠 Huis Dashboard — dev server</h1>
  <p class="sub">Control server draait op poort ${CONTROL_PORT}. Deze pagina blijft werken ook als de dev-server uit staat.</p>
  <div class="card">
    <div class="row">
      <div id="dot" class="dot"></div>
      <strong id="state">…</strong>
      <span id="meta" style="color:#64748b; margin-left:auto; font-size:13px;"></span>
    </div>
    <div><a id="link" href="http://localhost:${DEV_PORT}" target="_blank">http://localhost:${DEV_PORT}</a></div>
    <button id="toggle" class="start">Aanzetten</button>
  </div>
  <div class="card">
    <strong>Logs</strong>
    <pre id="log">(geen)</pre>
  </div>
<script>
async function refresh() {
  const s = await fetch('/api/status').then(r=>r.json());
  const dot = document.getElementById('dot');
  const state = document.getElementById('state');
  const btn = document.getElementById('toggle');
  const meta = document.getElementById('meta');
  if (s.running) {
    dot.className = 'dot on';
    state.textContent = 'Server draait';
    btn.textContent = 'Uitzetten';
    btn.className = 'stop';
    const s2 = Math.round(s.uptimeMs/1000);
    meta.textContent = 'pid ' + s.pid + ' · ' + (s2>60 ? Math.floor(s2/60)+'m '+(s2%60)+'s' : s2+'s');
  } else {
    dot.className = 'dot off';
    state.textContent = 'Server staat uit' + (s.lastError ? ' — '+s.lastError : '');
    btn.textContent = 'Aanzetten';
    btn.className = 'start';
    meta.textContent = '';
  }
  const logs = await fetch('/api/logs').then(r=>r.json());
  document.getElementById('log').textContent = logs.lines.join('\\n') || '(geen)';
}
document.getElementById('toggle').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const action = btn.className === 'stop' ? 'stop' : 'start';
  await fetch('/api/' + action, { method:'POST' });
  setTimeout(() => { btn.disabled = false; refresh(); }, 400);
});
refresh();
setInterval(refresh, 2000);
</script>
</body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }
  const url = new URL(req.url, `http://localhost:${CONTROL_PORT}`);
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(CONTROL_HTML);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, status());
  if (req.method === 'GET' && url.pathname === '/api/logs') return json(res, 200, { lines: logBuffer.slice(-100) });
  if (req.method === 'POST' && url.pathname === '/api/start') {
    const r = startVite();
    return json(res, r.ok ? 200 : 409, { ...r, status: status() });
  }
  if (req.method === 'POST' && url.pathname === '/api/stop') {
    const r = stopVite();
    return json(res, r.ok ? 200 : 409, { ...r, status: status() });
  }
  json(res, 404, { error: 'not found' });
});

server.listen(CONTROL_PORT, () => {
  log(`Control server op http://localhost:${CONTROL_PORT}`);
  if (process.env.AUTOSTART !== '0') {
    startVite();
  }
});

function shutdown() {
  log('Control server stopt…');
  if (child) child.kill('SIGTERM');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
