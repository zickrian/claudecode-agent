// What the employee's monitor and the wall TV show, drawn on canvases every frame they change.
// Only real data goes on screen: the run's streamed activity, the leads file, the schedule.
import * as THREE from 'three';

export function makeScreen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

const FONT = '"Inter", "Segoe UI", system-ui, sans-serif';
const ICON = { start: '▶', think: '💭', search: '🔎', page: '📄', browser: '🌐', report: '📋', tool: '🔧' };
const time = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(n === maxLines - 1 ? line + '…' : line, x, y + n * lineH);
      if (++n >= maxLines) return n;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + n * lineH), n++;
  return n;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

// The employee's monitor: a browser-like window while working, a calm lock screen on a break.
export function drawMonitor({ ctx, canvas }, { employee, activity, config, lastRun, now }) {
  const W = canvas.width, H = canvas.height;
  const name = config?.employee?.name || 'Karyawan';
  ctx.clearRect(0, 0, W, H);

  if (employee?.status === 'working') {
    // window chrome
    ctx.fillStyle = '#0f1720'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b2632'; ctx.fillRect(0, 0, W, 64);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(34 + i * 30, 32, 9, 0, Math.PI * 2); ctx.fill(); });
    const cur = activity[activity.length - 1];
    ctx.fillStyle = '#263443'; roundRect(ctx, 140, 14, W - 170, 36, 18); ctx.fill();
    ctx.fillStyle = '#9fb3c8'; ctx.font = `22px ${FONT}`;
    ctx.fillText((cur?.url ? cur.url.replace(/^https?:\/\//, '') : 'claude code · ' + name.toLowerCase()).slice(0, 70), 160, 40);

    // the current step, big
    ctx.fillStyle = '#5eead4'; ctx.font = `600 22px ${FONT}`;
    ctx.fillText('SEDANG DIKERJAKAN', 40, 112);
    ctx.fillStyle = '#f1f5f9'; ctx.font = `600 38px ${FONT}`;
    wrap(ctx, cur ? `${ICON[cur.icon] || '•'} ${cur.text}` : 'Menyiapkan…', 40, 162, W - 80, 46, 3);

    // the trail of real steps
    ctx.fillStyle = '#334155'; ctx.fillRect(40, 312, W - 80, 2);
    ctx.font = `24px ${FONT}`;
    const recent = activity.slice(-5, -1).reverse(); // four lines fit above the footer
    recent.forEach((a, i) => {
      const y = 356 + i * 40;
      ctx.globalAlpha = 1 - i * 0.18;
      ctx.fillStyle = '#64748b'; ctx.fillText(time(a.at).slice(0, 5), 40, y);
      ctx.fillStyle = '#cbd5e1'; ctx.fillText(`${ICON[a.icon] || '•'} ${a.text}`.slice(0, 58), 130, y);
    });
    ctx.globalAlpha = 1;
    // blinking cursor + step count
    ctx.fillStyle = '#64748b'; ctx.font = `20px ${FONT}`;
    ctx.fillText(`${activity.length} langkah · ${Math.floor((now - employee.since) / 60000)} mnt`, 40, H - 28);
    if (Math.floor(now / 500) % 2) { ctx.fillStyle = '#5eead4'; ctx.fillRect(W - 60, H - 46, 16, 26); }
    return;
  }

  // lock screen: a flat landscape wallpaper, the clock, and the last real outcome
  ctx.fillStyle = '#20303d'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e9b965'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.3, 46, 0, Math.PI * 2); ctx.fill();
  const hills = (color, base, peaks) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    ctx.lineTo(0, base);
    peaks.forEach(([x, y]) => ctx.lineTo(x * W, y));
    ctx.lineTo(W, base); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  };
  hills('#2c4652', 400, [[0.18, 330], [0.36, 380], [0.58, 300], [0.8, 370], [1, 340]]);
  hills('#2f5a5e', 450, [[0.12, 420], [0.3, 390], [0.5, 440], [0.72, 400], [0.9, 430]]);
  hills('#357069', 500, [[0.2, 480], [0.45, 470], [0.7, 495], [1, 470]]);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `300 112px ${FONT}`;
  ctx.fillText(new Date(now).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), W / 2, 205);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `26px ${FONT}`;
  ctx.fillText(new Date(now).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }), W / 2, 250);

  const line = employee?.status === 'done' && lastRun ? `Selesai · ${lastRun.leadsFound} lead baru`
    : employee?.status === 'error' ? 'Ada kendala · cek panel'
    : `${name} sedang istirahat`;
  ctx.font = `600 22px ${FONT}`;
  const w = ctx.measureText(line).width + 44;
  ctx.fillStyle = 'rgba(15,26,36,0.55)'; roundRect(ctx, W / 2 - w / 2, 282, w, 42, 21); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillText(line, W / 2, 310);
  ctx.textAlign = 'left';

  // taskbar
  ctx.fillStyle = 'rgba(12,20,28,0.8)'; ctx.fillRect(0, H - 44, W, 44);
  ['#5eead4', '#93c5fd', '#fbbf24', '#e2e8f0'].forEach((c, i) => {
    ctx.fillStyle = c; roundRect(ctx, W / 2 - 74 + i * 40, H - 34, 24, 24, 6); ctx.fill();
  });
}

