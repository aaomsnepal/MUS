/* ═══════════ Digital Gurukul — daily feed ═══════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const G = { posts: [], total: 0, offset: 0, limit: 8, tag: null, lang: 'en', singlePost: null };
const GK_LANGS = ['en', 'hi', 'ne'];

function initLang() {
  const saved = localStorage.getItem('gk_lang');
  if (saved && GK_LANGS.includes(saved)) { G.lang = saved; return; }
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('hi')) G.lang = 'hi';
  else if (nav.startsWith('ne')) G.lang = 'ne';
  else G.lang = 'en';
}
function setLang(lang) {
  G.lang = lang; localStorage.setItem('gk_lang', lang);
  document.querySelectorAll('.gk-lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  if (G.singlePost) renderSingle(G.singlePost);
  else rerenderFeed();
}
function pickLang(p) {
  const src = p.sourceLang || 'en';
  const want = G.lang;
  const L = p.i18n && p.i18n[want];
  const S = (p.i18n && p.i18n[src]) || { title: p.title, summary: p.summary, body: p.body, lesson: p.lesson };

  if (L && (L.title || L.body) && !L.failed) {
    // same text as source in another language = not a real translation yet
    if (want !== src && L.auto && S && L.body && S.body && String(L.body).trim() === String(S.body).trim()) {
      return { title: S.title, summary: S.summary, body: S.body, lesson: S.lesson, auto: false, fallback: src };
    }
    return L;
  }
  return {
    title: S.title || p.title || '',
    summary: S.summary || p.summary || '',
    body: S.body || p.body || '',
    lesson: S.lesson || p.lesson || '',
    auto: false,
    fallback: src
  };
}

function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const days = Math.floor((Date.now() - d) / 86400000);
  const stamp = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (days === 0) return 'today · ' + stamp;
  if (days === 1) return 'yesterday · ' + stamp;
  if (days < 8) return days + ' days ago · ' + stamp;
  return stamp;
}
function paragraphs(body) {
  return String(body || '').split(/\n{2,}/).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
}

function postCard(p, single) {
  const el = document.createElement('article');
  el.className = 'post reveal';
  const L = pickLang(p);
  let media = '';
  if (p.video) media = '<div class="post-media"><video controls preload="metadata"' + (p.image ? ' poster="' + esc(p.image) + '"' : '') + ' src="' + esc(p.video) + '"></video></div>';
  else if (p.image) media = '<div class="post-media"><img src="' + esc(p.image) + '" alt="' + esc(L.title) + '" loading="lazy"></div>';
  const audio = p.audio ? '<div class="post-audio"><audio controls preload="none" src="' + esc(p.audio) + '"></audio></div>' : '';
  const badge = L.fallback ? '<span class="auto-badge">shown in ' + esc(L.fallback.toUpperCase()) + '</span>'
    : (L.auto ? '<span class="auto-badge">auto-translated</span>' : '');
  el.innerHTML =
    '<div class="post-head"><span class="dot"></span><span>' + esc(when(p.createdAt)) + '</span>' +
      (p.tags && p.tags.length ? '<span>· ' + esc(p.tags[0]) + '</span>' : '') + '</div>' +
    media + audio +
    '<div class="post-body">' +
      '<h2>' + (single ? esc(L.title) : '<a href="/gurukul/' + esc(p.slug) + '">' + esc(L.title) + '</a>') + badge + '</h2>' +
      (L.summary ? '<p class="summary">' + esc(L.summary) + '</p>' : '') +
      (single || !L.body ? '<div class="text">' + paragraphs(L.body) + '</div>' : '') +
      (L.lesson ? '<div class="lesson"><b>Takeaway</b>' + esc(L.lesson) + '</div>' : '') +
      '<div class="post-tags">' + (p.tags || []).map(t => '<span class="pill">' + esc(t) + '</span>').join('') + '</div>' +
    '</div>' +
    '<div class="post-foot">' +
      (single ? '' : '<a href="/gurukul/' + esc(p.slug) + '">Read the full post →</a>') +
      '<span class="muted mono">' + (typeof p.views === 'number' ? p.views.toLocaleString() + ' views' : '') +
      (p.video ? ' · video' : p.audio ? ' · audio' : p.image ? ' · image' : ' · note') + '</span></div>';
  return el;
}
function rerenderFeed() {
  const feed = $('feed');
  feed.innerHTML = '';
  if (!G.posts.length) { feed.innerHTML = emptyState(); return; }
  G.posts.forEach(p => feed.appendChild(postCard(p, false)));
  AA.initReveal();
}
function renderSingle(p) {
  const feed = $('feed');
  const L = pickLang(p);
  document.title = L.title + ' — GURUKULAM · Pramod KK';
  const md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute('content', (L.summary || L.body || '').slice(0, 300));
  feed.innerHTML = '<a class="single-back" href="/gurukul">← back to the feed</a>';
  feed.appendChild(postCard(p, true));
  AA.initReveal();
  // count one public view per full open (increases from the 2000+ seed)
  try {
    fetch('/api/posts/' + encodeURIComponent(p.slug) + '/view', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d && d.views != null) p.views = d.views; })
      .catch(() => {});
  } catch (e) {}
}

function buildFilters() {
  const box = $('gkFilters'); if (!box) return;
  const tags = {};
  G.posts.forEach(p => (p.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
  const list = Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 10);
  box.innerHTML = '';
  const all = document.createElement('button');
  all.textContent = 'Everything'; all.className = G.tag ? '' : 'active';
  all.onclick = () => { G.tag = null; reload(); };
  box.appendChild(all);
  list.forEach(t => {
    const b = document.createElement('button');
    b.textContent = t; if (G.tag === t) b.className = 'active';
    b.onclick = () => { G.tag = t; reload(); };
    box.appendChild(b);
  });
}

function emptyState() {
  return '<div class="gk-empty"><b>The first verse is coming</b>' +
    'This is where the daily study is written — a shloka, what it opened, a chant, a quiet note.<br><br>' +
    'If there is something you want taken up first, say so on the <a class="gold" href="/sayhi">Say Hi</a> page.</div>';
}

async function loadFeed(append) {
  const feed = $('feed');
  try {
    const q = '/api/posts?limit=' + G.limit + '&offset=' + G.offset + (G.tag ? '&tag=' + encodeURIComponent(G.tag) : '');
    const r = await AA.api(q);
    G.total = r.total;
    if (!append) { feed.innerHTML = ''; G.posts = []; }
    G.posts = G.posts.concat(r.posts);
    if (!G.posts.length) { feed.innerHTML = emptyState(); $('btnMore').style.display = 'none'; $('postCount').textContent = 'opening soon'; return; }
    r.posts.forEach(p => feed.appendChild(postCard(p, false)));
    $('postCount').textContent = G.total + (G.total === 1 ? ' post' : ' posts');
    $('btnMore').style.display = (G.offset + r.posts.length) < G.total ? '' : 'none';
    if (!append) buildFilters();
    AA.initReveal();
  } catch (e) {
    feed.innerHTML = emptyState();
    $('btnMore').style.display = 'none';
  }
}
function reload() { G.offset = 0; loadFeed(false); }

async function loadSingle(slug) {
  const feed = $('feed');
  try {
    const p = await AA.api('/api/posts/' + encodeURIComponent(slug));
    G.singlePost = p;
    const L = pickLang(p);
    const link = document.querySelector('link[rel=canonical]');
    if (link) link.setAttribute('href', 'https://kkpramod.com.np/gurukul/' + p.slug);

    renderSingle(p);
    $('btnMore').style.display = 'none';
    $('gkFilters').style.display = 'none';
    $('postCount').textContent = 'single post';

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPost',
      headline: L.title,
      description: L.summary || String(L.body || '').slice(0, 240),
      image: p.image ? ['https://kkpramod.com.np' + p.image] : undefined,
      datePublished: p.createdAt, dateModified: p.updatedAt || p.createdAt,
      author: { '@type': 'Person', name: 'Pramod KK', url: 'https://kkpramod.com.np' },
      publisher: { '@type': 'Organization', name: 'GURUKULAM', logo: { '@type': 'ImageObject', url: 'https://kkpramod.com.np/assets/logo-infinity.png' } },
      mainEntityOfPage: 'https://kkpramod.com.np/gurukul/' + p.slug,
      keywords: (p.tags || []).join(', '),
      articleSection: 'Vedic study',
      inLanguage: G.lang
    });
    document.head.appendChild(ld);
    AA.initReveal();
  } catch (e) {
    feed.innerHTML = '<div class="gk-empty"><b>That post is not here</b>It may have been renamed or removed. <a class="gold" href="/gurukul">Back to the feed →</a></div>';
    $('btnMore').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLang();
  document.querySelectorAll('.gk-lang-btn').forEach(b => {
    if (b.dataset.lang === G.lang) b.classList.add('active');
    b.addEventListener('click', () => setLang(b.dataset.lang));
  });
  AA.initTicker('.aa-ticker .track', [
    'GURUKULAM · <b>daily</b>',
    'भगवद्गीता · <b>Bhagavad Gita</b>',
    'ऋग्वेद · यजुर्वेद · सामवेद · <b>अथर्ववेद</b>',
    'Upanishad · <b>Vedanta</b>',
    'ध्यान · जप · <b>साधना</b>',
    'श्रद्धावान् लभते ज्ञानम् · <b>knowledge comes to the earnest</b>',
    'one verse a day · <b>studied slowly</b>'
  ]);
  $('btnMore').onclick = () => { G.offset += G.limit; loadFeed(true); };
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'gurukul' && parts[1]) loadSingle(parts[1]);
  else loadFeed(false);
});
})();
