// Everything the office remembers lives in data/ as plain JSON: config, leads, runs, scheduler state.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA = path.resolve('data');
export const WORKSPACE = path.join(DATA, 'workspace'); // cwd for `claude -p`: empty, so no project CLAUDE.md leaks in
fs.mkdirSync(WORKSPACE, { recursive: true });

const file = name => path.join(DATA, name);
const read = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return structuredClone(fallback); }
};
const write = (name, value) => {
  const tmp = file(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file(name));
};

export const DEFAULT_CONFIG = {
  employee: { name: 'Raka', role: 'Lead Hunter' },
  brief: {
    offer: '',          // what we sell — the agent looks for people who need it
    target: '',         // who a good lead is
    keywords: [],       // starting search terms on Threads
    location: 'Indonesia',
    perRun: 10,         // how many leads to aim for per run
  },
  browser: true,        // browse Threads in the owner's Chrome (Claude in Chrome)
  auto: { enabled: false, times: ['09:00', '15:00'] },
};

export function loadConfig() {
  const c = read('config.json', DEFAULT_CONFIG);
  return {
    ...DEFAULT_CONFIG, ...c,
    employee: { ...DEFAULT_CONFIG.employee, ...c.employee },
    brief: { ...DEFAULT_CONFIG.brief, ...c.brief },
    auto: { ...DEFAULT_CONFIG.auto, ...c.auto },
  };
}
export const saveConfig = c => write('config.json', c);

export const loadLeads = () => read('leads.json', []);
export const saveLeads = l => write('leads.json', l);

// A lead is the same lead when it points at the same profile (or, failing that, the same handle).
const leadKey = l => String(l.profile_url || l.handle || l.name || '').toLowerCase()
  .replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').replace(/^@/, '');

export function addLeads(found, runId) {
  const leads = loadLeads();
  const known = new Set(leads.map(leadKey));
  const added = [];
  for (const l of found) {
    const key = leadKey(l);
    if (!key || known.has(key)) continue;
    known.add(key);
    const lead = { id: crypto.randomUUID().slice(0, 8), ...l, status: 'baru', runId, foundAt: Date.now() };
    leads.unshift(lead);
    added.push(lead);
  }
  saveLeads(leads);
  return added;
}

export const loadRuns = () => read('runs.json', []);
export function saveRun(run) {
  const runs = loadRuns().filter(r => r.id !== run.id);
  runs.unshift(run);
  write('runs.json', runs.slice(0, 30));
}

export const loadSchedule = () => read('schedule.json', { lastSlot: null });
export const saveSchedule = s => write('schedule.json', s);
