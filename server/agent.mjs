// The employee's brain: one `claude -p` run per job, on the owner's Claude Code login.
// Every line Claude Code streams back becomes a real activity item — nothing here is simulated.
import { spawn } from 'node:child_process';
import { WORKSPACE } from './store.mjs';

// The employee always runs on Sonnet 5.5 at medium effort: good judgement, light on the plan's limits.
export const MODEL = { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', effort: 'medium' };

const LEAD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Ringkasan singkat (Bahasa Indonesia) apa yang dikerjakan dan ditemukan' },
    blocked: { type: 'string', description: 'Kosong jika lancar; jika terhenti (login, CAPTCHA, akses ditolak), jelaskan di sini' },
    leads: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          handle: { type: 'string', description: 'Username Threads, tanpa @' },
          profile_url: { type: 'string' },
          post_url: { type: 'string', description: 'Link postingan yang jadi bukti' },
          quote: { type: 'string', description: 'Kutipan kata-kata dia sendiri yang menunjukkan dia sedang mencari/butuh (bukan menawarkan)' },
          need: { type: 'string', description: 'Apa yang dia cari/butuhkan' },
          why: { type: 'string', description: 'Kenapa ini lead yang bagus' },
          score: { type: 'integer', minimum: 1, maximum: 5 },
          location: { type: 'string' },
        },
        required: ['name', 'profile_url', 'quote', 'need', 'why', 'score'],
      },
    },
  },
  required: ['summary', 'leads'],
};

const BROWSER_READ_TOOLS = [
  'navigate', 'read_page', 'get_page_text', 'find', 'computer', 'browser_batch',
  'tabs_context_mcp', 'tabs_create_mcp', 'tabs_close_mcp', 'list_connected_browsers', 'select_browser',
].map(t => `mcp__claude-in-chrome__${t}`);
const BROWSER_BLOCKED_TOOLS = [
  'form_input', 'file_upload', 'upload_image', 'javascript_tool', 'shortcuts_execute', 'gif_creator',
].map(t => `mcp__claude-in-chrome__${t}`);

