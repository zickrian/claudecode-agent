// Top-left of the office: the Claude plan's 5-hour and weekly limits (same numbers as /usage in Claude Code).
const resets = t => {
  if (!t) return '';
  const d = new Date(Math.round(t / 60000) * 60000); // resets land on xx:59:59.9
  const sameDay = d.toDateString() === new Date().toDateString();
  return `reset ${sameDay ? '' : d.toLocaleDateString('id-ID', { weekday: 'short' }) + ' '}${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};

function Meter({ label, w }) {
  const pct = w?.pct ?? null;
  const level = pct == null ? '' : pct >= 90 ? 'high' : pct >= 70 ? 'mid' : '';
  return (
    <div className="ub-meter" title={resets(w?.resetsAt)}>
      <div className="ub-row"><span>{label}</span><b>{pct == null ? '—' : `${pct}%`}</b></div>
      <div className="meter-track"><i className={level} style={{ width: `${Math.min(100, pct || 0)}%` }} /></div>
    </div>
  );
}

export function UsageBadge({ usage, connected }) {
  return (
    <div className="usage-badge">
      <i className={`ub-dot ${connected ? 'on' : ''}`} title={connected ? 'Tersambung' : 'Terputus'} />
      <Meter label="5 jam" w={usage?.fiveHour} />
      <Meter label={usage?.week?.scope ? `Mingguan · ${usage.week.scope}` : 'Mingguan'} w={usage?.week} />
    </div>
  );
}
