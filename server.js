// Akkreditatsiya dashboard — live server (Render uchun)
// Bog'liqliklarsiz: faqat Node.js 18+ kerak.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUSH_TOKEN = process.env.PUSH_TOKEN || '';            // Render > Environment da o'rnating
const SEED_URL = process.env.SEED_URL || 'https://new.atmu.uz/';
const DEADLINE = process.env.DEADLINE || '2026-09-28T23:59:00+05:00';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

let STATE = { D: null, updatedAt: null, source: null };

function log(...a) { console.log(new Date().toISOString(), ...a); }

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(STATE));
  } catch (e) { log('save error', e.message); }
}

function loadLocal() {
  try {
    const s = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (s && s.D) { STATE = s; log('data.json dan yuklandi', s.updatedAt); return true; }
  } catch (e) { /* yo'q */ }
  return false;
}

// new.atmu.uz (yoki boshqa statik nusxa) ichidagi "const D = {...}" ni o'qib olish
let lastSeedJson = null;
async function seedFromUrl(force) {
  try {
    const html = await fetch(SEED_URL, { headers: { 'cache-control': 'no-cache' } }).then(r => r.text());
    const a = html.indexOf('const D = ');
    const b = html.indexOf('\nconst LBL', a);
    if (a < 0 || b < 0) throw new Error('D topilmadi');
    const json = html.slice(a + 'const D = '.length, b).trim().replace(/;$/, '');
    if (!force && json === lastSeedJson) return;
    lastSeedJson = json;
    const D = JSON.parse(json);
    STATE = { D, updatedAt: new Date().toISOString(), source: 'seed:' + SEED_URL };
    save();
    log('Boshlang‘ich maʼlumot olindi:', SEED_URL, (D.programs || []).length, 'dastur');
  } catch (e) { log('seed xato:', e.message); }
}

// Userscript yuborgan maʼlumotni birlashtirish
function merge(body) {
  if (!STATE.D) STATE.D = { complex: null, programs: [], titles: { c: {}, p: {} }, chapters: { c: {}, p: {} } };
  const D = STATE.D;
  if (body.titles) { D.titles.c = { ...D.titles.c, ...(body.titles.c || {}) }; D.titles.p = { ...D.titles.p, ...(body.titles.p || {}) }; }
  if (body.chapters) { D.chapters.c = { ...D.chapters.c, ...(body.chapters.c || {}) }; D.chapters.p = { ...D.chapters.p, ...(body.chapters.p || {}) }; }
  const full = rows => (rows || []).filter(r => r[1] === 0).length;
  if (body.complex && body.complex.rows) {
    const old = D.complex;
    const c = { ...body.complex };
    if (old && old.rows) { const of = full(old.rows), nf = full(c.rows); c.prev = of !== nf ? of : old.prev; }
    D.complex = c;
  }
  if (Array.isArray(body.programs)) {
    for (const p of body.programs) {
      const i = D.programs.findIndex(x => String(x.id) === String(p.id));
      if (i < 0) { D.programs.push(p); continue; }
      const old = D.programs[i];
      const np = { ...old, ...p };
      if (p.rows && old.rows) { const of = full(old.rows), nf = full(p.rows); np.prev = of !== nf ? of : old.prev; }
      D.programs[i] = np;
    }
  }
  STATE.updatedAt = new Date().toISOString();
  STATE.source = 'push';
  save();
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-token',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function page() {
  const safe = s => JSON.stringify(s).replace(/</g, '\\u003c');
  const meta = { updatedAt: STATE.updatedAt, source: STATE.source, deadline: DEADLINE };
  const D = STATE.D || { complex: { rows: [], ex: [], concl: 0 }, programs: [], titles: { c: {}, p: {} }, chapters: { c: {}, p: {} } };
  return TEMPLATE.replace('/*__DATA__*/', `const D = ${safe(D)};\nconst META = ${safe(meta)};`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return send(res, 200, page(), 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/api/version') return send(res, 200, { updatedAt: STATE.updatedAt, source: STATE.source });
  if (req.method === 'GET' && url.pathname === '/api/data') return send(res, 200, STATE);
  if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
  if (req.method === 'POST' && url.pathname === '/api/push') {
    if (!PUSH_TOKEN || req.headers['x-token'] !== PUSH_TOKEN) return send(res, 401, { error: 'token noto‘g‘ri' });
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 20e6) req.destroy(); });
    req.on('end', () => {
      try { merge(JSON.parse(raw)); log('push qabul qilindi'); send(res, 200, { ok: true, updatedAt: STATE.updatedAt }); }
      catch (e) { send(res, 400, { error: e.message }); }
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/reseed') {
    if (!PUSH_TOKEN || req.headers['x-token'] !== PUSH_TOKEN) return send(res, 401, { error: 'token noto‘g‘ri' });
    await seedFromUrl(true); return send(res, 200, { ok: true, updatedAt: STATE.updatedAt });
  }
  send(res, 404, { error: 'topilmadi' });
});

(async () => {
  if (!loadLocal()) await seedFromUrl(true);
  server.listen(PORT, () => log('Server ishga tushdi, port', PORT));
  // Har 5 daqiqada manbani tekshirish (userscript orqali push kelgan bo'lsa, 6 soat davomida tegilmaydi)
  const POLL_MIN = +(process.env.SEED_POLL_MIN || 5);
  if (POLL_MIN > 0) setInterval(() => {
    const pushedRecently = STATE.source === 'push' && Date.now() - new Date(STATE.updatedAt) < 6 * 36e5;
    if (!pushedRecently) seedFromUrl(false);
  }, POLL_MIN * 60e3);
})();