function systemPrompt(cfg) {
  const { employee, brief } = cfg;
  return `You are ${employee.name}, the ${employee.role} at a small Indonesian company. Your only job: find people on Threads who NEED what we sell (potential customers), so we can offer it to them.

What we sell: ${brief.offer || "(not set: read it from the owner's task)"}
Who a good lead is: ${brief.target || "(not set: read it from the owner's task)"}
Location focus: ${brief.location || 'any'}

The core rule: find people who NEED it, never people who OFFER it.
- The owner's task names what WE sell. "cari jasa website" or "vendor packaging" means: find people who need a website or packaging. It never means: find website services or packaging vendors.
- A lead is a post whose author wants to get what we sell, for themselves or their business: asking for it, looking for a vendor, asking for recommendations or prices. Typical words: "cari", "butuh", "ada yang bisa bikinin…?", "rekomendasi … dong", "spill vendor …", "berapa ya harga …?", "di mana ya bisa …?", "minta pricelist/MOQ", "DM harga dan portofolio kalian".
- Not a lead: anyone offering it. Vendors, agencies, freelancers, shops, printers and resellers are competitors. Ad signs: a post that opens with "Jasa …", "open order", "terima pesanan", "melayani", "kami menyediakan", "harga mulai Rp…", "promo", "order via WA/DM", "cek katalog di bio", "free konsultasi", "siap bantu".
- Watch for ads phrased as questions. "Butuh website? DM aja!" and "Ada yang butuh jasa packaging?" are sellers fishing for buyers. "Ada yang bisa bikin website?" is a buyer.
- Also not a lead: providers looking for work ("open slot", "available for project", "cari klien"), companies recruiting resellers or full-time staff, giveaways, tips and tutorials, and people who already found a vendor.
- Judge each person by their own words. Under a buyer's post, most replies are sellers pitching: skip them. A reply counts only if that person says they need it too.
- A business that sells something else is fine: a skincare brand asking for custom boxes is a great lead. Skip only accounts that sell the same thing we do.
- When unsure, open the profile. If the bio is a storefront for what we sell (e.g. "Jasa desain | Order via WA"), skip it. Still unsure? Leave it out. A short list of real buyers beats a long list padded with sellers.

How you work:
- Search the way a buyer writes, not the way a seller advertises. Bare terms ("jasa website", "vendor packaging", "custom box") mostly return ads. Pair the need with buyer words: "cari jasa website", "butuh website", "rekomendasi jasa bikin website", "ada yang bisa bikin website", "spill vendor packaging", "harga bikin website berapa". Try many variations.
- ${cfg.browser
    ? 'Use the Chrome browser tools. The owner is already signed in to Threads in that Chrome. Open https://www.threads.com/search?q=<keyword>&serp_type=default (use the "Recent" tab when available), read posts, and open profiles to check them. If no browser is connected or the browser tools fail, do not stop: fall back to web search: WebFetch https://www.threads.com/tag/<keyword-with-dashes> (tag pages list recent public posts without login) and WebSearch for threads.com posts and mention the fallback in the summary.'
    : 'Use WebFetch on https://www.threads.com/tag/<keyword-with-dashes> (tag pages list recent public posts without login) and WebSearch for threads.com posts.'} Hashtags are mostly sellers' ads, so read tag pages with extra care.
- Recent posts beat old ones.
- READ ONLY. Never like, follow, reply, repost, DM, post or type into anything. Never log in or fill forms.
- If you hit a login wall, a CAPTCHA, or a checkpoint: stop and explain it in "blocked".
- Only report leads you actually saw. Every lead needs a real profile_url (and post_url when you have it). Never invent names, handles or links.
- Close any tab you opened when you are done.
- Write summary, need and why in Bahasa Indonesia.`;
}

function taskPrompt(cfg, instruction, knownHandles) {
  const { brief } = cfg;
  const lines = [
    instruction?.trim() || `Cari sekitar ${brief.perRun} lead baru di Threads.`,
    brief.keywords?.length ? `Keyword awal: ${brief.keywords.join(', ')}` : '',
    knownHandles.length ? `Sudah pernah ditemukan (lewati): ${knownHandles.slice(0, 150).join(', ')}` : '',
  ];
  return lines.filter(Boolean).join('\n\n');
}

