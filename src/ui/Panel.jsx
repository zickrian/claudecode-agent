// The side panel: give orders, watch the real activity, work the leads, set the brief and the schedule.
import { useEffect, useState } from 'react';

const STATUS = {
  working: ['Bekerja', 'working'], idle: ['Istirahat', 'idle'], done: ['Selesai', 'done'], error: ['Ada kendala', 'error'],
};
const ICON = { start: '▶', think: '💭', search: '🔎', page: '📄', browser: '🌐', report: '📋', tool: '🔧' };
const LEAD_STATUS = ['baru', 'dihubungi', 'tertarik', 'tidak cocok'];
const RUN_STATUS = { done: 'Selesai', error: 'Gagal', stopped: 'Dihentikan', working: 'Berjalan' };

const hhmm = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const ago = ms => { const m = Math.floor(ms / 60000); return m < 1 ? `${Math.floor(ms / 1000)} dtk` : m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} jam ${m % 60} mnt`; };

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set(x => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

function EmployeeCard({ state }) {
  useTick();
  const { employee, config, activity, runs } = state;
  const [label, cls] = STATUS[employee.status] || STATUS.idle;
  const cur = employee.status === 'working' ? activity[activity.length - 1] : null;
  const last = runs[0];
  const line = cur ? `${ICON[cur.icon] || ''} ${cur.text}`
    : employee.status === 'working' ? 'Menyiapkan…'
    : employee.status === 'done' && last ? `${last.leadsFound} lead baru ditemukan`
    : employee.status === 'error' && last ? (last.error || last.blocked)
    : null;
  return (
    <div className="emp">
      <div className="emp-top">
        <div className="emp-name">{config.employee.name} <small>{config.employee.role}</small></div>
        <div className={`pill ${cls}`}>{label} · {ago(Date.now() - employee.since)}</div>
      </div>
      {line && <div className="emp-now">{line}</div>}
    </div>
  );
}

function Orders({ state, actions }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const working = state.employee.status === 'working';
  const { auto, brief, employee } = state.config;
  const run = async () => {
    setErr('');
    if (!text.trim() && !brief.offer) { setErr('Tulis perintahnya dulu: jualan apa dan lead seperti apa yang dicari.'); return; }
    try { await actions.run(text); setText(''); } catch (e) { setErr(e.message); }
  };
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = state.leads.filter(l => l.foundAt >= startOfDay.getTime()).length;
  const last = state.runs[0];
  return (
    <div className="section">
      <div className="stats">
        <div><b>{today}</b><span>Hari ini</span></div>
        <div><b>{state.leads.length}</b><span>Total lead</span></div>
        <div><b>{last?.endedAt ? hhmm(last.endedAt) : '—'}</b><span>Terakhir</span></div>
      </div>

      <div className="card">
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder={`Perintah untuk ${employee.name} (opsional)`}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
          disabled={working}
        />
        {working
          ? <button className="danger wide" onClick={() => actions.stop()}>Hentikan</button>
          : <button className="primary wide" onClick={run}>Mulai kerja</button>}
        {err && <div className="err">{err}</div>}
      </div>

      <div className="card row-card">
        <div>
          <b>Jadwal otomatis</b>
          <p>{auto.enabled ? auto.times.join(' · ') : 'Mati'}</p>
        </div>
        <button className={`switch ${auto.enabled ? 'on' : ''}`} aria-label="Jadwal otomatis" onClick={() => actions.saveConfig({ auto: { ...auto, enabled: !auto.enabled } })}><i /></button>
      </div>
    </div>
  );
}

function Activity({ state }) {
  const { activity, runs } = state;
  const run = runs[0];
  return (
    <div className="section">
      {run && (
        <div className="run-head">
          <b>{run.trigger === 'auto' ? 'Jadwal otomatis' : 'Perintah'} · {hhmm(run.startedAt)}</b>
          <span className={`tag ${run.status}`}>{RUN_STATUS[run.status] || run.status}</span>
        </div>
      )}
      {run?.instruction && <div className="quote">“{run.instruction}”</div>}
      <ol className="feed">
        {activity.length === 0 && <li className="empty">Belum ada aktivitas.</li>}
        {[...activity].reverse().map((a, i) => (
          <li key={activity.length - i}>
            <time>{hhmm(a.at)}</time><span className="ic">{ICON[a.icon] || '•'}</span>
            <span className="tx">{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.text}</a> : a.text}</span>
          </li>
        ))}
      </ol>
      {run?.summary && <div className="summary"><b>Laporan:</b> {run.summary}</div>}
      {run?.blocked && <div className="err">Terhenti: {run.blocked}</div>}
      {run?.error && run.status === 'error' && <div className="err">{run.error}</div>}

      {runs.length > 1 && <>
        <label className="lbl" style={{ marginTop: 18 }}>Riwayat kerja</label>
        <ul className="history">
          {runs.slice(1, 12).map(r => (
            <li key={r.id}>
              <span>{new Date(r.startedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {hhmm(r.startedAt)}</span>
              <span className={`tag ${r.status}`}>{RUN_STATUS[r.status] || r.status}</span>
              <span>{r.leadsFound ?? 0} lead</span>
              <span>{r.durationMs ? ago(r.durationMs) : ''}</span>
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}

function Leads({ state, actions }) {
  const [filter, setFilter] = useState('semua');
  const list = state.leads.filter(l => filter === 'semua' || l.status === filter);
  return (
    <div className="section">
      <div className="row between">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="semua">Semua ({state.leads.length})</option>
          {LEAD_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <a className="btn ghost small" href="/api/leads.csv">⬇ Export CSV</a>
      </div>
      {list.length === 0 && <div className="empty">Belum ada lead.</div>}
      {list.map(l => (
        <div className="lead" key={l.id}>
          <div className="lead-top">
            <div>
              <b>{l.name}</b> {l.handle && <span className="muted">@{l.handle.replace(/^@/, '')}</span>}
              <div className="stars" title={`skor ${l.score}/5`}>{'★'.repeat(l.score || 0)}<span>{'★'.repeat(5 - (l.score || 0))}</span></div>
            </div>
            <select value={l.status} onChange={e => actions.setLeadStatus(l.id, e.target.value)}>
              {LEAD_STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="need">{l.need}</div>
          {l.quote && <div className="quote">“{l.quote}”</div>}
          <div className="why">{l.why}</div>
          <div className="lead-foot">
            {l.profile_url && <a href={l.profile_url} target="_blank" rel="noreferrer">Profil ↗</a>}
            {l.post_url && <a href={l.post_url} target="_blank" rel="noreferrer">Postingan ↗</a>}
            {l.location && <span className="muted">📍 {l.location}</span>}
            <span className="muted">{new Date(l.foundAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
            <button className="link" onClick={() => actions.deleteLead(l.id)}>hapus</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Settings({ state, actions }) {
  const [c, setC] = useState(state.config);
  const [saved, setSaved] = useState(false);
  useEffect(() => setC(state.config), [state.config]);
  const set = (path, value) => setC(prev => {
    const next = structuredClone(prev); const keys = path.split('.'); let o = next;
    keys.slice(0, -1).forEach(k => { o = o[k]; }); o[keys.at(-1)] = value; return next;
  });
  const save = async () => { await actions.saveConfig(c); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return (
    <div className="section form">
      <label className="lbl">Karyawan</label>
      <div className="grid2">
        <input value={c.employee.name} onChange={e => set('employee.name', e.target.value)} placeholder="Nama" />
        <input value={c.employee.role} onChange={e => set('employee.role', e.target.value)} placeholder="Jabatan" />
      </div>
      <label className="lbl">Kita jualan apa?</label>
      <textarea rows={2} value={c.brief.offer} onChange={e => set('brief.offer', e.target.value)} placeholder="cth: jasa pembuatan website & landing page untuk UMKM" />
      <label className="lbl">Lead yang dicari</label>
      <textarea rows={2} value={c.brief.target} onChange={e => set('brief.target', e.target.value)} placeholder="cth: pemilik usaha yang lagi cari jasa bikin website atau toko online" />
      <label className="lbl">Keyword awal (pisah koma)</label>
      <input value={c.brief.keywords.join(', ')} onChange={e => set('brief.keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="butuh jasa website, rekomendasi bikin web, cari web developer" />
      <div className="grid2">
        <div><label className="lbl">Lokasi</label><input value={c.brief.location} onChange={e => set('brief.location', e.target.value)} /></div>
        <div><label className="lbl">Target per kerja</label><input type="number" min={1} max={50} value={c.brief.perRun} onChange={e => set('brief.perRun', Number(e.target.value))} /></div>
      </div>
      <label className="lbl">Cara kerja</label>
      <select value={c.browser ? 'chrome' : 'web'} onChange={e => set('browser', e.target.value === 'chrome')}>
        <option value="chrome">Browsing Threads di Chrome (akun login)</option>
        <option value="web">Web search saja (tanpa login)</option>
      </select>
      <label className="lbl">Jam jadwal otomatis (pisah koma)</label>
      <input value={c.auto.times.join(', ')} onChange={e => set('auto.times', e.target.value.split(',').map(s => s.trim()).filter(s => /^\d{2}:\d{2}$/.test(s)))} placeholder="09:00, 15:00" />
      <div className="row">
        <button className="primary" onClick={save}>{saved ? '✓ Tersimpan' : 'Simpan'}</button>
      </div>
      <p className="muted small">Mesin: Claude {state.model?.label} · effort {state.model?.effort}. Mode baca saja: tidak like, follow, komentar, atau DM.</p>
    </div>
  );
}

export function Panel({ state, actions, tab, setTab }) {
  const tabs = [['perintah', 'Tugas'], ['aktivitas', 'Aktivitas'], ['leads', `Leads (${state.leads.length})`], ['pengaturan', 'Pengaturan']];
  return (
    <aside className="panel">
      <EmployeeCard state={state} />
      <nav className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      <div className="tab-body">
        {tab === 'perintah' && <Orders state={state} actions={actions} />}
        {tab === 'aktivitas' && <Activity state={state} />}
        {tab === 'leads' && <Leads state={state} actions={actions} />}
        {tab === 'pengaturan' && <Settings state={state} actions={actions} />}
      </div>
    </aside>
  );
}
