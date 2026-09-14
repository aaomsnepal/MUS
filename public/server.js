/* ═══════════════════════════════════════════════════════════════
   kkpramod.com.np  ·  aaomsPrint System
   Plain Node.js + Express. No database, no build step.
   Runs as-is on HostingRaja Node application.
       Startup command : node server.js
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── load .env if present (no dependency needed) ──
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i < 1) return;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    });
  }
} catch (e) { /* .env is optional */ }

const app = express();
const PORT = process.env.PORT || 3002;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const PIN = process.env.SITE_PIN || 'Aadya@108atharva';
const AGENT_KEY = process.env.AGENT_KEY || 'aaoms-print-agent';
const sessions = new Set();

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

app.use(express.json({ limit: '60mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));

/* ───────────────────────── helpers ───────────────────────── */
function readJson(name, fb) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); }
  catch { return fb; }
}
function writeJson(name, data) {
  const tmp = path.join(DATA, name + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, path.join(DATA, name));
}
function uid(prefix) {
  return (prefix || '') + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}
function nowISO() { return new Date().toISOString(); }

/* ─────────────────── seed files (first run) ──────────────── */
const DEFAULT_PRINTERS = [
  { id: 'evolis-primacy', brand: 'Evolis', model: 'Primacy', dpi: 300, duplex: true,
    ribbon: 'YMCKO', bleedMm: 1.0, offsetX: 0, offsetY: 0, magstripe: true, rfid: true,
    owned: true, notes: 'In-house printer at AAOMS Nepal.' },
  { id: 'zebra-zc300', brand: 'Zebra', model: 'ZC300 / ZXP Series', dpi: 300, duplex: true,
    ribbon: 'YMCKO', bleedMm: 1.0, offsetX: 0, offsetY: 0, magstripe: true, rfid: true,
    owned: false, notes: 'Edge-to-edge printing, laminate on ZXP 8/9.' },
  { id: 'fargo-dtc1250e', brand: 'Fargo / HID', model: 'DTC1250e / DTC4500e', dpi: 300, duplex: true,
    ribbon: 'YMCKO', bleedMm: 1.2, offsetX: 0, offsetY: 0, magstripe: true, rfid: true,
    owned: false, notes: 'HID Global. Resin K panel gives very sharp black text.' },
  { id: 'magicard-300', brand: 'Magicard', model: '300 / Rio Pro 360', dpi: 300, duplex: true,
    ribbon: 'YMCKO', bleedMm: 1.0, offsetX: 0, offsetY: 0, magstripe: true, rfid: true,
    owned: false, notes: 'HoloKote security watermark built in.' },
  { id: 'nisca-c101', brand: 'Nisca', model: 'PR-C101 / PR-C201', dpi: 300, duplex: true,
    ribbon: 'YMCKO', bleedMm: 0.8, offsetX: 0, offsetY: 0, magstripe: true, rfid: false,
    owned: false, notes: 'Compact desktop unit, common in Nepal / India offices.' }
];

const DEFAULT_PRICING = {
  currency: 'NPR',
  symbol: 'रु',
  base: { single: 120, double: 180 },
  designFee: 500,
  designFeeWaivedAt: 100,
  deliveryFee: 0,
  tiers: [
    { minQty: 1, label: '1 – 24', mult: 1 },
    { minQty: 25, label: '25 – 49', mult: 0.94 },
    { minQty: 50, label: '50 – 99', mult: 0.88 },
    { minQty: 100, label: '100 – 249', mult: 0.8 },
    { minQty: 250, label: '250 – 499', mult: 0.74 },
    { minQty: 500, label: '500 +', mult: 0.68 }
  ],
  options: [
    { id: 'lamination', label: 'Lamination / overlay', price: 40 },
    { id: 'magstripe', label: 'Magnetic stripe', price: 60 },
    { id: 'rfid', label: 'RFID / smart chip', price: 150 },
    { id: 'lanyard', label: 'Lanyard', price: 60 },
    { id: 'holder', label: 'Card holder', price: 35 },
    { id: 'punch', label: 'Slot punch', price: 5 },
    { id: 'rush', label: 'Rush (24 hr)', price: 25 }
  ],
  vatPercent: 13,
  vatIncluded: false
};

function seed(name, data) {
  if (!fs.existsSync(path.join(DATA, name))) writeJson(name, data);
}
seed('printers.json', DEFAULT_PRINTERS);
seed('pricing.json', DEFAULT_PRICING);
seed('clients.json', []);
seed('jobs.json', []);
seed('designs.json', []);
seed('settings.json', {
  nepal: { esewa: '', khalti: '', bank: { bank: '', branch: '', name: '', account: '' }, qr: '' },
  site: { title: '', description: '' },
  eaaoms: {
    pin: 'Aadya@108atharva',
    url: 'https://aaomsnepal.netlify.app/billing.dc'
  }
});

/* ═══════════════ ORIGINAL TERMINAL BRAIN (unchanged) ═══════════ */
function answerQuestion(q) {
  const kb = readJson('knowledge.json', { qa: [] });
  const text = String(q || '').toLowerCase().trim();
  if (!text) return 'Ask something — or type help.';
  if (text === 'help' || text === '?' || text === 'menu') {
    const help = (kb.qa || []).find(x => (x.keys || []).includes('help'));
    return help ? help.answer : 'Type about, aaomsDigital, nepal, india, print, evolis, tech, gurukul, contact…';
  }
  let best = null;
  let bestScore = 0;
  const list = kb.qa || [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    let score = 0;
    const keys = item.keys || [];
    for (let j = 0; j < keys.length; j++) {
      const k = keys[j];
      if (k && text.includes(k)) score += k.length;
    }
    if (score > bestScore) { bestScore = score; best = item; if (bestScore >= 24) break; }
  }
  if (best && bestScore > 0) return best.answer;
  if (/hello|hi|namaste|hey/.test(text)) {
    return `Namaste. I'm the kkpramod robotic terminal for ${kb.identity?.name || 'Pramod KK'}. Type help or ask about aaomsDigital, Evolis print, Gurukul, Nepal, India, or contact.`;
  }
  return `No precise match yet. Try: help · about · aaomsDigital · nepal · india · print · evolis · tech · gurukul · contact · politics\nOr WhatsApp +9779803840868 / ${kb.identity?.email || 'hello@kkpramod.com.np'}`;
}

app.get('/api/boot', (req, res) => {
  const kb = readJson('knowledge.json', {});
  res.json({ lines: kb.bootLines || [], identity: kb.identity || {}, tagline: kb.identity?.tagline });
});

app.get('/api/stream', (req, res) => {
  const kb = readJson('knowledge.json', {});
  res.json({ lines: kb.streamLines || [] });
});

app.post('/api/ask', (req, res) => {
  const q = req.body?.q || req.body?.question || '';
  res.json({ answer: answerQuestion(q) });
});

/* ═════════════════════════ AUTH ════════════════════════════ */
app.post('/api/admin/login', (req, res) => {
  if (String(req.body.pin || '') !== PIN) return res.status(401).json({ error: 'Wrong PIN' });
  const token = crypto.randomBytes(20).toString('hex');
  sessions.add(token);
  res.json({ token });
});

function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'];
  if (t && sessions.has(t)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/admin/knowledge', requireAdmin, (req, res) => {
  res.json(readJson('knowledge.json', {}));
});

app.put('/api/admin/knowledge', requireAdmin, (req, res) => {
  const cur = readJson('knowledge.json', {});
  const next = { ...cur, ...req.body };
  if (req.body.identity) next.identity = { ...cur.identity, ...req.body.identity };
  writeJson('knowledge.json', next);
  res.json(next);
});

/* ═══════════════════ aaomsPrint · PUBLIC API ═══════════════ */

app.get('/api/print/printers', (req, res) => res.json(readJson('printers.json', DEFAULT_PRINTERS)));
app.get('/api/print/pricing', (req, res) => res.json(readJson('pricing.json', DEFAULT_PRICING)));

function calcQuote(input) {
  const p = readJson('pricing.json', DEFAULT_PRICING);
  const qty = Math.max(1, parseInt(input.qty, 10) || 1);
  const sides = input.sides === 'double' ? 'double' : 'single';
  const opts = Array.isArray(input.options) ? input.options : [];

  let tier = p.tiers[0];
  for (const t of p.tiers) if (qty >= t.minQty) tier = t;

  const unitBase = p.base[sides];
  let unitOptions = 0;
  const chosen = [];
  for (const id of opts) {
    const o = (p.options || []).find(x => x.id === id);
    if (o) { unitOptions += o.price; chosen.push(o); }
  }
  const unit = Math.round((unitBase + unitOptions) * tier.mult);
  const cards = unit * qty;
  const designFee = (input.newDesign === false) ? 0
    : (qty >= (p.designFeeWaivedAt || Infinity) ? 0 : (p.designFee || 0));
  const delivery = p.deliveryFee || 0;
  const subtotal = cards + designFee + delivery;
  const vat = p.vatIncluded ? 0 : Math.round(subtotal * (p.vatPercent || 0) / 100);

  return {
    currency: p.currency, symbol: p.symbol, qty, sides,
    tier: tier.label, discountPercent: Math.round((1 - tier.mult) * 100),
    unitBase, unitOptions, unit, cards, designFee, delivery,
    subtotal, vatPercent: p.vatIncluded ? 0 : (p.vatPercent || 0), vat,
    total: subtotal + vat, options: chosen
  };
}