// The wall TV: the office at a glance, straight from the leads file and the runs.
export function drawTv({ ctx, canvas }, { leads, runs, config, employee, now }) {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const today = leads.filter(l => l.foundAt >= startOfDay.getTime()).length;
  const hot = leads.filter(l => (l.score || 0) >= 4).length;

  ctx.fillStyle = '#94a3b8'; ctx.font = `600 26px ${FONT}`;
  ctx.fillText('PERUSHAAN AI · LEADS', 48, 64);
  ctx.textAlign = 'right';
  ctx.fillText(new Date(now).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }), W - 48, 64);
  ctx.textAlign = 'left';

  const tile = (x, label, value, color) => {
    ctx.fillStyle = '#111c2e'; roundRect(ctx, x, 100, 280, 190, 18); ctx.fill();
    ctx.fillStyle = color; ctx.font = `700 96px ${FONT}`; ctx.fillText(String(value), x + 28, 215);
    ctx.fillStyle = '#94a3b8'; ctx.font = `24px ${FONT}`; ctx.fillText(label, x + 28, 262);
  };
  tile(48, 'lead hari ini', today, '#5eead4');
  tile(352, 'total lead', leads.length, '#e2e8f0');
  tile(656, 'skor 4–5', hot, '#fbbf24');

  // newest leads
  ctx.font = `26px ${FONT}`;
  leads.slice(0, 3).forEach((l, i) => {
    const y = 350 + i * 44;
    ctx.fillStyle = '#e2e8f0'; ctx.fillText(`${l.name}`.slice(0, 26), 48, y);
    ctx.fillStyle = '#64748b'; ctx.fillText(`${l.need || ''}`.slice(0, 40), 400, y);
  });
  if (!leads.length) { ctx.fillStyle = '#64748b'; ctx.fillText('Belum ada lead. Kasih perintah dari panel →', 48, 360); }

  // status + schedule strip
  const st = { working: ['● Bekerja', '#5eead4'], idle: ['● Istirahat', '#93c5fd'], done: ['● Selesai', '#fbbf24'], error: ['● Ada kendala', '#f87171'] }[employee?.status] || ['●', '#94a3b8'];
  ctx.fillStyle = '#111c2e'; ctx.fillRect(0, H - 70, W, 70);
  ctx.fillStyle = st[1]; ctx.font = `600 26px ${FONT}`;
  ctx.fillText(`${config?.employee?.name || ''} ${st[0]}`, 48, H - 26);
  ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right';
  const last = runs[0];
  ctx.fillText(config?.auto?.enabled ? `Otomatis: ${config.auto.times.join(' · ')}` : last?.endedAt ? `Terakhir: ${time(last.endedAt).slice(0, 5)}` : 'Jadwal otomatis mati', W - 48, H - 26);
  ctx.textAlign = 'left';
}
