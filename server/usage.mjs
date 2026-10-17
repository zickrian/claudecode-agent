// The Claude plan's 5-hour and weekly limits — the fuel gauge for the employee.
// Source 1: the usage endpoint Claude Code's own /usage screen reads, with the login token Claude Code
//           keeps on this machine (read into memory, sent only to api.anthropic.com, never logged or stored).
// Source 2: the rate_limit_event Claude Code streams during every run (used when source 1 is unavailable).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const CREDENTIALS = path.join(os.homedir(), '.claude', '.credentials.json');

let usage = { fiveHour: null, week: null, plan: null, source: null, at: null };

const window_ = (pct, resetsAt, scope) => (pct == null ? null : { pct: Math.round(pct), resetsAt, ...(scope ? { scope } : {}) });
const at = iso => (iso ? Date.parse(iso) : null);

// Accounts answer in one of two shapes: five_hour / seven_day (Pro, Max), or a generic `limits` list
// (Team, Enterprise) where the weekly limit may be scoped to one model, e.g. "Fable".
function parse(j) {
  const limits = Array.isArray(j.limits) ? j.limits : [];
  const session = limits.find(l => l.group === 'session');
  const weekly = limits.filter(l => l.group === 'weekly');
  const week = weekly.find(l => !l.scope) || weekly[0];
  return {
    fiveHour: j.five_hour
      ? window_(j.five_hour.utilization, at(j.five_hour.resets_at))
      : session ? window_(session.percent, at(session.resets_at)) : null,
    week: j.seven_day
      ? window_(j.seven_day.utilization, at(j.seven_day.resets_at))
      : week ? window_(week.percent, at(week.resets_at), week.scope?.model?.display_name) : null,
  };
}

function readLogin() {
  try { return JSON.parse(fs.readFileSync(CREDENTIALS, 'utf8')).claudeAiOauth || null; } catch { return null; }
}

export async function refreshUsage() {
  const login = readLogin();
  if (!login?.accessToken) return usage;
  try {
    const r = await fetch(ENDPOINT, {
      headers: { Authorization: `Bearer ${login.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20', Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return usage;
    const j = await r.json();
    usage = { ...parse(j), plan: login.subscriptionType || null, source: 'claude', at: Date.now() };
  } catch { /* offline or endpoint changed: keep the last known numbers */ }
  return usage;
}

// From a run's stream: { unifiedWindows: { five_hour: { utilization: 0.29, resetsAt: <s> }, seven_day: {…} } }
export function usageFromRun(info) {
  const w = info?.unifiedWindows;
  if (!w) return usage;
  const from = x => x && window_(x.utilization * 100, x.resetsAt * 1000);
  usage = {
    ...usage,
    fiveHour: from(w.five_hour) || usage.fiveHour,
    week: from(w.seven_day) || usage.week,
    source: usage.source || 'run', at: Date.now(),
  };
  return usage;
}

export const getUsage = () => usage;