app.post('/api/print/quote', (req, res) => {
  try { res.json(calcQuote(req.body || {})); }
  catch (e) { res.status(400).json({ error: 'Bad quote input' }); }
});

app.post('/api/print/upload', (req, res) => {
  try {
    const d = String(req.body?.dataUrl || '');
    const m = d.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Only PNG / JPG / WEBP images' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'Image larger than 6 MB' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = uid('img_') + '.' + ext;
    fs.writeFileSync(path.join(UPLOADS, file), buf);
    res.json({ url: '/uploads/' + file, bytes: buf.length });
  } catch (e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.get('/api/print/designs', (req, res) => {
  const list = readJson('designs.json', []);
  res.json(list.map(d => ({ id: d.id, name: d.name, orient: d.orient, updatedAt: d.updatedAt })));
});
app.get('/api/print/designs/:id', (req, res) => {
  const d = readJson('designs.json', []).find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Design not found' });
  res.json(d);
});
app.post('/api/print/designs', (req, res) => {
  const list = readJson('designs.json', []);
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: 'Name required' });
  const existing = list.find(x => String(x.name).toLowerCase() === String(body.name).toLowerCase());
  const rec = {
    id: existing ? existing.id : uid('dsg_'),
    name: String(body.name).slice(0, 60),
    orient: body.orient || 'h',
    accent: body.accent || '#d4a84b',
    bg: body.bg || {},
    front: body.front || [],
    back: body.back || [],
    meta: body.meta || {},
    updatedAt: nowISO()
  };
  const next = existing ? list.map(x => x.id === rec.id ? rec : x) : list.concat(rec);
  if (next.length > 400) return res.status(507).json({ error: 'Design library full (400)' });
  writeJson('designs.json', next);
  res.json(rec);
});
app.delete('/api/print/designs/:id', requireAdmin, (req, res) => {
  const list = readJson('designs.json', []);
  writeJson('designs.json', list.filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

const STATUSES = ['new', 'quoted', 'approved', 'printing', 'done', 'cancelled'];

app.post('/api/print/jobs', (req, res) => {
  const list = readJson('jobs.json', []);
  const b = req.body || {};
  const quote = calcQuote({ qty: b.qty, sides: b.sides, options: b.options, newDesign: b.newDesign });
  const seq = String(list.length + 1).padStart(4, '0');
  const job = {
    id: uid('job_'),
    code: 'AP-' + new Date().getFullYear() + '-' + seq,
    title: String(b.title || 'ID card job').slice(0, 90),
    clientId: b.clientId || null,
    clientName: String(b.clientName || '').slice(0, 90),
    contact: String(b.contact || '').slice(0, 60),
    phone: String(b.phone || '').slice(0, 40),
    email: String(b.email || '').slice(0, 90),
    qty: Math.max(1, parseInt(b.qty, 10) || 1),
    sides: b.sides === 'double' ? 'double' : 'single',
    options: Array.isArray(b.options) ? b.options : [],
    printerId: b.printerId || 'evolis-primacy',
    designId: b.designId || null,
    designName: b.designName || '',
    preview: b.preview || null,
    rows: Array.isArray(b.rows) ? b.rows.slice(0, 2000) : [],
    notes: String(b.notes || '').slice(0, 800),
    quote,
    status: 'new',
    createdAt: nowISO(),
    updatedAt: nowISO(),
    history: [{ at: nowISO(), status: 'new', by: 'studio' }]
  };
  list.unshift(job);
  writeJson('jobs.json', list);
  res.json({ ok: true, id: job.id, code: job.code, quote });
});

app.get('/api/print/track/:code', (req, res) => {
  const j = readJson('jobs.json', []).find(x => String(x.code).toLowerCase() === String(req.params.code).toLowerCase());
  if (!j) return res.status(404).json({ error: 'No job with that code' });
  res.json({ code: j.code, title: j.title, qty: j.qty, status: j.status, updatedAt: j.updatedAt });
});

/* ═══════════════════ aaomsPrint · ADMIN API ════════════════ */

app.get('/api/admin/jobs', requireAdmin, (req, res) => {
  const list = readJson('jobs.json', []);
  const s = req.query.status;
  res.json(s ? list.filter(j => j.status === s) : list);
});

app.post('/api/admin/jobs', requireAdmin, (req, res) => {
  const list = readJson('jobs.json', []);
  const b = req.body || {};
  const quote = calcQuote({ qty: b.qty, sides: b.sides, options: b.options, newDesign: b.newDesign });
  const seq = String(list.length + 1).padStart(4, '0');
  const job = {
    id: uid('job_'), code: 'AP-' + new Date().getFullYear() + '-' + seq,
    title: b.title || 'ID card job', clientId: b.clientId || null, clientName: b.clientName || '',
    contact: b.contact || '', phone: b.phone || '', email: b.email || '',
    qty: Math.max(1, parseInt(b.qty, 10) || 1), sides: b.sides === 'double' ? 'double' : 'single',
    options: b.options || [], printerId: b.printerId || 'evolis-primacy',
    designId: b.designId || null, designName: b.designName || '', preview: b.preview || null,
    rows: b.rows || [], notes: b.notes || '', quote, status: b.status || 'new',
    createdAt: nowISO(), updatedAt: nowISO(),
    history: [{ at: nowISO(), status: b.status || 'new', by: 'admin' }]
  };
  list.unshift(job);
  writeJson('jobs.json', list);
  res.json(job);
});

app.put('/api/admin/jobs/:id', requireAdmin, (req, res) => {
  const list = readJson('jobs.json', []);
  const i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Job not found' });
  const b = req.body || {};
  const job = list[i];
  if (b.status && STATUSES.includes(b.status) && b.status !== job.status) {
    job.history = (job.history || []).concat({ at: nowISO(), status: b.status, by: 'admin' });
    job.status = b.status;
  }
  ['title', 'clientName', 'contact', 'phone', 'email', 'notes', 'printerId', 'designId', 'designName'].forEach(k => {
    if (b[k] !== undefined) job[k] = b[k];
  });
  if (b.qty !== undefined) job.qty = Math.max(1, parseInt(b.qty, 10) || 1);
  if (b.sides !== undefined) job.sides = b.sides === 'double' ? 'double' : 'single';
  if (b.options !== undefined) job.options = b.options;
  if (b.recalc) job.quote = calcQuote({ qty: job.qty, sides: job.sides, options: job.options });
  job.updatedAt = nowISO();
  list[i] = job;
  writeJson('jobs.json', list);
  res.json(job);
});

app.delete('/api/admin/jobs/:id', requireAdmin, (req, res) => {
  const list = readJson('jobs.json', []);
  writeJson('jobs.json', list.filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/clients', requireAdmin, (req, res) => res.json(readJson('clients.json', [])));
app.post('/api/admin/clients', requireAdmin, (req, res) => {
  const list = readJson('clients.json', []);
  const b = req.body || {};
  if (!b.org) return res.status(400).json({ error: 'Organization required' });
  const rec = {
    id: uid('cl_'), org: String(b.org).slice(0, 90), contact: b.contact || '',
    phone: b.phone || '', email: b.email || '', address: b.address || '',
    type: b.type || 'corporate', notes: b.notes || '', createdAt: nowISO()
  };
  list.unshift(rec); writeJson('clients.json', list); res.json(rec);
});
app.put('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const list = readJson('clients.json', []);
  const i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Client not found' });
  list[i] = { ...list[i], ...req.body, id: list[i].id };
  writeJson('clients.json', list); res.json(list[i]);
});
app.delete('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const list = readJson('clients.json', []);
  writeJson('clients.json', list.filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.put('/api/admin/printers', requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Array expected' });
  writeJson('printers.json', req.body); res.json(req.body);
});
app.put('/api/admin/pricing', requireAdmin, (req, res) => {
  const cur = readJson('pricing.json', DEFAULT_PRICING);
  const next = { ...cur, ...req.body };
  writeJson('pricing.json', next); res.json(next);
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const st = readJson('settings.json', {});
  const safe = Object.assign({}, st);
  if (safe.eaaoms) {
    safe.eaaoms = {
      pinHint: safe.eaaoms.pin ? ('••••' + String(safe.eaaoms.pin).slice(-2)) : '',
      url: safe.eaaoms.url || ''
    };
  }
  res.json(Object.assign({}, safe, {
    gateways: {
      razorpay: { configured: !!(RZP_KEY_ID && RZP_KEY_SECRET), keyId: RZP_KEY_ID },
      paypal: { auto: !!(PP_CLIENT_ID && PP_SECRET), handle: PAYPAL_ME },
      nepal: nepalPay()
    }
  }));
});
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const cur = readJson('settings.json', {});
  const next = Object.assign({}, cur, req.body);
  delete next.gateways;
  writeJson('settings.json', next);
  res.json(next);
});

app.get('/api/admin/faq', requireAdmin, (req, res) => res.json(readJson('faq.json', [])));
app.put('/api/admin/faq', requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Array expected' });
  const clean = req.body
    .filter(x => x && x.q && x.a)
    .map(x => ({ q: String(x.q).slice(0, 300), a: String(x.a).slice(0, 1500) }))
    .slice(0, 60);
  writeJson('faq.json', clean);
  res.json(clean);
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const jobs = readJson('jobs.json', []);
  const clients = readJson('clients.json', []);
  const designs = readJson('designs.json', []);
  const byStatus = {};
  STATUSES.forEach(s => byStatus[s] = 0);
  let cards = 0, revenue = 0;
  jobs.forEach(j => {
    byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    if (j.status === 'done') { cards += j.qty || 0; revenue += (j.quote && j.quote.total) || 0; }
  });
  const month = {};
  jobs.forEach(j => { const k = String(j.createdAt || '').slice(0, 7); if (k) month[k] = (month[k] || 0) + 1; });
  res.json({
    jobs: jobs.length, clients: clients.length, designs: designs.length,
    byStatus, cardsPrinted: cards, revenueDone: revenue, byMonth: month,
    queue: jobs.filter(j => ['approved', 'printing'].includes(j.status)).length
  });
});

/* ═══════════════════ PRINT AGENT (local PC) ════════════════ */
function agentOk(req) {
  const k = req.query.key || req.headers['x-agent-key'] || (req.body && req.body.key);
  return String(k || '') === AGENT_KEY;
}
app.get('/api/agent/next', (req, res) => {
  if (!agentOk(req)) return res.status(401).json({ error: 'Bad agent key' });
  const list = readJson('jobs.json', []);
  const j = list.find(x => x.status === 'approved');
  if (!j) return res.json({ job: null });
  j.status = 'printing'; j.updatedAt = nowISO();
  j.history = (j.history || []).concat({ at: nowISO(), status: 'printing', by: 'agent' });
  writeJson('jobs.json', list);
  const design = j.designId ? readJson('designs.json', []).find(d => d.id === j.designId) : null;
  const printer = readJson('printers.json', DEFAULT_PRINTERS).find(p => p.id === j.printerId) || null;
  res.json({ job: j, design: design || null, printer });
});
app.post('/api/agent/status', (req, res) => {
  if (!agentOk(req)) return res.status(401).json({ error: 'Bad agent key' });
  const list = readJson('jobs.json', []);
  const j = list.find(x => x.id === req.body.id);
  if (!j) return res.status(404).json({ error: 'Job not found' });
  const s = STATUSES.includes(req.body.status) ? req.body.status : 'done';
  j.status = s; j.updatedAt = nowISO();
  j.history = (j.history || []).concat({ at: nowISO(), status: s, by: 'agent', note: req.body.note || '' });
  writeJson('jobs.json', list);
  res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════════
   DIGITAL PRODUCTS · POSTS · INBOX · SEO
   Payments are used ONLY by the Digital Product section.
   Razorpay  → Indian customers (INR)
   PayPal    → international customers (USD)
   Keys are read from environment variables only. Never hard-coded.
   ═══════════════════════════════════════════════════════════════ */

const https = require('https');
const PRODUCT_FILES = path.join(DATA, 'product-files');
const MEDIA = path.join(DATA, 'media');
if (!fs.existsSync(PRODUCT_FILES)) fs.mkdirSync(PRODUCT_FILES, { recursive: true });
if (!fs.existsSync(MEDIA)) fs.mkdirSync(MEDIA, { recursive: true });
app.use('/media', express.static(MEDIA, { maxAge: '30d' }));

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_TOJgaAF3FwGpcT';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const PP_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PP_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_ME = process.env.PAYPAL_ME || 'kkpramod';
const NP_ESEWA = process.env.ESEWA_ID || '';
const NP_KHALTI = process.env.KHALTI_ID || '';
const NP_BANK = {
  bank: process.env.BANK_NAME || '',
  name: process.env.BANK_ACCOUNT_NAME || '',
  account: process.env.BANK_ACCOUNT || '',
  branch: process.env.BANK_BRANCH || ''
};
const NP_QR = process.env.PAYMENT_QR_URL || '';
const PP_HOST = (process.env.PAYPAL_ENV || 'live') === 'sandbox'
  ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
const SITE_URL = process.env.SITE_URL || 'https://kkpramod.com.np';

function httpsJson(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(raw || '{}'); } catch (e) { json = { raw }; }
        if (res.statusCode >= 400) return reject(new Error(json.error?.description || json.message || ('HTTP ' + res.statusCode)));
        resolve(json);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ─────────── seeds ─────────── */
const DEFAULT_PRODUCTS = [
  {
    id: 'prd_example_embroidery',
    slug: 'example-embroidery-digitized-file',
    title: 'Example — Embroidery Digitized File',
    category: 'Embroidery digitizing',
    blurb: 'A sample stitch-ready file pack, here to show exactly how buying and downloading works.',
    description: 'This is the example listing. It carries a real downloadable pack so you can test the whole flow end to end — pay, unlock, download. Replace it from the Control Room with your own digitized designs: upload the preview image, set the price in NPR, INR and USD, and attach the stitch files buyers receive. Only embroidery digitized files are sold here.',
    formats: ['DST', 'Colour sequence sheet', 'Read-me'],
    stitches: 1200, sizeMm: '40 × 40', colours: 1,
    priceNPR: 500, priceINR: 300, priceUSD: 4,
    thumb: '/assets/product-example.png',
    files: [
      { name: 'aaoms-example-design.dst', stored: 'example__aaoms-example-design.dst' },
      { name: 'colour-sequence.txt', stored: 'example__colour-sequence.txt' },
      { name: 'read-me-first.txt', stored: 'example__read-me-first.txt' }
    ],
    tags: ['example', 'embroidery', 'digitized', 'dst'],
    featured: true, createdAt: new Date().toISOString()
  }
];
seed('products.json', DEFAULT_PRODUCTS);
seed('orders.json', []);
seed('posts.json', []);
seed('messages.json', []);
seed('faq.json', [
  { q: 'What file formats do I get when I buy an embroidery design?',
    a: 'Every purchase includes DST, PES, JEF and EXP as standard, plus a colour sequence sheet. Extra formats such as VP3, HUS or EMB are included where listed on the product.' },
  { q: 'How soon can I download after paying?',
    a: 'Immediately. The download link unlocks on the confirmation screen the moment the payment is confirmed, and the same link is valid for seven days.' },
  { q: 'Which payment methods work for customers in India?',
    a: 'Indian customers pay in rupees through Razorpay — UPI, cards, net banking and wallets all work. International customers pay in US dollars through PayPal.' },
  { q: 'Do you print ID cards for hospitals and schools in Nepal?',
    a: 'Yes. aaomsPrint designs and prints CR-80 PVC ID cards for hospitals, schools, offices, gyms, events and membership programmes. Government-issued documents are not printed.' },
  { q: 'Which card printers does aaomsPrint support?',
    a: 'The studio exports for Evolis, Zebra, Fargo / HID, Magicard and Nisca. Printing in-house at AAOMS Nepal runs on an Evolis Primacy.' },
  { q: 'Can I order a large batch of ID cards from one staff list?',
    a: 'Yes. Upload a CSV of your staff list in the studio, map the columns once, and every card is generated together. The whole batch can be downloaded as a ZIP or a single PDF, or sent straight to the print queue.' },
  { q: 'What is GURUKULAM?',
    a: 'GURUKULAM is the daily study feed on this site, where Pramod KK writes what he is learning from the Bhagavad Gita, the Vedas and the Upanishads — a verse, a reflection, a chant or a note on practice, shared as text, image, video and sound. Nothing is sold there; it is offered freely.' },
  { q: 'Do you take custom digitizing work?',
    a: 'Yes. Send the artwork or photograph and the garment it will be stitched on, and you receive a stitch-tested file, normally within two to four working days.' },
  { q: 'Where is AAOMS Nepal based?',
    a: 'The production base is at Bateshwor, Mahendra Nagar, Dhanusha, Nepal, with work delivered across Nepal, India and online worldwide.' },
  { q: 'How do I get a quotation for card printing?',
    a: 'Open the aaomsPrint studio, set the quantity and finishing options, and the quotation calculates instantly with quantity discounts and VAT. Send it to WhatsApp or email in one tap.' }
]);

/* ─────────── media upload (admin) ─────────── */
app.post('/api/admin/media', requireAdmin, (req, res) => {
  try {
    const d = String(req.body?.dataUrl || '');
    const m = d.match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Bad data URL' });
    const mime = m[1];
    const okExt = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
      'audio/wav': 'wav', 'audio/ogg': 'ogg'
    };
    if (!okExt[mime]) return res.status(400).json({ error: 'Unsupported media type: ' + mime });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 45 * 1024 * 1024) return res.status(413).json({ error: 'File larger than 45 MB' });
    const file = uid('m_') + '.' + okExt[mime];
    fs.writeFileSync(path.join(MEDIA, file), buf);
    res.json({ url: '/media/' + file, mime, bytes: buf.length });
  } catch (e) { res.status(500).json({ error: 'Media upload failed' }); }
});

/* ─────────── product file upload (admin, private) ─────────── */
app.post('/api/admin/product-file', requireAdmin, (req, res) => {
  try {
    const name = String(req.body?.name || 'design').replace(/[^\w.\-]+/g, '_').slice(0, 60);
    const b64 = String(req.body?.base64 || '');
    if (!b64) return res.status(400).json({ error: 'No file data' });
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'File larger than 25 MB' });
    const stored = uid('pf_') + '__' + name;
    fs.writeFileSync(path.join(PRODUCT_FILES, stored), buf);
    res.json({ stored, name, bytes: buf.length });
  } catch (e) { res.status(500).json({ error: 'Upload failed' }); }
});

/* ═══════════════ STORE · PUBLIC ═══════════════ */
function publicProduct(p) {
  const { files, ...rest } = p;
  return { ...rest, fileCount: (files || []).length };
}
app.get('/api/store/products', (req, res) => {
  res.json(readJson('products.json', []).map(publicProduct));
});
app.get('/api/store/products/:slug', (req, res) => {
  const p = readJson('products.json', []).find(x => x.slug === req.params.slug || x.id === req.params.slug);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(publicProduct(p));
});
function nepalPay() {
  const st = readJson('settings.json', {}).nepal || {};
  const bank = st.bank || {};
  return {
    esewa: st.esewa || NP_ESEWA,
    khalti: st.khalti || NP_KHALTI,
    bank: {
      bank: bank.bank || NP_BANK.bank,
      branch: bank.branch || NP_BANK.branch,
      name: bank.name || NP_BANK.name,
      account: bank.account || NP_BANK.account
    },
    qr: st.qr || NP_QR
  };
}

app.get('/api/store/config', (req, res) => {
  res.json({
    razorpay: { enabled: !!(RZP_KEY_ID && RZP_KEY_SECRET), keyId: RZP_KEY_ID },
    paypal: {
      enabled: !!(PP_CLIENT_ID && PP_SECRET),
      clientId: PP_CLIENT_ID,
      env: PP_HOST.includes('sandbox') ? 'sandbox' : 'live',
      me: PAYPAL_ME,
      meUrl: 'https://paypal.me/' + PAYPAL_ME
    },
    nepal: Object.assign({}, nepalPay(), {
      enabled: !!(nepalPay().esewa || nepalPay().khalti || nepalPay().bank.account || nepalPay().qr),
      whatsapp: '9779803840868'
    }),
    currencies: { INR: '₹', USD: '$', NPR: 'रु' }
  });
});
app.get('/api/store/faq', (req, res) => res.json(readJson('faq.json', [])));

function priceOf(p, cur) {
  if (cur === 'INR') return p.priceINR;
  if (cur === 'USD') return p.priceUSD;
  return p.priceNPR;
}
function newOrder(items, cur, buyer, provider) {
  const list = readJson('orders.json', []);
  const products = readJson('products.json', []);
  const picked = items.map(id => products.find(p => p.id === id || p.slug === id)).filter(Boolean);
  if (!picked.length) throw new Error('No valid products in cart');
  const amount = picked.reduce((s, p) => s + priceOf(p, cur), 0);
  const order = {
    id: uid('ord_'),
    code: 'DP-' + new Date().getFullYear() + '-' + String(list.length + 1).padStart(4, '0'),
    items: picked.map(p => ({ id: p.id, slug: p.slug, title: p.title, price: priceOf(p, cur) })),
    currency: cur, amount, provider,
    name: String(buyer.name || '').slice(0, 80),
    email: String(buyer.email || '').slice(0, 90),
    country: String(buyer.country || '').slice(0, 40),
    status: 'pending', providerOrderId: null, paymentId: null,
    token: null, tokenExpiry: null,
    createdAt: nowISO()
  };
  list.unshift(order);
  writeJson('orders.json', list);
  return order;
}
function saveOrder(order) {
  const list = readJson('orders.json', []);
  const i = list.findIndex(o => o.id === order.id);
  if (i >= 0) list[i] = order; else list.unshift(order);
  writeJson('orders.json', list);
}
function grantDownload(order) {
  order.status = 'paid';
  order.token = crypto.randomBytes(16).toString('hex');
  order.tokenExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  order.paidAt = nowISO();
  saveOrder(order);
  return order;
}

/* Razorpay — Indian customers */
app.post('/api/store/razorpay/order', async (req, res) => {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET) return res.status(503).json({ error: 'Razorpay is not configured on this server' });
  try {
    const order = newOrder(req.body.items || [], 'INR', req.body.buyer || {}, 'razorpay');
    const payload = JSON.stringify({
      amount: Math.round(order.amount * 100),
      currency: 'INR',
      receipt: order.code,
      notes: { code: order.code, email: order.email }
    });
    const auth = Buffer.from(RZP_KEY_ID + ':' + RZP_KEY_SECRET).toString('base64');
    const rz = await httpsJson({
      hostname: 'api.razorpay.com', path: '/v1/orders', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + auth, 'Content-Length': Buffer.byteLength(payload) }
    }, payload);
    order.providerOrderId = rz.id;
    saveOrder(order);
    res.json({ orderId: rz.id, amount: rz.amount, currency: rz.currency, keyId: RZP_KEY_ID, code: order.code, localId: order.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store/razorpay/verify', (req, res) => {
  if (!RZP_KEY_SECRET) return res.status(503).json({ error: 'Razorpay is not configured' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, localId } = req.body || {};
  const expected = crypto.createHmac('sha256', RZP_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
  if (expected !== razorpay_signature) return res.status(400).json({ error: 'Payment signature did not verify' });
  const list = readJson('orders.json', []);
  const order = list.find(o => o.id === localId || o.providerOrderId === razorpay_order_id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.paymentId = razorpay_payment_id;
  grantDownload(order);
  res.json({ ok: true, token: order.token, code: order.code, items: order.items });
});

/* PayPal — international customers */
async function ppToken() {
  const body = 'grant_type=client_credentials';
  const auth = Buffer.from(PP_CLIENT_ID + ':' + PP_SECRET).toString('base64');
  const r = await httpsJson({
    hostname: PP_HOST, path: '/v1/oauth2/token', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + auth,
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  return r.access_token;
}
app.post('/api/store/paypal/order', async (req, res) => {
  if (!PP_CLIENT_ID || !PP_SECRET) return res.status(503).json({ error: 'PayPal is not configured on this server' });
  try {
    const order = newOrder(req.body.items || [], 'USD', req.body.buyer || {}, 'paypal');
    const token = await ppToken();
    const payload = JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.code,
        description: 'aaoms Digital Products — embroidery files',
        amount: { currency_code: 'USD', value: order.amount.toFixed(2) }
      }]
    });
    const pp = await httpsJson({
      hostname: PP_HOST, path: '/v2/checkout/orders', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(payload) }
    }, payload);
    order.providerOrderId = pp.id;
    saveOrder(order);
    res.json({ orderId: pp.id, code: order.code, localId: order.id, amount: order.amount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/store/paypal/capture', async (req, res) => {
  if (!PP_CLIENT_ID || !PP_SECRET) return res.status(503).json({ error: 'PayPal is not configured' });
  try {
    const { orderId, localId } = req.body || {};
    const token = await ppToken();
    const cap = await httpsJson({
      hostname: PP_HOST, path: '/v2/checkout/orders/' + encodeURIComponent(orderId) + '/capture', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': 0 }
    }, null);
    if (cap.status !== 'COMPLETED') return res.status(400).json({ error: 'Payment not completed' });
    const list = readJson('orders.json', []);
    const order = list.find(o => o.id === localId || o.providerOrderId === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.paymentId = cap.id;
    grantDownload(order);
    res.json({ ok: true, token: order.token, code: order.code, items: order.items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* PayPal.me — international customers, no API keys needed.
   Buyer pays at paypal.me/<handle>, then confirms. You release the
   files from the Control Room once the payment shows in PayPal. */
app.post('/api/store/paypalme/order', (req, res) => {
  try {
    const order = newOrder(req.body.items || [], 'USD', req.body.buyer || {}, 'paypal.me');
    order.status = 'awaiting-payment';
    saveOrder(order);
    res.json({
      code: order.code, localId: order.id, amount: order.amount,
      payUrl: 'https://paypal.me/' + PAYPAL_ME + '/' + order.amount.toFixed(2) + 'USD',
      handle: '@' + PAYPAL_ME
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/store/paypalme/claim', (req, res) => {
  const list = readJson('orders.json', []);
  const order = list.find(o => o.id === req.body.localId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = 'verifying';
  order.claimNote = String(req.body.note || '').slice(0, 200);
  order.claimedAt = nowISO();
  saveOrder(order);
  res.json({ ok: true, code: order.code });
});

/* Nepal (NPR) — eSewa / Khalti / bank transfer / QR, confirmed by hand */
app.post('/api/store/npr/order', (req, res) => {
  try {
    const order = newOrder(req.body.items || [], 'NPR', req.body.buyer || {}, 'nepal');
    order.status = 'awaiting-payment';
    saveOrder(order);
    res.json({
      code: order.code, localId: order.id, amount: order.amount,
      pay: nepalPay(),
      whatsapp: 'https://wa.me/9779803840868?text=' + encodeURIComponent(
        'Namaste, I paid for order ' + order.code + ' — रु ' + order.amount + '. Please release my files.')
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* Buyer says the money is sent — works for any manual order */
app.post('/api/store/claim', (req, res) => {
  const list = readJson('orders.json', []);
  const order = list.find(o => o.id === req.body.localId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = 'verifying';
  order.claimNote = String(req.body.note || '').slice(0, 200);
  order.claimedAt = nowISO();
  saveOrder(order);
  res.json({ ok: true, code: order.code });
});

/* Release a paid-by-hand order (admin) */
app.post('/api/admin/orders/:id/release', requireAdmin, (req, res) => {
  const list = readJson('orders.json', []);
  const o = list.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  grantDownload(o);
  res.json({ ok: true, token: o.token, code: o.code, email: o.email });
});

/* Download — only with a valid paid token */
app.get('/api/store/download/:token', (req, res) => {
  const order = readJson('orders.json', []).find(o => o.token === req.params.token);
  if (!order || order.status !== 'paid') return res.status(403).send('Invalid or unpaid download link.');
  if (order.tokenExpiry && new Date(order.tokenExpiry) < new Date()) return res.status(410).send('This download link has expired. Contact us and we will reissue it.');
  const products = readJson('products.json', []);
  const files = [];
  order.items.forEach(it => {
    const p = products.find(x => x.id === it.id);
    (p?.files || []).forEach(f => files.push({ product: p.title, ...f }));
  });
  const idx = parseInt(req.query.f, 10);
  if (isNaN(idx)) {
    if (String(req.query.format) === 'json') {
      return res.json({ code: order.code, expires: order.tokenExpiry, files: files.map((f, i) => ({ i, name: f.name, product: f.product })) });
    }
    const exp = new Date(order.tokenExpiry).toDateString();
    return res.type('html').send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Your download — ${order.code}</title>
<link rel="icon" type="image/png" href="/assets/favicon-infinity.png">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/aaoms-core.css">
<style>
.dl-wrap{max-width:620px;margin:60px auto;padding:0 22px}
.dl-card{padding:30px;border-radius:16px}
.dl-card h1{font-family:Fraunces,serif;font-size:26px;margin:0 0 6px}
.dl-file{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--line);
  border-radius:11px;margin-bottom:9px;background:rgba(0,0,0,.24);transition:.18s}
.dl-file:hover{border-color:rgba(212,168,75,.45);transform:translateY(-2px)}
.dl-file b{flex:1;font-weight:600;font-size:14px}
.dl-file span{font-size:11px;color:var(--muted);font-family:"JetBrains Mono",monospace}
</style></head><body class="page">
<div class="dl-wrap"><div class="dl-card glass neon-edge corner-tick">
<img src="/assets/logo-infinity.png" alt="" style="height:52px;margin-bottom:18px">
<h1>Your files are ready</h1>
<p class="dim" style="font-size:13.5px;margin:0 0 4px">Order <b class="gold">${order.code}</b> — thank you.</p>
<p class="muted mono" style="font-size:11px;margin:0 0 22px">This link stays live until ${exp}. Save the files somewhere safe.</p>
${files.map((f, i) => `<a class="dl-file" href="?f=${i}"><b>${f.name}</b><span>download &#8595;</span></a>`).join('')}
<p class="muted" style="font-size:12px;line-height:1.6;margin-top:22px">
Files may be stitched on garments you make and sell. The digital file itself may not be resold or shared.<br>
Trouble downloading? <a class="gold" href="https://wa.me/9779803840868">WhatsApp +977 9803840868</a>
or <a class="gold" href="mailto:hello@kkpramod.com.np">hello@kkpramod.com.np</a></p>
<p style="margin-top:20px"><a class="gold" style="font-size:12.5px" href="/aaomsdigital">&larr; back to Digital Products</a></p>
</div></div></body></html>`);
  }
  const f = files[idx];
  if (!f) return res.status(404).send('File not found.');
  const full = path.join(PRODUCT_FILES, f.stored);
  if (!full.startsWith(PRODUCT_FILES) || !fs.existsSync(full)) return res.status(404).send('File missing on server.');
  res.download(full, f.name);
});

/* Store admin */
app.get('/api/admin/products', requireAdmin, (req, res) => res.json(readJson('products.json', [])));
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const list = readJson('products.json', []);
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Title required' });
  const rec = {
    id: uid('prd_'),
    slug: String(b.slug || b.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70),
    title: b.title, category: b.category || 'Design', blurb: b.blurb || '',
    description: b.description || '', formats: b.formats || [],
    stitches: b.stitches || 0, sizeMm: b.sizeMm || '', colours: b.colours || 0,
    priceNPR: +b.priceNPR || 0, priceINR: +b.priceINR || 0, priceUSD: +b.priceUSD || 0,
    thumb: b.thumb || '', files: b.files || [], tags: b.tags || [],
    featured: !!b.featured, createdAt: nowISO()
  };
  list.unshift(rec); writeJson('products.json', list); res.json(rec);
});
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const list = readJson('products.json', []);
  const i = list.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Product not found' });
  list[i] = { ...list[i], ...req.body, id: list[i].id };
  writeJson('products.json', list); res.json(list[i]);
});
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  writeJson('products.json', readJson('products.json', []).filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});
app.get('/api/admin/orders', requireAdmin, (req, res) => res.json(readJson('orders.json', [])));
app.post('/api/admin/orders/:id/reissue', requireAdmin, (req, res) => {
  const list = readJson('orders.json', []);
  const o = list.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  grantDownload(o);
  res.json({ ok: true, token: o.token });
});

/* ═══════════════ AUTO-TRANSLATE (English · Hindi · Nepali) ═══════════════
   Free MyMemory API, no key needed. If it's unreachable (e.g. host has no
   outbound internet, or the daily free quota is hit) we just fall back to
   the original text instead of failing the post save. */
const GK_LANGS = ['en', 'hi', 'ne'];
const GK_LANG_NAMES = { en: 'English', hi: 'Hindi', ne: 'Nepali' };

function mtranslateChunk(text, source, target) {
  return new Promise(resolve => {
    const t = String(text || '').trim();
    if (!t || source === target) return resolve(t);
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(t.slice(0, 480)) +
      '&langpair=' + source + '|' + target;
    const req = https.get(url, { timeout: 8000 }, r => {
      let data = '';
      r.on('data', d => data += d);
      r.on('end', () => {
        try {
          const j = JSON.parse(data);
          const out = j && j.responseData && j.responseData.translatedText;
          resolve(out && !/MYMEMORY WARNING/i.test(out) ? out : t);
        } catch (e) { resolve(t); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(t); });
    req.on('error', () => resolve(t));
  });
}
// splits long text on paragraph/sentence boundaries so each request stays under the API's length limit
async function translateLong(text, source, target) {
  const t = String(text || '');
  if (!t.trim() || source === target) return t;
  const paras = t.split(/\n{2,}/);
  const outParas = [];
  for (const p of paras) {
    if (p.length <= 480) { outParas.push(await mtranslateChunk(p, source, target)); continue; }
    const sentences = p.match(/[^.!?]+[.!?]*/g) || [p];
    let chunk = '', pieces = [];
    for (const s of sentences) {
      if ((chunk + s).length > 480) { pieces.push(await mtranslateChunk(chunk, source, target)); chunk = ''; }
      chunk += s;
    }
    if (chunk) pieces.push(await mtranslateChunk(chunk, source, target));
    outParas.push(pieces.join(' '));
  }
  return outParas.join('\n\n');
}
async function buildI18n(fields, sourceLang) {
  const src = GK_LANGS.includes(sourceLang) ? sourceLang : 'en';
  const i18n = {};
  i18n[src] = { title: fields.title || '', summary: fields.summary || '', body: fields.body || '', lesson: fields.lesson || '', auto: false };
  for (const lang of GK_LANGS) {
    if (lang === src) continue;
    try {
      i18n[lang] = {
        title: await translateLong(fields.title, src, lang),
        summary: await translateLong(fields.summary, src, lang),
        body: await translateLong(fields.body, src, lang),
        lesson: await translateLong(fields.lesson, src, lang),
        auto: true
      };
    } catch (e) {
      i18n[lang] = { title: fields.title || '', summary: fields.summary || '', body: fields.body || '', lesson: fields.lesson || '', auto: false, failed: true };
    }
  }
  return i18n;
}

/* ═══════════════ GURUKUL POSTS ═══════════════ */
app.get('/api/posts', (req, res) => {
  const list = readJson('posts.json', []).filter(p => p.published !== false);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 60);
  const offset = parseInt(req.query.offset, 10) || 0;
  const tag = req.query.tag;
  const filtered = tag ? list.filter(p => (p.tags || []).includes(tag)) : list;
  res.json({ total: filtered.length, posts: filtered.slice(offset, offset + limit) });
});
app.get('/api/posts/:slug', (req, res) => {
  const p = readJson('posts.json', []).find(x => x.slug === req.params.slug || x.id === req.params.slug);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  res.json(p);
});
app.get('/api/admin/posts', requireAdmin, (req, res) => res.json(readJson('posts.json', [])));
app.post('/api/admin/posts', requireAdmin, async (req, res) => {
  const list = readJson('posts.json', []);
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Title required' });
  const sourceLang = GK_LANGS.includes(b.lang) ? b.lang : 'en';
  const i18n = await buildI18n({ title: b.title, summary: b.summary, body: b.body, lesson: b.lesson }, sourceLang);
  const src = i18n[sourceLang];
  const rec = {
    id: uid('pst_'),
    slug: String(b.slug || b.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
      + '-' + Date.now().toString(36).slice(-4),
    sourceLang,
    title: src.title, summary: src.summary, body: src.body, lesson: src.lesson,
    i18n,
    image: b.image || '', video: b.video || '', audio: b.audio || '',
    tags: Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',').map(s => s.trim()).filter(Boolean),
    published: b.published !== false,
    createdAt: nowISO(), updatedAt: nowISO()
  };
  list.unshift(rec); writeJson('posts.json', list); res.json(rec);
});
app.put('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const list = readJson('posts.json', []);
  const i = list.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Post not found' });
  // tags/media/published are shared across every language — this endpoint never touches title/summary/body/lesson/i18n
  const b = { ...req.body }; delete b.title; delete b.summary; delete b.body; delete b.lesson; delete b.i18n; delete b.sourceLang;
  list[i] = { ...list[i], ...b, id: list[i].id, updatedAt: nowISO() };
  writeJson('posts.json', list); res.json(list[i]);
});
// edit one language's text directly (used when an auto-translation needs a correction)
app.put('/api/admin/posts/:id/i18n/:lang', requireAdmin, (req, res) => {
  const lang = req.params.lang;
  if (!GK_LANGS.includes(lang)) return res.status(400).json({ error: 'Unknown language' });
  const list = readJson('posts.json', []);
  const i = list.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Post not found' });
  const b = req.body || {};
  const post = list[i];
  post.sourceLang = post.sourceLang || 'en'; // older posts created before this feature had no sourceLang
  post.i18n = post.i18n || {};
  post.i18n[lang] = { title: b.title || '', summary: b.summary || '', body: b.body || '', lesson: b.lesson || '', auto: false };
  if (post.sourceLang === lang) { post.title = b.title || ''; post.summary = b.summary || ''; post.body = b.body || ''; post.lesson = b.lesson || ''; }
  post.updatedAt = nowISO();
  writeJson('posts.json', list); res.json(post);
});
// regenerate one language's auto-translation from the source language
app.post('/api/admin/posts/:id/retranslate/:lang', requireAdmin, async (req, res) => {
  const lang = req.params.lang;
  if (!GK_LANGS.includes(lang)) return res.status(400).json({ error: 'Unknown language' });
  const list = readJson('posts.json', []);
  const i = list.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Post not found' });
  const post = list[i];
  const src = post.sourceLang || 'en';
  if (lang === src) return res.status(400).json({ error: 'That is the source language — edit it directly instead' });
  const source = post.i18n && post.i18n[src] ? post.i18n[src] : { title: post.title, summary: post.summary, body: post.body, lesson: post.lesson };
  post.i18n = post.i18n || {};
  post.i18n[lang] = {
    title: await translateLong(source.title, src, lang),
    summary: await translateLong(source.summary, src, lang),
    body: await translateLong(source.body, src, lang),
    lesson: await translateLong(source.lesson, src, lang),
    auto: true
  };
  post.updatedAt = nowISO();
  writeJson('posts.json', list); res.json(post);
});
app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
  writeJson('posts.json', readJson('posts.json', []).filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

/* ═══════════════ SAY HI · INBOX ═══════════════ */
app.post('/api/contact', (req, res) => {
  const b = req.body || {};
  if (!b.message || String(b.message).trim().length < 2) return res.status(400).json({ error: 'Please write a message' });
  const list = readJson('messages.json', []);
  const rec = {
    id: uid('msg_'),
    code: 'MSG-' + String(list.length + 1).padStart(4, '0'),
    name: String(b.name || 'Anonymous').slice(0, 80),
    email: String(b.email || '').slice(0, 90),
    phone: String(b.phone || '').slice(0, 40),
    topic: String(b.topic || 'general').slice(0, 40),
    message: String(b.message).slice(0, 4000),
    budget: String(b.budget || '').slice(0, 40),
    read: false, createdAt: nowISO()
  };
  list.unshift(rec);
  writeJson('messages.json', list.slice(0, 2000));
  res.json({ ok: true, code: rec.code });
});
app.get('/api/admin/messages', requireAdmin, (req, res) => res.json(readJson('messages.json', [])));
app.put('/api/admin/messages/:id', requireAdmin, (req, res) => {
  const list = readJson('messages.json', []);
  const i = list.findIndex(m => m.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Message not found' });
  list[i] = { ...list[i], ...req.body, id: list[i].id };
  writeJson('messages.json', list); res.json(list[i]);
});
app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => {
  writeJson('messages.json', readJson('messages.json', []).filter(m => m.id !== req.params.id));
  res.json({ ok: true });
});

/* ═══════════════ SEO · robots / sitemap / llms.txt ═══════════════ */
const STATIC_ROUTES = ['/', '/print', '/aaomsdigital', '/e-aaoms', '/nepse', '/gurukul', '/classroom', '/sayhi', '/faq', '/jobs'];

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

# AI and LLM crawlers are welcome to read and cite this site
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Amazonbot
Allow: /
User-agent: meta-externalagent
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
Host: ${SITE_URL.replace(/^https?:\/\//, '')}
`);
});

app.get('/sitemap.xml', (req, res) => {
  const posts = readJson('posts.json', []).filter(p => p.published !== false);
  const products = readJson('products.json', []);
  const urls = []
    .concat(STATIC_ROUTES.map(r => ({ loc: SITE_URL + r, pri: r === '/' ? '1.0' : '0.8', lm: null })))
    .concat(posts.map(p => ({ loc: SITE_URL + '/gurukul/' + p.slug, pri: '0.7', lm: p.updatedAt || p.createdAt })))
    .concat(products.map(p => ({ loc: SITE_URL + '/aaomsdigital/' + p.slug, pri: '0.7', lm: p.createdAt })));
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url><loc>' + u.loc + '</loc>' +
      (u.lm ? '<lastmod>' + String(u.lm).slice(0, 10) + '</lastmod>' : '') +
      '<changefreq>weekly</changefreq><priority>' + u.pri + '</priority></url>').join('\n') +
    '\n</urlset>');
});

app.get('/llms.txt', (req, res) => {
  const kb = readJson('knowledge.json', {});
  const posts = readJson('posts.json', []).slice(0, 20);
  const products = readJson('products.json', []);
  const faq = readJson('faq.json', []);
  res.type('text/plain').send(
`# Pramod KK — kkpramod.com.np

> Pramod KK is a 3D artist, animator and creative technologist based in Nepal. He runs
> aaomsPrint (PVC ID card design and printing), aaoms Digital Products (embroidery
> digitizing files sold worldwide), GURUKULAM (daily production-craft teaching)
> and the aaomsDigital service stack.

## Identity
- Name: ${kb.identity?.name || 'Pramod KK'}
- Site: ${SITE_URL}
- Roles: business owner, 3D artist and animator by training, builder of aaomsDigital
- Businesses run: Artistic Dental Lab (Bangalore, India), aaoms.co.in (medical and uniform
  wear, India), aaomsnepal.com (medical wear and embroidery, Nepal), aaoms.online (aaoms
  digital storefront), aaomsDigital (digital services, digital products and the aaomsPrint
  card printing engine), GURUKULAM
- Not actively job hunting, but open to the right senior creative or 3D role for a strong
  offer, remote or on site. Also available for project work, collaboration and quotations.
- Base: Bateshwor, Mahendra Nagar, Dhanusha, Nepal — serving Nepal, India and worldwide
- Email: ${kb.identity?.email || 'hello@kkpramod.com.np'}
- WhatsApp: ${kb.identity?.whatsapp || '+977 9803840868'}

## Main sections
- ${SITE_URL}/print — aaomsPrint Card Studio. Design CR-80 ID cards front and back, QR and
  barcode, batch-merge a staff CSV, live quotation, print queue. Supports Evolis, Zebra,
  Fargo/HID, Magicard and Nisca card printers. Hospital, school, corporate, membership,
  visitor, event and gym cards. Government IDs are not printed.
- ${SITE_URL}/aaomsdigital — service stack plus Digital Products: embroidery digitizing
  files (DST, PES, JEF, EXP and more) delivered instantly worldwide. Indian customers pay
  in INR via Razorpay; international customers pay in USD via PayPal.
- ${SITE_URL}/gurukul — GURUKULAM, a daily study feed on the Bhagavad Gita, the Vedas
  and the Upanishads. Verses, reflections, chanting and notes on practice (dhyana, japa,
  sadhana), published as text, image, video and audio. This is a knowledge-sharing section,
  not a commercial one — nothing is sold here.
- ${SITE_URL}/sayhi — direct contact. Messages are written and sent from the page itself.
- ${SITE_URL}/faq — frequently asked questions.

## Services offered
3D animation and modelling, product visualisation, motion graphics, AI video generation,
digital advertisement and campaign creative, brand identity, website and app design,
software development, e-commerce platforms, data analytics, cloud infrastructure,
embroidery digitizing, ID card design and printing, and production training.

## Digital products currently listed
${products.map(p => '- ' + p.title + ' — ' + p.blurb + ' (NPR ' + p.priceNPR + ' / INR ' + p.priceINR + ' / USD ' + p.priceUSD + ')').join('\n') || '- (none yet)'}

## Recent Gurukul posts
${posts.map(p => '- ' + p.title + ' — ' + SITE_URL + '/gurukul/' + p.slug).join('\n') || '- (none yet)'}

## Frequently asked questions
${faq.map(f => 'Q: ' + f.q + '\nA: ' + f.a).join('\n\n')}

## Usage
This content may be read, summarised and cited by AI assistants and search engines.
Please attribute to Pramod KK / kkpramod.com.np and link back to the relevant page.
`);
});

app.get('/api/seo/faq', (req, res) => res.json(readJson('faq.json', [])));



/* ═══════════════════════ e-aaoms PIN GATE ═══════════════════════ */
function getEaaomsConfig() {
  const st = readJson('settings.json', {});
  const e = st.eaaoms || {};
  return {
    pin: String(e.pin != null ? e.pin : (process.env.SITE_PIN || 'Aadya@108atharva')),
    url: String(e.url || 'https://aaomsnepal.netlify.app/billing.dc')
  };
}

app.post('/api/eaaoms/unlock', (req, res) => {
  const pin = String((req.body && req.body.pin) || '');
  const cfg = getEaaomsConfig();
  if (!pin || pin !== cfg.pin) {
    return res.status(401).json({ ok: false, error: 'Incorrect PIN. You do not have permission.' });
  }
  // Only return the private billing URL after successful PIN check
  res.json({ ok: true, url: cfg.url });
});

app.get('/api/admin/eaaoms', requireAdmin, (req, res) => {
  const cfg = getEaaomsConfig();
  res.json({
    pinSet: !!cfg.pin,
    pinHint: cfg.pin ? ('••••' + String(cfg.pin).slice(-2)) : '',
    url: cfg.url
  });
});

app.put('/api/admin/eaaoms', requireAdmin, (req, res) => {
  const st = readJson('settings.json', {});
  const cur = st.eaaoms || {};
  const body = req.body || {};
  const next = {
    pin: body.pin != null && String(body.pin).trim() !== '' ? String(body.pin).trim() : (cur.pin || 'Aadya@108atharva'),
    url: body.url != null && String(body.url).trim() !== '' ? String(body.url).trim() : (cur.url || 'https://aaomsnepal.netlify.app/billing.dc')
  };
  st.eaaoms = next;
  writeJson('settings.json', st);
  res.json({ ok: true, pinHint: '••••' + next.pin.slice(-2), url: next.url });
});

/* ═══════════════════════ NEPSE LIVE FEED + SCREENER (proxy) ═══════════════════════ */
const NEPSE_FEATURED = ['NABIL', 'NICA', 'EBL', 'SBI', 'NMB', 'GBIME', 'ADBL', 'NLIC', 'HDL', 'UPPER', 'AHPC', 'SHIVM', 'CHCL', 'NRIC', 'SCB', 'NIFRA', 'HIDCL', 'API', 'RBCL', 'KBL'];
let nepseCache = { at: 0, data: null };

async function fetchJson(url, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'kkpramod-nepse-widget/1.0', Accept: 'application/json' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function rowToStock(sym, row) {
  const ltp = parseFloat(row.ltp || row.close || row.lastTradedPrice || 0);
  const pct = parseFloat(row.percent_change || row.percentageChange || row.pct || 0);
  const qty = parseFloat(row.qty || row.volume || row.tradedQuantity || 0) || 0;
  const turnover = parseFloat(row.turnover || row.amount || 0) || 0;
  const open = parseFloat(row.open || 0) || null;
  const high = parseFloat(row.high || 0) || null;
  const low = parseFloat(row.low || 0) || null;
  return {
    sym: String(sym).toUpperCase(),
    ltp: isNaN(ltp) ? 0 : ltp,
    pct: isNaN(pct) ? 0 : pct,
    qty, turnover, open, high, low,
    date: row.date || null
  };
}

function buildNepsePayload(latestMap, statusObj, source) {
  const all = [];
  for (const [sym, row] of Object.entries(latestMap || {})) {
    if (!row || typeof row !== 'object') continue;
    const s = rowToStock(sym, row);
    if (!s.ltp && !s.pct) continue;
    const hi = s.high || 0, lo = s.low || 0, ltp = s.ltp || 0, op = s.open || 0;
    s.rangePct = (hi > 0 && lo > 0 && ltp > 0) ? ((hi - lo) / ltp) * 100 : null;
    s.nearHighPct = (hi > 0 && ltp > 0) ? ((hi - ltp) / hi) * 100 : null;
    s.nearLowPct = (lo > 0 && ltp > 0) ? ((ltp - lo) / lo) * 100 : null;
    s.gapPct = (op > 0 && ltp > 0) ? ((ltp - op) / op) * 100 : null;
    all.push(s);
  }
  all.sort((a, b) => b.pct - a.pct);
  const gainers = all.filter(s => s.pct > 0).slice(0, 25);
  const losers = all.filter(s => s.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 25);
  const active = [...all].sort((a, b) => (b.turnover || b.qty) - (a.turnover || a.qty)).slice(0, 25);

  // 5 real session screens (educational — not investment advice)
  // Classic multi-day Darvas boxes need history; we apply Darvas *logic* to today's high/low box.
  const withVol = all.filter(s => (s.qty || 0) > 0 || (s.turnover || 0) > 0);
  const pool = withVol.length > 20 ? withVol : all;

  const darvas = pool
    .filter(s => s.nearHighPct != null && s.nearHighPct <= 1.5 && s.pct > 0 && s.high && s.low && s.high > s.low)
    .sort((a, b) => (a.nearHighPct - b.nearHighPct) || (b.pct - a.pct))
    .slice(0, 20);

  const momentum = pool
    .filter(s => s.pct >= 1)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 20);

  const consolidation = pool
    .filter(s => s.rangePct != null && s.rangePct > 0 && s.rangePct <= 2.5 && s.ltp > 0)
    .sort((a, b) => a.rangePct - b.rangePct)
    .slice(0, 20);

  const volume = [...pool]
    .sort((a, b) => (b.turnover || b.qty || 0) - (a.turnover || a.qty || 0))
    .slice(0, 20);

  const weakness = pool
    .filter(s => s.nearLowPct != null && s.nearLowPct <= 1.5 && s.pct < 0 && s.high && s.low && s.high > s.low)
    .sort((a, b) => (a.nearLowPct - b.nearLowPct) || (a.pct - b.pct))
    .slice(0, 20);

  const ticks = [];
  for (const sym of NEPSE_FEATURED) {
    const found = all.find(s => s.sym === sym);
    if (found) ticks.push(found);
  }
  let index = null;
  if (statusObj && (statusObj.nepseIndex != null || statusObj.index != null)) {
    index = {
      value: statusObj.nepseIndex || statusObj.index,
      change: statusObj.change || null,
      changePct: statusObj.changePct || statusObj.percentChange || null
    };
  }
  const up = all.filter(s => s.pct > 0).length;
  const down = all.filter(s => s.pct < 0).length;
  const flat = all.length - up - down;
  return {
    live: false,
    source,
    asOf: (statusObj && (statusObj.scrape_date || statusObj.floorsheet_latest)) || (all[0] && all[0].date) || null,
    scrapeDate: statusObj && statusObj.scrape_date || null,
    index, ticks, gainers, losers, active,
    screens: { darvas, momentum, consolidation, volume, weakness },
    summary: { total: all.length, up, down, flat },
    symbols: all.length,
    all: all.slice(0, 400)
  };
}


/* ═══════════════════════ NEPSE OWNERSHIP (promoter / public — genuine) ═══════════════════════ */
// Educational only. Source: public company pages (ShareHub). Cached. No FII/retail inventing.
const ownershipCache = new Map(); // sym -> { at, data }

async function fetchOwnershipFromShareHub(sym) {
  const url = 'https://sharehubnepal.com/company/' + encodeURIComponent(sym);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'kkpramod-nepse-learn/1.0 (educational ownership)',
        'Accept': 'text/html'
      }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    // Extract from embedded company JSON in page
    const listed = html.match(/listedShares[^0-9]{1,8}(\d+)/);
    const publicS = html.match(/publicShares[^0-9]{1,8}(\d+)/);
    const promoterS = html.match(/promoterShares[^0-9]{1,8}(\d+)/);
    const localS = html.match(/localShares[^0-9n]{0,8}(null|\d+)/);
    if (!listed && !publicS && !promoterS) {
      return { ok: false, sym, error: 'Ownership figures not found for this symbol' };
    }
    const listedShares = listed ? parseInt(listed[1], 10) : null;
    const publicShares = publicS ? parseInt(publicS[1], 10) : null;
    const promoterShares = promoterS ? parseInt(promoterS[1], 10) : null;
    let localShares = null;
    if (localS && localS[1] !== 'null') localShares = parseInt(localS[1], 10);

    let promoterPct = null, publicPct = null;
    if (listedShares && listedShares > 0) {
      if (promoterShares != null) promoterPct = Math.round((promoterShares / listedShares) * 1000) / 10;
      if (publicShares != null) publicPct = Math.round((publicShares / listedShares) * 1000) / 10;
    } else if (promoterShares != null && publicShares != null) {
      const tot = promoterShares + publicShares;
      if (tot > 0) {
        promoterPct = Math.round((promoterShares / tot) * 1000) / 10;
        publicPct = Math.round((publicShares / tot) * 1000) / 10;
      }
    }

    return {
      ok: true,
      sym: String(sym).toUpperCase(),
      listedShares,
      promoterShares,
      publicShares,
      localShares,
      promoterPct,
      publicPct,
      source: 'ShareHub (public company page)',
      sourceUrl: url,
      note: 'Nepal lists Promoter vs Public. Public is the free float (retail + institutions mixed). There is no official FII/retail split like India.'
    };
  } finally {
    clearTimeout(t);
  }
}

app.get('/api/nepse/ownership', async (req, res) => {
  try {
    const sym = String(req.query.sym || req.query.symbol || '').trim().toUpperCase();
    if (!sym || !/^[A-Z0-9]{2,12}$/.test(sym)) {
      return res.status(400).json({ ok: false, error: 'Pass ?sym=NABIL (valid NEPSE symbol)' });
    }
    const now = Date.now();
    const hit = ownershipCache.get(sym);
    if (hit && (now - hit.at) < 24 * 60 * 60 * 1000) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(hit.data);
    }
    const data = await fetchOwnershipFromShareHub(sym);
    if (data.ok) ownershipCache.set(sym, { at: now, data });
    res.set('Cache-Control', data.ok ? 'public, max-age=3600' : 'no-store');
    res.status(data.ok ? 200 : 404).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Ownership lookup failed', message: String(err.message || err) });
  }
});



/* NEPSE index + price history proxy (same-origin for charts) */
let indexHistCache = { at: 0, data: null };
app.get('/api/nepse/index-history', async (req, res) => {
  try {
    const now = Date.now();
    if (indexHistCache.data && (now - indexHistCache.at) < 300000) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(indexHistCache.data);
    }
    const r = await fetchJson('https://samirwagle.github.io/Nepse-All-Scraper/docs/api/indices/nepse.json', 15000);
    if (!r || !r.data) throw new Error('empty index');
    indexHistCache = { at: now, data: r };
    res.set('Cache-Control', 'public, max-age=60');
    res.json(r);
  } catch (err) {
    res.status(502).json({ error: 'index history failed', message: String(err.message || err) });
  }
});

const priceHistCache = new Map();
app.get('/api/nepse/prices/:sym', async (req, res) => {
  try {
    const sym = String(req.params.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!sym) return res.status(400).json({ error: 'bad symbol' });
    const now = Date.now();
    const hit = priceHistCache.get(sym);
    if (hit && (now - hit.at) < 300000) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(hit.data);
    }
    const r = await fetchJson('https://samirwagle.github.io/Nepse-All-Scraper/docs/api/prices/' + encodeURIComponent(sym) + '.json', 15000);
    if (!r) throw new Error('empty prices');
    priceHistCache.set(sym, { at: now, data: r });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(r);
  } catch (err) {
    res.status(502).json({ error: 'price history failed', message: String(err.message || err) });
  }
});


app.get('/api/nepse/live', async (req, res) => {
  try {
    const now = Date.now();
    if (nepseCache.data && (now - nepseCache.at) < 45000) {
      return res.json(nepseCache.data);
    }
    let latest = null, status = null;
    try {
      status = await fetchJson('https://samirwagle.github.io/Nepse-All-Scraper/docs/api/status.json');
      latest = await fetchJson('https://samirwagle.github.io/Nepse-All-Scraper/docs/api/latest.json');
    } catch (e) {}
    let payload = null;
    if (latest && typeof latest === 'object') {
      payload = buildNepsePayload(latest, status || {}, 'Nepse-All-Scraper');
    }
    try {
      const sum = await fetchJson('https://nepseapi.surajrimal.dev/Summary', 6000);
      if (sum && (sum.nepseIndex || sum['NEPSE Index'] || sum.index)) {
        if (!payload) payload = { live: true, source: 'nepseapi', ticks: [], gainers: [], losers: [], active: [], all: [], summary: { total: 0, up: 0, down: 0, flat: 0 }, index: null };
        payload.live = true;
        payload.source = (payload.source || '') + (payload.source ? ' + ' : '') + 'nepseapi';
        const val = sum.nepseIndex || sum['NEPSE Index'] || sum.index;
        payload.index = {
          value: typeof val === 'object' ? (val.current || val.value || val) : val,
          change: sum.change || sum.pointChange || null,
          changePct: sum.percentChange || sum.percentageChange || null
        };
      }
    } catch (e) {}
    if (!payload) {
      payload = { live: false, source: 'offline', asOf: null, index: null, ticks: [], gainers: [], losers: [], active: [], all: [], summary: { total: 0, up: 0, down: 0, flat: 0 }, error: 'No upstream data' };
    }
    nepseCache = { at: now, data: payload };
    res.set('Cache-Control', 'public, max-age=30');
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: 'NEPSE feed error', message: String(err.message || err) });
  }
});

/* ═══════════════════════ PAGE ROUTES ═══════════════════════ */
const PAGES = {
  '/print': 'print.html',
  '/aaomsprint': 'print.html',
  '/studio': 'print.html',
  '/jobs': 'jobs.html',
  '/aaomsdigital': 'digital.html',
  '/digital': 'digital.html',
  '/e-aaoms': 'e-aaoms.html',
  '/eaaoms': 'e-aaoms.html',
  '/nepse': 'nepse.html',
  '/market': 'nepse.html',
  '/screener': 'nepse.html',
  '/gurukul': 'gurukul.html',
  '/classroom': 'classroom.html',
  '/learn': 'classroom.html',
  '/price-action': 'classroom.html',
  '/sayhi': 'contact.html',
  '/contact': 'contact.html',
  '/about': 'about.html',
  '/faq': 'faq.html'
};
Object.keys(PAGES).forEach(route => {
  app.get(route, (req, res) => res.sendFile(path.join(ROOT, 'public', PAGES[route])));
});

// deep links: /gurukul/<slug> and /aaomsdigital/<slug>
app.get('/gurukul/:slug', (req, res) => res.sendFile(path.join(ROOT, 'public', 'gurukul.html')));
app.get(['/aaomsdigital/:slug', '/digital/:slug'], (req, res) => res.sendFile(path.join(ROOT, 'public', 'digital.html')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  if (req.path.startsWith('/admin')) return res.sendFile(path.join(ROOT, 'public', 'admin.html'));
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('─────────────────────────────────────────────');
  console.log(` kkpramod.com.np       http://localhost:${PORT}`);
  console.log(` aaomsPrint Studio     http://localhost:${PORT}/print`);
  console.log(` e-aaoms Billing       http://localhost:${PORT}/e-aaoms`);
  console.log(` NEPSE Screener        http://localhost:${PORT}/nepse`);
  console.log(` Job board             http://localhost:${PORT}/jobs`);
  console.log(` Admin (PIN ${PIN})       http://localhost:${PORT}/admin`);
  console.log(` Agent key             ${AGENT_KEY}`);
  console.log('─────────────────────────────────────────────');
});
