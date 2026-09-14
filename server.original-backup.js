const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PIN = process.env.SITE_PIN || '6143';
const sessions = new Set();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public')));

function readJson(name, fb) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); }
  catch { return fb; }
}
function writeJson(name, data) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(data, null, 2));
}

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
  res.json({
    lines: kb.bootLines || [],
    identity: kb.identity || {},
    tagline: kb.identity?.tagline
  });
});

app.get('/api/stream', (req, res) => {
  const kb = readJson('knowledge.json', {});
  res.json({ lines: kb.streamLines || [] });
});

app.post('/api/ask', (req, res) => {
  const q = req.body?.q || req.body?.question || '';
  res.json({ answer: answerQuestion(q) });
});

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

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  if (req.path.startsWith('/admin')) return res.sendFile(path.join(ROOT, 'public', 'admin.html'));
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`kkpramod.com.np http://localhost:${PORT}`);
  console.log(`Admin http://localhost:${PORT}/admin  PIN ${PIN}`);
});