// Turn one streamed tool call into a sentence the owner can read on the employee's screen.
function describeTool(name, input = {}) {
  const host = u => { try { const x = new URL(u); return x.host + x.pathname + x.search; } catch { return u; } };
  if (name === 'WebSearch') return { icon: 'search', text: `Mencari di web: "${input.query}"` };
  if (name === 'WebFetch') return { icon: 'page', text: `Membuka halaman: ${host(input.url)}`, url: input.url };
  if (name === 'StructuredOutput') return { icon: 'report', text: 'Menyusun laporan leads' };
  const chrome = name.replace('mcp__claude-in-chrome__', '');
  if (chrome !== name) {
    if (chrome === 'navigate') return { icon: 'browser', text: `Browser → ${host(input.url)}`, url: input.url };
    if (chrome === 'browser_batch') { // several browser steps at once: show the page it goes to, if any
      const url = JSON.stringify(input).match(/https?:\/\/[^"\\\s]+/)?.[0];
      return url ? { icon: 'browser', text: `Browser → ${host(url)}`, url } : { icon: 'browser', text: 'Membaca halaman di browser' };
    }
    if (chrome === 'computer') {
      const a = input.action || '';
      if (a === 'scroll') return { icon: 'browser', text: 'Scroll halaman' };
      if (a === 'screenshot') return { icon: 'browser', text: 'Melihat layar browser' };
      if (/click/.test(a)) return { icon: 'browser', text: 'Klik di halaman' };
      return { icon: 'browser', text: `Browser: ${a || 'aksi'}` };
    }
    if (chrome === 'get_page_text' || chrome === 'read_page') return { icon: 'browser', text: 'Membaca isi halaman' };
    if (chrome === 'find') return { icon: 'browser', text: `Mencari di halaman: "${input.query || ''}"` };
    if (chrome.startsWith('tabs_')) return { icon: 'browser', text: chrome === 'tabs_create_mcp' ? 'Membuka tab baru' : chrome === 'tabs_close_mcp' ? 'Menutup tab' : 'Mengecek tab browser' };
    return { icon: 'browser', text: `Browser: ${chrome}` };
  }
  return { icon: 'tool', text: `Pakai tool: ${name}` };
}

export function runLeadHunt({ cfg, instruction, knownHandles = [], onActivity, onRateLimit }) {
  const args = [
    '-p', taskPrompt(cfg, instruction, knownHandles),
    '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--model', MODEL.id, '--effort', MODEL.effort,
    '--system-prompt', systemPrompt(cfg),
    '--json-schema', JSON.stringify(LEAD_SCHEMA),
    '--strict-mcp-config',                       // none of the owner's other connectors (Gmail, Drive…)
    '--tools', 'WebSearch,WebFetch',             // built-ins: web only — no shell, no files
    '--allowedTools', ['WebSearch', 'WebFetch', ...(cfg.browser ? BROWSER_READ_TOOLS : [])].join(','),
    ...(cfg.browser ? ['--chrome', '--disallowedTools', BROWSER_BLOCKED_TOOLS.join(',')] : ['--no-chrome']),
  ];

  // Run on the Claude subscription login: drop any API key so nothing is billed to it,
  // and CLAUDECODE so the CLI starts even when this server was launched from Claude Code.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE;

  const child = spawn('claude', args, { cwd: WORKSPACE, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let buffer = '', stderr = '', result = null;
  const emit = item => onActivity({ at: Date.now(), ...item });

  const handle = line => {
    let e; try { e = JSON.parse(line); } catch { return; }
    if (e.type === 'system' && e.subtype === 'init') {
      emit({ icon: 'start', text: `Mulai kerja (${e.model}${e.mcp_servers?.some(s => s.name === 'claude-in-chrome' && s.status === 'connected') ? ', Chrome tersambung' : ''})` });
    } else if (e.type === 'assistant') {
      for (const c of e.message?.content || []) {
        if (c.type === 'text' && c.text.trim()) emit({ icon: 'think', text: c.text.trim().slice(0, 280) });
        if (c.type === 'tool_use') emit(describeTool(c.name, c.input));
      }
    } else if (e.type === 'rate_limit_event') {
      onRateLimit?.(e.rate_limit_info);
    } else if (e.type === 'result') {
      result = e;
    }
  };

  child.stdout.on('data', d => {
    buffer += d;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) { handle(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
  });
  child.stderr.on('data', d => { stderr += d; });

  const done = new Promise(resolve => {
    child.on('close', code => {
      if (buffer.trim()) handle(buffer);
      const out = result?.structured_output || {};
      resolve({
        ok: !!result && !result.is_error,
        stopped: child.killed,
        summary: out.summary || '',
        blocked: out.blocked || '',
        leads: Array.isArray(out.leads) ? out.leads : [],
        turns: result?.num_turns,
        durationMs: result?.duration_ms,
        tokens: result?.usage ? (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0)
          + (result.usage.cache_read_input_tokens || 0) + (result.usage.cache_creation_input_tokens || 0) : null,
        error: result?.is_error ? String(result.result || 'Claude Code error') : (!result ? (stderr.trim().slice(-400) || `claude exited with code ${code}`) : ''),
      });
    });
    child.on('error', err => resolve({ ok: false, leads: [], error: `Tidak bisa menjalankan claude: ${err.message}` }));
  });

  return { done, stop: () => child.kill('SIGTERM') };
}
