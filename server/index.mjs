// The office server: one employee, real Claude Code runs, a live feed over WebSocket.
//   npm start  → http://localhost:8787 (serves the built office from dist/)
//   npm run dev → this on :8787 + Vite on :5173 with /api and /ws proxied here
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { runLeadHunt, MODEL } from './agent.mjs';
import { refreshUsage, usageFromRun, getUsage } from './usage.mjs';
import {
  loadConfig, saveConfig, loadLeads, saveLeads, addLeads, loadRuns, saveRun, loadSchedule, saveSchedule,
} from './store.mjs';

const PORT = Number(process.env.PORT) || 8787;
const DIST = path.resolve('dist');

// ---- the employee ---------------------------------------------------------------
// status: 'idle' (on a break) · 'working' · 'done' (just finished) · 'error'
let employee = { status: 'idle', since: Date.now(), activity: null, runId: null };
let current = null; // { run, stop }
let doneTimer = null;

function setEmployee(patch) {
  employee = { ...employee, ...patch };
  broadcast({ type: 'employee', employee });
}

function startRun({ instruction = '', trigger = 'manual' } = {}) {
  if (current) return { error: 'Karyawan sedang bekerja. Tunggu selesai atau hentikan dulu.' };
  clearTimeout(doneTimer);
  const cfg = loadConfig();
  const run = {
    id: crypto.randomUUID().slice(0, 8), trigger, instruction, status: 'working',
    startedAt: Date.now(), endedAt: null, activity: [], leadsFound: 0,
  };
  const knownHandles = loadLeads().map(l => l.handle).filter(Boolean);
  const { done, stop } = runLeadHunt({
    cfg, instruction, knownHandles,
    onRateLimit: info => broadcast({ type: 'usage', usage: usageFromRun(info) }),
    onActivity: item => {
      run.activity.push(item);
      if (run.activity.length > 300) run.activity.shift();
      setEmployee({ activity: item });
      broadcast({ type: 'activity', runId: run.id, item });
    },
  });
  current = { run, stop };
  saveRun(run);
  setEmployee({ status: 'working', since: Date.now(), activity: null, runId: run.id });
  broadcast({ type: 'run', run: summary(run) });
  console.log(`▶ run ${run.id} (${trigger})${instruction ? ': ' + instruction.slice(0, 80) : ''}`);

  done.then(res => {
    const added = res.ok ? addLeads(res.leads, run.id) : [];
    const stuck = res.ok && !added.length && res.blocked; // finished, but blocked before finding anything
    Object.assign(run, {
      status: res.stopped ? 'stopped' : res.ok && !stuck ? 'done' : 'error',
      endedAt: Date.now(), leadsFound: added.length, reported: res.leads.length,
      summary: res.summary, blocked: res.blocked, error: res.error || (stuck ? res.blocked : ''),
      turns: res.turns, durationMs: res.durationMs, tokens: res.tokens,
    });
    saveRun(run);
    current = null;
    const ok = run.status === 'done';
    setEmployee({ status: ok ? 'done' : run.status === 'stopped' ? 'idle' : 'error', since: Date.now(), activity: null });
    broadcast({ type: 'run', run: summary(run) });
    if (added.length) broadcast({ type: 'leads', leads: loadLeads() });
    refreshUsage().then(u => broadcast({ type: 'usage', usage: u }));
    // after a short celebration (or a visible error), back to the break area
    doneTimer = setTimeout(() => { if (!current) setEmployee({ status: 'idle', since: Date.now() }); }, ok ? 9000 : 20000);
    console.log(`■ run ${run.id} ${run.status} · ${added.length} new leads${run.error ? ' · ' + run.error.slice(0, 120) : ''}`);
  });
  return { run: summary(run) };
}

const summary = ({ activity, ...r }) => ({ ...r, steps: activity.length });

// ---- auto schedule: fire once per configured HH:MM, on this machine's clock --------
setInterval(() => {
  const { auto } = loadConfig();
  if (!auto.enabled || current) return;
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  if (!auto.times.includes(hhmm)) return;
  const slot = `${now.toISOString().slice(0, 10)} ${hhmm}`;
  const s = loadSchedule();
  if (s.lastSlot === slot) return;
  saveSchedule({ lastSlot: slot });
  startRun({ trigger: 'auto' });
}, 20_000);

// ---- the plan's limits: refreshed every 2 minutes and after every run ----------------
refreshUsage().then(u => broadcast({ type: 'usage', usage: u }));
setInterval(() => refreshUsage().then(u => broadcast({ type: 'usage', usage: u })), 120_000);

// ---- HTTP -------------------------------------------------------------------------
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const body = req => new Promise(r => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream' };

function csv(leads) {
  const cols = ['foundAt', 'name', 'handle', 'profile_url', 'post_url', 'need', 'why', 'score', 'location', 'status'];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...leads.map(l => cols.map(c => cell(c === 'foundAt' ? new Date(l.foundAt).toISOString() : l[c])).join(','))].join('\n');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/api/state') return json(res, 200, { employee, model: MODEL, usage: getUsage(), config: loadConfig(), leads: loadLeads(), runs: loadRuns().map(summary), activity: current?.run.activity || loadRuns()[0]?.activity || [] });
  if (p === '/api/run' && req.method === 'POST') { const r = startRun(await body(req)); return json(res, r.error ? 409 : 200, r); }
  if (p === '/api/stop' && req.method === 'POST') { if (current) current.stop(); return json(res, 200, { ok: true }); }
  if (p === '/api/config' && req.method === 'PUT') {
    const c = { ...loadConfig(), ...(await body(req)) };
    saveConfig(c); broadcast({ type: 'config', config: c }); return json(res, 200, c);
  }
  const lead = p.match(/^\/api\/leads\/([\w-]+)$/);
  if (lead && req.method === 'PATCH') {
    const patch = await body(req); const leads = loadLeads().map(l => l.id === lead[1] ? { ...l, status: patch.status ?? l.status } : l);
    saveLeads(leads); broadcast({ type: 'leads', leads }); return json(res, 200, { ok: true });
  }
  if (lead && req.method === 'DELETE') {
    const leads = loadLeads().filter(l => l.id !== lead[1]);
    saveLeads(leads); broadcast({ type: 'leads', leads }); return json(res, 200, { ok: true });
  }
  if (p === '/api/leads.csv') { res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="leads.csv"' }); return res.end(csv(loadLeads())); }
  if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });

  // static: the built office (npm run build)
  let f = path.join(DIST, decodeURIComponent(p));
  if (!f.startsWith(DIST)) return json(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Belum di-build. Jalankan: npm run build (atau npm run dev untuk mode development)'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// ---- WebSocket: push every change to every open office ------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });
function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}

// stop the employee cleanly when the server stops
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { current?.stop(); process.exit(0); });

server.listen(PORT, '127.0.0.1', () => {
  const cfg = loadConfig();
  console.log(`Perushaan AI → http://localhost:${PORT}`);
  console.log(`  karyawan: ${cfg.employee.name} (${cfg.employee.role}) · ${MODEL.label} (${MODEL.effort}) · browser ${cfg.browser ? 'Chrome' : 'web search'}`);
  console.log(`  jadwal otomatis: ${cfg.auto.enabled ? cfg.auto.times.join(', ') : 'mati'}`);
});
