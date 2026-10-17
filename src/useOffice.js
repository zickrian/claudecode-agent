// Live office state: one fetch on load, then every change pushed over the WebSocket.
import { useCallback, useEffect, useRef, useState } from 'react';

const api = (path, opts = {}) => fetch(path, {
  ...opts, headers: { 'content-type': 'application/json', ...opts.headers },
}).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; });

export function useOffice() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let closed = false, retry;
    const load = () => api('/api/state').then(setState).catch(() => {});
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); load(); };
      ws.onclose = () => { setConnected(false); if (!closed) retry = setTimeout(connect, 1500); };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        setState(s => {
          if (!s) return s;
          switch (m.type) {
            case 'employee': return { ...s, employee: m.employee };
            case 'activity': return { ...s, activity: [...s.activity, m.item].slice(-300) };
            case 'run': {
              const isNew = !s.runs.some(r => r.id === m.run.id);
              return { ...s, runs: [m.run, ...s.runs.filter(r => r.id !== m.run.id)], activity: isNew ? [] : s.activity };
            }
            case 'leads': return { ...s, leads: m.leads };
            case 'config': return { ...s, config: m.config };
            case 'usage': return { ...s, usage: m.usage };
            default: return s;
          }
        });
      };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); wsRef.current?.close(); };
  }, []);

  const actions = {
    run: useCallback(instruction => api('/api/run', { method: 'POST', body: JSON.stringify({ instruction }) }), []),
    stop: useCallback(() => api('/api/stop', { method: 'POST' }), []),
    saveConfig: useCallback(patch => api('/api/config', { method: 'PUT', body: JSON.stringify(patch) }), []),
    setLeadStatus: useCallback((id, status) => api(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), []),
    deleteLead: useCallback(id => api(`/api/leads/${id}`, { method: 'DELETE' }), []),
  };

  return { state, connected, actions };
}
