/* ═══════════ Control Room ═══════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
const TABS = [
  ['dash', 'Dashboard'], ['jobs', 'Card jobs'], ['posts', 'Gurukul posts'],
  ['classroomPosts', 'Classroom posts'],
  ['products', 'Digital products'], ['orders', 'Orders'], ['payments', 'Payments'],
  ['inbox', 'Inbox'], ['clients', 'Clients'], ['pricing', 'Pricing'],
  ['printers', 'Printers'], ['designs', 'Designs'], ['classroom', 'Classroom slides'],
  ['siteImages', 'Site images'],
  ['seo', 'FAQ & SEO'], ['brain', 'Terminal brain']
];
let KB = {}, pricing = null, printers = [];
let editPostId = null, editProdId = null;
const media = { image: '', video: '', audio: '', thumb: '', files: [], qr: '' };

/* ── tabs ── */
function buildTabs() {
  const box = $('tabs');
  TABS.forEach(([key, label], i) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => show(key);
    b.dataset.tab = key;
    if (i === 0) b.classList.add('active');
    box.appendChild(b);
  });
}
function show(key) {
  document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('hide', p.dataset.pane !== key));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
  const loaders = { dash: loadDash, jobs: loadJobs, posts: loadPosts, classroomPosts: loadClassroomPosts, products: loadProducts,
    orders: loadOrders, payments: loadPayments, inbox: loadInbox, clients: loadClients,
    pricing: loadPricing, printers: loadPrinters, designs: loadDesigns, classroom: loadClassroom,
    siteImages: loadSiteImages,
    seo: loadFaq, brain: loadBrain };
  if (loaders[key]) loaders[key]();
}

/* ── auth ── */
async function login() {
  try {
    const r = await AA.api('/api/admin/login', { method: 'POST', body: { pin: $('pin').value } });
    AA.token = r.token; sessionStorage.setItem('aaoms_token', r.token);
    enter();
  } catch (e) { $('gateMsg').textContent = e.message; }
}
function enter() {
  $('gate').classList.add('hide');
  $('app').classList.remove('hide');
  $('btnLogout').classList.remove('hide');
  show('dash');
}

/* ── uploads ── */
function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });
}
async function uploadMedia(file, logEl) {
  const dataUrl = await readFile(file);
  logEl.textContent += '\nuploading ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)…';
  const r = await AA.api('/api/admin/media', { method: 'POST', body: { dataUrl } });
  logEl.textContent += '\n✓ ' + r.url;
  return r.url;
}
async function uploadProductFile(file, logEl) {
  const dataUrl = await readFile(file);
  const base64 = dataUrl.split(',')[1];
  logEl.textContent += '\nuploading ' + file.name + '…';
  const r = await AA.api('/api/admin/product-file', { method: 'POST', body: { name: file.name, base64 } });
  logEl.textContent += '\n✓ stored ' + r.name;
  return { name: r.name, stored: r.stored };
}

/* ── site images (fixed brand assets, editable in place) ── */
async function loadSiteImages() {
  const box = $('siteImagesGrid');
  if (!box) return;
  try {
    const slots = await AA.api('/api/admin/site-images');
    box.innerHTML = slots.map(s => (
      '<div class="card" style="padding:14px">' +
        '<img src="' + esc(s.url) + '" alt="" style="max-width:160px;max-height:100px;object-fit:contain;display:block;background:#0002;border-radius:8px;padding:8px">' +
        '<div style="margin-top:8px"><b>' + esc(s.label) + '</b></div>' +
        '<div class="hint">' + esc(s.note) + '</div>' +
        '<div class="field" style="margin-top:8px">' +
          '<input type="file" accept="image/*" data-imgkey="' + esc(s.key) + '">' +
        '</div>' +
        '<pre class="log" data-imglog="' + esc(s.key) + '" style="min-height:0"></pre>' +
      '</div>'
    )).join('');
    box.querySelectorAll('input[type=file][data-imgkey]').forEach(inp => {
      inp.addEventListener('change', async () => {
        const key = inp.dataset.imgkey;
        const logEl = box.querySelector('[data-imglog="' + key + '"]');
        const file = inp.files && inp.files[0];
        if (!file) return;
        try {
          const dataUrl = await readFile(file);
          logEl.textContent = 'uploading ' + file.name + '…';
          const r = await AA.api('/api/admin/site-image/' + encodeURIComponent(key), { method: 'PUT', body: { dataUrl } });
          logEl.textContent = '✓ replaced — live now';
          AA.toast('Image updated', 'ok');
          loadSiteImages();
        } catch (e) {
          logEl.textContent = '✗ ' + e.message;
          AA.toast(e.message, 'err');
        }
      });
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ── dashboard ── */
async function loadDash() {
  try {
    const s = await AA.api('/api/admin/stats');
    const orders = await AA.api('/api/admin/orders');
    const msgs = await AA.api('/api/admin/messages');
    const posts = await AA.api('/api/admin/posts');
    const paid = orders.filter(o => o.status === 'paid');
    const stats = [
      [s.jobs, 'Card jobs'], [s.queue, 'In queue'], [s.cardsPrinted, 'Cards printed'],
      [s.clients, 'Clients'], [posts.length, 'Gurukul posts'], [paid.length, 'Paid orders'],
      [msgs.filter(m => !m.read).length, 'Unread messages'], [s.designs, 'Saved designs']
    ];
    $('statGrid').innerHTML = stats.map(([v, l]) =>
      '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>').join('');
    $('dashMsgs').innerHTML = msgs.slice(0, 5).map(m =>
      '<div class="li' + (m.read ? '' : ' unread') + '"><div class="t">' + esc(m.name) + ' · ' + esc(m.topic) + '</div>' +
      '<div class="m">' + esc(String(m.message).slice(0, 120)) + '…</div></div>').join('') || '<p class="hint">No messages yet.</p>';
    const jobs = await AA.api('/api/admin/jobs');
    $('dashJobs').innerHTML = jobs.filter(j => ['new', 'quoted', 'approved', 'printing'].includes(j.status)).slice(0, 6).map(j =>
      '<div class="li"><div class="t">' + esc(j.code) + ' · ' + esc(j.title) + '</div>' +
      '<div class="m">' + j.qty + ' cards · ' + j.status + '</div></div>').join('') || '<p class="hint">Queue is clear.</p>';
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ── posts ── */
const GK_LANG_LABEL = { en: 'English', hi: 'हिन्दी', ne: 'नेपाली' };
let pWriteLang = 'en';   // language for a brand-new post
let editLang = null;     // which language tab is open while editing an existing post
let editingPostsCache = [];

function langDot(post, lang) {
  if (!post || !post.i18n || !post.i18n[lang]) return '';
  if (post.sourceLang === lang) return ''; // source has no dot, it's the original
  return post.i18n[lang].auto === false ? '<span class="edited-dot" title="Manually edited"></span>' : '<span class="auto-dot" title="Auto-translated"></span>';
}

function renderLangPicker(post) {
  const box = $('pLangPicker');
  box.querySelectorAll('button').forEach(b => {
    const lang = b.dataset.lang;
    b.classList.toggle('active', post ? lang === editLang : lang === pWriteLang);
    // rebuild dot each time
    const existingDot = b.querySelector('.auto-dot,.edited-dot');
    if (existingDot) existingDot.remove();
    if (post) b.insertAdjacentHTML('beforeend', langDot(post, lang));
  });
  if (post) {
    const src = GK_LANG_LABEL[post.sourceLang || 'en'];
    $('pLangHint').textContent = editLang === post.sourceLang
      ? 'This is the original — written in ' + src + '.'
      : 'Viewing the ' + GK_LANG_LABEL[editLang] + ' version (translated from ' + src + '). Edit and save to correct it, or regenerate below.';
  } else {
    const others = ['en', 'hi', 'ne'].filter(l => l !== pWriteLang).map(l => GK_LANG_LABEL[l]).join(' and ');
    $('pLangHint').textContent = 'Writing a new post in ' + GK_LANG_LABEL[pWriteLang] + ' — ' + others + ' versions are created automatically when you publish.';
  }
}

async function loadPosts() {
  try {
    const list = await AA.api('/api/admin/posts?section=gurukul');
    editingPostsCache = list;
    $('postList').innerHTML = list.map(p => {
      const langBadges = ['en', 'hi', 'ne'].map(l =>
        '<span class="pill' + (p.sourceLang === l ? ' cy' : '') + '" style="font-size:10px;padding:2px 7px">' + l.toUpperCase() + langDot(p, l) + '</span>').join(' ');
      return '<div class="li"><div class="t">' + esc(p.title) + '</div>' +
      '<div class="m">' + new Date(p.createdAt).toLocaleDateString() + ' · ' +
      (typeof p.views === 'number' ? p.views.toLocaleString() + ' views · ' : '') +
      (p.tags || []).join(', ') +
      (p.video ? ' · video' : p.audio ? ' · audio' : p.image ? ' · image' : '') + '<br>' + langBadges + '</div>' +
      '<div class="acts"><a class="btn btn-ghost btn-sm" href="/gurukul/' + p.slug + '" target="_blank">View</a>' +
      '<button class="btn btn-cyan btn-sm" data-edit="' + p.id + '">Edit</button>' +
      '<button class="btn btn-ghost btn-sm" data-pub="' + p.id + '">' + (p.published === false ? 'Publish' : 'Hide') + '</button>' +
      '<button class="btn btn-red btn-sm" data-del="' + p.id + '">Delete</button></div></div>';
    }).join('')
      || '<p class="hint">No posts yet — write the first one.</p>';
    $('postList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this post?')) return;
      await AA.api('/api/admin/posts/' + b.dataset.del, { method: 'DELETE' });
      loadPosts();
    });
    $('postList').querySelectorAll('[data-pub]').forEach(b => b.onclick = async () => {
      const p = list.find(x => x.id === b.dataset.pub);
      await AA.api('/api/admin/posts/' + b.dataset.pub, { method: 'PUT', body: { published: p.published === false } });
      AA.toast(p.published === false ? 'Post is live' : 'Post hidden', 'ok');
      loadPosts();
    });
    $('postList').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const p = list.find(x => x.id === b.dataset.edit);
      editPostId = p.id;
      editLang = p.sourceLang || 'en';
      loadLangIntoForm(p, editLang);
      $('pTags').value = (p.tags || []).join(', ');
      media.image = p.image || ''; media.video = p.video || ''; media.audio = p.audio || '';
      $('pUpl').textContent = 'editing ' + p.slug + (p.image ? '\nimage kept' : '') + (p.video ? '\nvideo kept' : '') + (p.audio ? '\naudio kept' : '');
      $('pSave').textContent = 'Update post';
      renderLangPicker(p);
      showRetranslateBtn(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}
function loadLangIntoForm(post, lang) {
  const L = (post.i18n && post.i18n[lang]) || { title: post.title, summary: post.summary, body: post.body, lesson: post.lesson };
  $('pTitle').value = L.title || ''; $('pSummary').value = L.summary || '';
  $('pBody').value = L.body || ''; $('pLesson').value = L.lesson || '';
}
function showRetranslateBtn(post) {
  let btn = $('pRetranslate');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'pRetranslate'; btn.type = 'button'; btn.className = 'btn btn-ghost btn-sm';
    $('pLangHint').insertAdjacentElement('afterend', btn);
  }
  if (editLang === post.sourceLang) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.textContent = '↻ Regenerate ' + GK_LANG_LABEL[editLang] + ' translation from source';
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Translating…';
    try {
      const updated = await AA.api('/api/admin/posts/' + post.id + '/retranslate/' + editLang, { method: 'POST' });
      const idx = editingPostsCache.findIndex(x => x.id === updated.id);
      if (idx >= 0) editingPostsCache[idx] = updated;
      loadLangIntoForm(updated, editLang);
      renderLangPicker(updated);
      AA.toast('Retranslated', 'ok');
    } catch (e) { AA.toast(e.message, 'err'); }
    btn.disabled = false; showRetranslateBtn(post);
  };
}
function wirePosts() {
  const log = $('pUpl');
  $('pImage').onchange = async e => { if (e.target.files[0]) media.image = await uploadMedia(e.target.files[0], log); };
  $('pVideo').onchange = async e => { if (e.target.files[0]) media.video = await uploadMedia(e.target.files[0], log); };
  $('pAudio').onchange = async e => { if (e.target.files[0]) media.audio = await uploadMedia(e.target.files[0], log); };
  $('pLangPicker').querySelectorAll('button').forEach(b => b.onclick = () => {
    const lang = b.dataset.lang;
    if (!editPostId) {
      pWriteLang = lang; renderLangPicker(null); return;
    }
    const p = editingPostsCache.find(x => x.id === editPostId);
    if (!p) return;
    editLang = lang;
    loadLangIntoForm(p, editLang);
    renderLangPicker(p);
    showRetranslateBtn(p);
  });
  $('pClear').onclick = () => {
    ['pTitle', 'pSummary', 'pBody', 'pLesson', 'pTags'].forEach(i => $(i).value = '');
    media.image = media.video = media.audio = ''; log.textContent = '';
    editPostId = null; editLang = null; pWriteLang = 'en';
    $('pSave').textContent = 'Publish post'; $('pMsg').textContent = '';
    const rb = $('pRetranslate'); if (rb) rb.style.display = 'none';
    renderLangPicker(null);
  };
  $('pSave').onclick = async () => {
    if (!$('pTitle').value.trim()) { AA.toast('Give the post a title', 'err'); return; }
    try {
      if (editPostId) {
        // shared fields (tags/media) always saved; text fields save only to the language tab currently open
        await AA.api('/api/admin/posts/' + editPostId, {
          method: 'PUT',
          body: { tags: $('pTags').value.split(',').map(t => t.trim()).filter(Boolean), image: media.image, video: media.video, audio: media.audio }
        });
        const updated = await AA.api('/api/admin/posts/' + editPostId + '/i18n/' + editLang, {
          method: 'PUT',
          body: { title: $('pTitle').value, summary: $('pSummary').value, body: $('pBody').value, lesson: $('pLesson').value }
        });
        const idx = editingPostsCache.findIndex(x => x.id === updated.id);
        if (idx >= 0) editingPostsCache[idx] = updated;
        AA.toast(GK_LANG_LABEL[editLang] + ' version updated', 'ok');
      } else {
        const body = {
          section: 'gurukul',
          title: $('pTitle').value, summary: $('pSummary').value, body: $('pBody').value,
          lesson: $('pLesson').value, lang: pWriteLang,
          tags: $('pTags').value.split(',').map(t => t.trim()).filter(Boolean),
          image: media.image, video: media.video, audio: media.audio
        };
        AA.toast('Publishing and translating…', 'ok');
        await AA.api('/api/admin/posts', { method: 'POST', body });
        AA.toast('Gurukul post published (views ~2000+)', 'ok');
      }
      $('pClear').click(); loadPosts();
    } catch (e) { AA.toast(e.message, 'err'); }
  };
  renderLangPicker(null);
}


/* ── classroom posts (separate panel) ── */
const cpMedia = { image: '', video: '', audio: '' };
let cpWriteLang = 'en';
let cpEditId = null;
let cpEditLang = null;
let cpCache = [];

function renderCpLangPicker(post) {
  const box = $('cpLangPicker');
  if (!box) return;
  box.querySelectorAll('button').forEach(b => {
    const lang = b.dataset.lang;
    b.classList.toggle('active', post ? lang === cpEditLang : lang === cpWriteLang);
  });
  const hint = $('cpLangHint');
  if (!hint) return;
  if (post) {
    const src = GK_LANG_LABEL[post.sourceLang || 'en'];
    hint.textContent = cpEditLang === post.sourceLang
      ? 'Original written in ' + src + '.'
      : 'Viewing ' + GK_LANG_LABEL[cpEditLang] + ' (from ' + src + ').';
  } else {
    hint.textContent = 'Writing a new classroom post in ' + GK_LANG_LABEL[cpWriteLang] + '.';
  }
}

function loadCpLangIntoForm(p, lang) {
  const L = (p.i18n && p.i18n[lang]) || {};
  const src = (p.i18n && p.i18n[p.sourceLang || 'en']) || p;
  $('cpTitle').value = L.title != null ? L.title : (src.title || p.title || '');
  $('cpSummary').value = L.summary != null ? L.summary : (src.summary || p.summary || '');
  $('cpBody').value = L.body != null ? L.body : (src.body || p.body || '');
  $('cpLesson').value = L.lesson != null ? L.lesson : (src.lesson || p.lesson || '');
  $('cpTags').value = (p.tags || []).join(', ');
  cpMedia.image = p.image || '';
  cpMedia.video = p.video || '';
  cpMedia.audio = p.audio || '';
  const log = $('cpUpl');
  if (log) log.textContent = [cpMedia.image && 'image', cpMedia.video && 'video', cpMedia.audio && 'audio'].filter(Boolean).join(' · ') || '';
}

async function loadClassroomPosts() {
  try {
    const list = await AA.api('/api/admin/posts?section=classroom');
    cpCache = list || [];
    const box = $('cpList');
    if (!box) return;
    box.innerHTML = cpCache.map(p =>
      '<div class="li">' +
        '<div class="t">' + esc(p.title) + '</div>' +
        '<div class="m">' + esc((p.createdAt || '').slice(0, 10)) +
          ' · ' + (p.views != null ? Number(p.views).toLocaleString() + ' views' : '') +
          (p.published === false ? ' · <span style="color:#f87171">draft</span>' : ' · live') +
        '</div>' +
        '<div class="row" style="gap:6px;margin-top:6px">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cp-edit="' + p.id + '">Edit</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cp-pub="' + p.id + '">' +
            (p.published === false ? 'Publish' : 'Unpublish') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cp-del="' + p.id + '">Delete</button>' +
        '</div>' +
      '</div>'
    ).join('') || '<p class="hint">No classroom posts yet — write the first one.</p>';

    box.querySelectorAll('[data-cp-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this classroom post?')) return;
      await AA.api('/api/admin/posts/' + b.dataset.cpDel, { method: 'DELETE' });
      loadClassroomPosts();
    });
    box.querySelectorAll('[data-cp-pub]').forEach(b => b.onclick = async () => {
      const p = cpCache.find(x => x.id === b.dataset.cpPub);
      if (!p) return;
      await AA.api('/api/admin/posts/' + b.dataset.cpPub, {
        method: 'PUT',
        body: { published: p.published === false }
      });
      loadClassroomPosts();
    });
    box.querySelectorAll('[data-cp-edit]').forEach(b => b.onclick = () => {
      const p = cpCache.find(x => x.id === b.dataset.cpEdit);
      if (!p) return;
      cpEditId = p.id;
      cpEditLang = p.sourceLang || 'en';
      loadCpLangIntoForm(p, cpEditLang);
      renderCpLangPicker(p);
      $('cpSave').textContent = 'Save changes';
      $('cpMsg').textContent = 'Editing · ' + (p.views != null ? p.views + ' views' : '');
    });
  } catch (e) {
    AA.toast(e.message || 'Failed to load classroom posts', 'err');
  }
}

function wireClassroomPosts() {
  if (!$('cpSave')) return;
  const log = $('cpUpl') || { textContent: '' };
  if ($('cpImage')) $('cpImage').onchange = async e => {
    if (!e.target.files[0]) return;
    try { cpMedia.image = await uploadMedia(e.target.files[0], log); AA.toast('Image uploaded', 'ok'); }
    catch (err) { AA.toast(err.message, 'err'); }
  };
  if ($('cpVideo')) $('cpVideo').onchange = async e => {
    if (!e.target.files[0]) return;
    try { cpMedia.video = await uploadMedia(e.target.files[0], log); AA.toast('Video uploaded', 'ok'); }
    catch (err) { AA.toast(err.message, 'err'); }
  };
  if ($('cpAudio')) $('cpAudio').onchange = async e => {
    if (!e.target.files[0]) return;
    try { cpMedia.audio = await uploadMedia(e.target.files[0], log); AA.toast('Audio uploaded', 'ok'); }
    catch (err) { AA.toast(err.message, 'err'); }
  };
  if ($('cpLangPicker')) {
    $('cpLangPicker').querySelectorAll('button').forEach(b => b.onclick = () => {
      const lang = b.dataset.lang;
      if (!cpEditId) {
        cpWriteLang = lang;
        renderCpLangPicker(null);
        return;
      }
      const p = cpCache.find(x => x.id === cpEditId);
      if (!p) return;
      cpEditLang = lang;
      loadCpLangIntoForm(p, cpEditLang);
      renderCpLangPicker(p);
    });
  }
  $('cpClear').onclick = () => {
    ['cpTitle', 'cpSummary', 'cpBody', 'cpLesson', 'cpTags'].forEach(i => { if ($(i)) $(i).value = ''; });
    cpMedia.image = cpMedia.video = cpMedia.audio = '';
    if (log) log.textContent = '';
    cpEditId = null; cpEditLang = null; cpWriteLang = 'en';
    $('cpSave').textContent = 'Publish classroom post';
    $('cpMsg').textContent = '';
    renderCpLangPicker(null);
  };
  $('cpSave').onclick = async () => {
    if (!$('cpTitle').value.trim()) { AA.toast('Give the post a title', 'err'); return; }
    try {
      if (cpEditId) {
        await AA.api('/api/admin/posts/' + cpEditId, {
          method: 'PUT',
          body: {
            section: 'classroom',
            tags: $('cpTags').value.split(',').map(t => t.trim()).filter(Boolean),
            image: cpMedia.image, video: cpMedia.video, audio: cpMedia.audio
          }
        });
        const updated = await AA.api('/api/admin/posts/' + cpEditId + '/i18n/' + (cpEditLang || 'en'), {
          method: 'PUT',
          body: {
            title: $('cpTitle').value,
            summary: $('cpSummary').value,
            body: $('cpBody').value,
            lesson: $('cpLesson').value
          }
        });
        const idx = cpCache.findIndex(x => x.id === updated.id);
        if (idx >= 0) cpCache[idx] = updated;
        AA.toast('Classroom post updated', 'ok');
      } else {
        const body = {
          section: 'classroom',
          title: $('cpTitle').value,
          summary: $('cpSummary').value,
          body: $('cpBody').value,
          lesson: $('cpLesson').value,
          lang: cpWriteLang,
          tags: $('cpTags').value.split(',').map(t => t.trim()).filter(Boolean),
          image: cpMedia.image,
          video: cpMedia.video,
          audio: cpMedia.audio
        };
        AA.toast('Publishing classroom post…', 'ok');
        const rec = await AA.api('/api/admin/posts', { method: 'POST', body });
        AA.toast('Published · starting views ' + (rec.views || '~1000+'), 'ok');
      }
      $('cpClear').click();
      loadClassroomPosts();
    } catch (e) { AA.toast(e.message, 'err'); }
  };
  renderCpLangPicker(null);
}

/* ── products ── */
async function loadProducts() {
  try {
    const list = await AA.api('/api/admin/products');
    $('prodList').innerHTML = list.map(p =>
      '<div class="li"><div class="t">' + esc(p.title) + '</div>' +
      '<div class="m">रु ' + p.priceNPR + ' · ₹ ' + p.priceINR + ' · $ ' + p.priceUSD +
      ' · ' + (p.files || []).length + ' file(s)' + (p.featured ? ' · featured' : '') + '</div>' +
      '<div class="acts"><button class="btn btn-cyan btn-sm" data-edit="' + p.id + '">Edit</button>' +
      '<button class="btn btn-ghost btn-sm" data-feat="' + p.id + '">' + (p.featured ? 'Unfeature' : 'Feature') + '</button>' +
      '<button class="btn btn-red btn-sm" data-del="' + p.id + '">Delete</button></div></div>').join('')
      || '<p class="hint">No products yet.</p>';
    $('prodList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this product?')) return;
      await AA.api('/api/admin/products/' + b.dataset.del, { method: 'DELETE' });
      loadProducts();
    });
    $('prodList').querySelectorAll('[data-feat]').forEach(b => b.onclick = async () => {
      const p = list.find(x => x.id === b.dataset.feat);
      await AA.api('/api/admin/products/' + b.dataset.feat, { method: 'PUT', body: { featured: !p.featured } });
      loadProducts();
    });
    $('prodList').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const p = list.find(x => x.id === b.dataset.edit);
      editProdId = p.id;
      $('prTitle').value = p.title; $('prCat').value = p.category || '';
      $('prFormats').value = (p.formats || []).join(', ');
      $('prBlurb').value = p.blurb || ''; $('prDesc').value = p.description || '';
      $('prStitch').value = p.stitches || 0; $('prSize').value = p.sizeMm || '';
      $('prCol').value = p.colours || 0;
      $('prNPR').value = p.priceNPR; $('prINR').value = p.priceINR; $('prUSD').value = p.priceUSD;
      $('prFeat').checked = !!p.featured;
      media.thumb = p.thumb || ''; media.files = p.files || [];
      $('prUpl').textContent = 'editing ' + p.slug + '\n' + (p.files || []).length + ' file(s) kept';
      $('prSave').textContent = 'Update product';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}
function wireProducts() {
  const log = $('prUpl');
  $('prThumb').onchange = async e => { if (e.target.files[0]) media.thumb = await uploadMedia(e.target.files[0], log); };
  $('prFiles').onchange = async e => {
    media.files = [];
    for (const f of e.target.files) media.files.push(await uploadProductFile(f, log));
  };
  $('prSave').onclick = async () => {
    if (!$('prTitle').value.trim()) { AA.toast('Title required', 'err'); return; }
    try {
      await AA.api('/api/admin/products' + (editProdId ? '/' + editProdId : ''), {
        method: editProdId ? 'PUT' : 'POST',
        body: {
          title: $('prTitle').value, category: $('prCat').value, blurb: $('prBlurb').value,
          description: $('prDesc').value,
          formats: $('prFormats').value.split(',').map(s => s.trim()).filter(Boolean),
          stitches: +$('prStitch').value, sizeMm: $('prSize').value, colours: +$('prCol').value,
          priceNPR: +$('prNPR').value, priceINR: +$('prINR').value, priceUSD: +$('prUSD').value,
          thumb: media.thumb, files: media.files, featured: $('prFeat').checked
        }
      });
      AA.toast(editProdId ? 'Product updated' : 'Product added', 'ok');
      $('prMsg').textContent = editProdId ? 'updated' : 'added';
      editProdId = null; $('prSave').textContent = 'Add product';
      ['prTitle','prBlurb','prDesc','prSize'].forEach(i => $(i).value = '');
      media.thumb = ''; media.files = []; log.textContent = '';
      loadProducts();
    } catch (e) { AA.toast(e.message, 'err'); }
  };
}

/* ── orders ── */
async function loadOrders() {
  try {
    const list = await AA.api('/api/admin/orders');
    $('ordTable').innerHTML =
      '<thead><tr><th>Code</th><th>Buyer</th><th>Items</th><th>Amount</th><th>Via</th><th>Status</th><th></th></tr></thead><tbody>' +
      (list.map(o =>
        '<tr><td class="mono">' + esc(o.code) + '</td>' +
        '<td>' + esc(o.name || '—') + '<br><span class="muted" style="font-size:11px">' + esc(o.email) + '</span></td>' +
        '<td>' + o.items.map(i => esc(i.title)).join('<br>') + '</td>' +
        '<td>' + o.currency + ' ' + o.amount + '</td>' +
        '<td>' + esc(o.provider) + '</td>' +
        '<td><span class="pill ' + (o.status === 'paid' ? 'ok' : '') + '">' + o.status + '</span></td>' +
        '<td>' + (o.status === 'paid'
          ? '<button class="btn btn-ghost btn-sm" data-re="' + o.id + '">Reissue link</button>'
          : '<button class="btn btn-gold btn-sm" data-rel="' + o.id + '">Release files</button>') + '</td></tr>'
      ).join('') || '<tr><td colspan="7" class="dim">No orders yet.</td></tr>') + '</tbody>';
    $('ordTable').querySelectorAll('[data-re]').forEach(b => b.onclick = async () => {
      const r = await AA.api('/api/admin/orders/' + b.dataset.re + '/reissue', { method: 'POST' });
      prompt('New download link (valid 7 days):', location.origin + '/api/store/download/' + r.token);
    });
    $('ordTable').querySelectorAll('[data-rel]').forEach(b => b.onclick = async () => {
      if (!confirm('Confirm the payment has landed in PayPal, then release the files?')) return;
      const r = await AA.api('/api/admin/orders/' + b.dataset.rel + '/release', { method: 'POST' });
      const link = location.origin + '/api/store/download/' + r.token;
      prompt('Send this link to ' + (r.email || 'the buyer') + ' (valid 7 days):', link);
      loadOrders();
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ── inbox ── */
async function loadInbox() {
  try {
    const list = await AA.api('/api/admin/messages');
    $('msgList').innerHTML = list.map(m =>
      '<div class="li' + (m.read ? '' : ' unread') + '">' +
      '<div class="t">' + esc(m.code) + ' · ' + esc(m.name) + ' — ' + esc(m.topic) + '</div>' +
      '<div class="m">' + esc(m.email) + (m.phone ? ' · ' + esc(m.phone) : '') + (m.budget ? ' · ' + esc(m.budget) : '') +
      '<br>' + new Date(m.createdAt).toLocaleString() + '</div>' +
      '<div class="m mt8" style="white-space:pre-wrap;color:var(--ink)">' + esc(m.message) + '</div>' +
      '<div class="acts">' +
      (m.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(m.email) + '?subject=Re: your message ' + esc(m.code) + '">Reply by email</a>' : '') +
      (m.phone ? '<a class="btn btn-cyan btn-sm" target="_blank" href="https://wa.me/' + m.phone.replace(/[^0-9]/g, '') + '">WhatsApp</a>' : '') +
      '<button class="btn btn-ghost btn-sm" data-read="' + m.id + '">' + (m.read ? 'Mark unread' : 'Mark read') + '</button>' +
      '<button class="btn btn-red btn-sm" data-del="' + m.id + '">Delete</button></div></div>').join('')
      || '<p class="hint">Inbox is empty.</p>';
    $('msgList').querySelectorAll('[data-read]').forEach(b => b.onclick = async () => {
      const m = list.find(x => x.id === b.dataset.read);
      await AA.api('/api/admin/messages/' + b.dataset.read, { method: 'PUT', body: { read: !m.read } });
      loadInbox();
    });
    $('msgList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this message?')) return;
      await AA.api('/api/admin/messages/' + b.dataset.del, { method: 'DELETE' });
      loadInbox();
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ── clients ── */
async function loadClients() {
  try {
    const list = await AA.api('/api/admin/clients');
    $('clientList').innerHTML = list.map(c =>
      '<div class="li"><div class="t">' + esc(c.org) + '</div>' +
      '<div class="m">' + esc(c.contact || '—') + ' · ' + esc(c.phone || '') + ' · ' + esc(c.type) + '</div>' +
      '<div class="acts"><button class="btn btn-red btn-sm" data-del="' + c.id + '">Delete</button></div></div>').join('')
      || '<p class="hint">No clients yet.</p>';
    $('clientList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this client?')) return;
      await AA.api('/api/admin/clients/' + b.dataset.del, { method: 'DELETE' });
      loadClients();
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}
function wireClients() {
  $('clSave').onclick = async () => {
    if (!$('clOrg').value.trim()) { AA.toast('Organization required', 'err'); return; }
    await AA.api('/api/admin/clients', {
      method: 'POST',
      body: { org: $('clOrg').value, contact: $('clContact').value, type: $('clType').value,
        phone: $('clPhone').value, email: $('clEmail').value, address: $('clAddr').value, notes: $('clNotes').value }
    });
    ['clOrg', 'clContact', 'clPhone', 'clEmail', 'clAddr', 'clNotes'].forEach(i => $(i).value = '');
    AA.toast('Client saved', 'ok'); loadClients();
  };
}

/* ── pricing ── */
async function loadPricing() {
  pricing = await AA.api('/api/print/pricing');
  $('pcSingle').value = pricing.base.single; $('pcDouble').value = pricing.base.double;
  $('pcDesign').value = pricing.designFee; $('pcWaive').value = pricing.designFeeWaivedAt;
  $('pcDelivery').value = pricing.deliveryFee; $('pcVat').value = pricing.vatPercent;
  $('pcVatInc').checked = !!pricing.vatIncluded;
  $('tierList').innerHTML =
    '<h4 class="sub-h" style="font-family:Fraunces,serif;font-size:13px;margin:6px 0 8px">Quantity discounts</h4>' +
    pricing.tiers.map((t, i) =>
      '<div class="field" style="display:grid;grid-template-columns:1fr 110px;gap:10px;align-items:center">' +
      '<label style="margin:0">' + t.label + ' cards</label>' +
      '<input type="number" step="1" data-ti="' + i + '" value="' + Math.round((1 - t.mult) * 100) + '" title="discount %"></div>').join('') +
    '<h4 class="sub-h" style="font-family:Fraunces,serif;font-size:13px;margin:16px 0 8px">Finishing extras (per card)</h4>' +
    pricing.options.map((o, i) =>
      '<div class="field" style="display:grid;grid-template-columns:1fr 110px;gap:10px;align-items:center">' +
      '<label style="margin:0">' + esc(o.label) + '</label>' +
      '<input type="number" step="1" data-oi="' + i + '" value="' + o.price + '"></div>').join('');
}
function wirePricing() {
  $('pcSave').onclick = async () => {
    await AA.api('/api/admin/pricing', {
      method: 'PUT',
      body: {
        base: { single: +$('pcSingle').value, double: +$('pcDouble').value },
        designFee: +$('pcDesign').value, designFeeWaivedAt: +$('pcWaive').value,
        deliveryFee: +$('pcDelivery').value, vatPercent: +$('pcVat').value,
        vatIncluded: $('pcVatInc').checked
      }
    });
    AA.toast('Pricing saved', 'ok'); loadPricing();
  };
}

/* ── printers ── */
async function loadPrinters() {
  printers = await AA.api('/api/print/printers');
  loadPrintersRender();
}
function loadPrintersRender() {
  $('printerList').innerHTML = printers.map((p, i) =>
    '<div class="prt">' +
    '<div class="field"><label>Brand</label><input data-i="' + i + '" data-k="brand" value="' + esc(p.brand) + '"></div>' +
    '<div class="field"><label>Model</label><input data-i="' + i + '" data-k="model" value="' + esc(p.model) + '"></div>' +
    '<div class="field"><label>DPI</label><input type="number" data-i="' + i + '" data-k="dpi" value="' + p.dpi + '"></div>' +
    '<div class="field"><label>Ribbon</label><input data-i="' + i + '" data-k="ribbon" value="' + esc(p.ribbon) + '"></div>' +
    '<div class="field"><label>Bleed mm</label><input type="number" step="0.1" data-i="' + i + '" data-k="bleedMm" value="' + p.bleedMm + '"></div>' +
    '<div class="field"><label>Notes</label><input data-i="' + i + '" data-k="notes" value="' + esc(p.notes || '') + '"></div>' +
    '<div class="field"><label>&nbsp;</label><button class="btn btn-red btn-sm" data-pd="' + i + '">Remove</button></div>' +
    '</div>').join('');
  $('printerList').querySelectorAll('[data-pd]').forEach(b => b.onclick = () => {
    if (!confirm('Remove this printer profile?')) return;
    printers.splice(+b.dataset.pd, 1); loadPrintersRender();
  });
}
function wirePrinters() {
  $('prtSave').onclick = async () => {
    $('printerList').querySelectorAll('input').forEach(inp => {
      const p = printers[+inp.dataset.i];
      p[inp.dataset.k] = inp.type === 'number' ? parseFloat(inp.value) : inp.value;
    });
    await AA.api('/api/admin/printers', { method: 'PUT', body: printers });
    AA.toast('Printer profiles saved', 'ok');
  };
}

/* ── designs ── */
async function loadDesigns() {
  const list = await AA.api('/api/print/designs');
  $('designList').innerHTML = list.map(d =>
    '<div class="li"><div class="t">' + esc(d.name) + '</div>' +
    '<div class="m">' + (d.orient === 'h' ? 'landscape' : 'portrait') + ' · ' + new Date(d.updatedAt).toLocaleDateString() + '</div>' +
    '<div class="acts"><a class="btn btn-ghost btn-sm" href="/print">Open studio</a>' +
    '<button class="btn btn-red btn-sm" data-del="' + d.id + '">Delete</button></div></div>').join('')
    || '<p class="hint">No saved designs yet.</p>';
  $('designList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this design?')) return;
    await AA.api('/api/print/designs/' + b.dataset.del, { method: 'DELETE' });
    loadDesigns();
  });
}

/* ── terminal brain ── */
async function loadBrain() {
  KB = await AA.api('/api/admin/knowledge');
  $('kTagline').value = KB.identity?.tagline || '';
  $('kEmail').value = KB.identity?.email || '';
  $('kWa').value = KB.identity?.whatsapp || '';
  $('kBoot').value = (KB.bootLines || []).join('\n');

  $('kRoles').value = (KB.identity?.roles || []).join(', ');
  $('kExperience').value = KB.identity?.experienceYears || '';
  $('kTools').value = (KB.identity?.tools || []).join(', ');
  $('kLocation').value = KB.identity?.location || '';
  $('kCareer').value = (KB.identity?.career || []).join('\n');
  $('kVentures').value = (KB.identity?.ventures || []).join('\n');
  $('kStatus').value = KB.identity?.status || '';

  drawQA();
  drawPersonalQA();
}

/* general knowledge list — thousands of entries, so only render on search, capped */
function drawQA() {
  const term = ($('qaSearch').value || '').trim().toLowerCase();
  const all = (KB.qa || []);
  if (!term) {
    $('qaList').innerHTML = '<p class="hint">' + all.length.toLocaleString() + ' entries total — type above to search (results are capped to the first 100 matches).</p>';
    return;
  }
  const matches = [];
  for (let i = 0; i < all.length; i++) {
    const q = all[i];
    if (q.personal) continue; // shown in the "About you" panel instead
    const hay = ((q.keys || []).join(' ') + ' ' + q.answer).toLowerCase();
    if (hay.includes(term)) { matches.push(i); if (matches.length >= 100) break; }
  }
  $('qaList').innerHTML = matches.map(i => {
    const q = all[i];
    return '<div class="li"><div class="t mono" style="font-size:11.5px;color:var(--cyan)">' + esc((q.keys || []).join(' · ')) + '</div>' +
      '<div class="m" style="white-space:pre-wrap">' + esc(String(q.answer).slice(0, 200)) + '</div>' +
      '<div class="acts"><button class="btn btn-red btn-sm" data-qa="' + i + '">Remove</button></div></div>';
  }).join('') || '<p class="hint">No matches.</p>';
  $('qaList').querySelectorAll('[data-qa]').forEach(b => b.onclick = async () => {
    KB.qa.splice(+b.dataset.qa, 1);
    await AA.api('/api/admin/knowledge', { method: 'PUT', body: { qa: KB.qa } });
    drawQA(); drawPersonalQA();
  });
}

/* personal "about you" answers — small list, always fully shown and editable in place */
function drawPersonalQA() {
  const all = (KB.qa || []);
  const rows = [];
  for (let i = 0; i < all.length; i++) if (all[i].personal) rows.push(i);
  $('pqaList').innerHTML = rows.map(i => {
    const q = all[i];
    return '<div class="li">' +
      '<div class="field"><input class="mono" data-pk="' + i + '" value="' + esc((q.keys || []).join(', ')) + '"></div>' +
      '<div class="field"><textarea rows="2" data-pa="' + i + '">' + esc(q.answer) + '</textarea></div>' +
      '<div class="acts">' +
      '<button class="btn btn-gold btn-sm" data-psave="' + i + '">Save</button>' +
      '<button class="btn btn-red btn-sm" data-pdel="' + i + '">Remove</button>' +
      '</div></div>';
  }).join('') || '<p class="hint">No personal facts yet.</p>';

  $('pqaList').querySelectorAll('[data-psave]').forEach(b => b.onclick = async () => {
    const i = +b.dataset.psave;
    const keys = $('pqaList').querySelector('[data-pk="' + i + '"]').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const answer = $('pqaList').querySelector('[data-pa="' + i + '"]').value.trim();
    if (!keys.length || !answer) { AA.toast('Keywords and an answer are both needed', 'err'); return; }
    KB.qa[i].keys = keys; KB.qa[i].answer = answer;
    await AA.api('/api/admin/knowledge', { method: 'PUT', body: { qa: KB.qa } });
    AA.toast('Saved', 'ok'); drawPersonalQA();
  });
  $('pqaList').querySelectorAll('[data-pdel]').forEach(b => b.onclick = async () => {
    KB.qa.splice(+b.dataset.pdel, 1);
    await AA.api('/api/admin/knowledge', { method: 'PUT', body: { qa: KB.qa } });
    drawPersonalQA(); drawQA();
  });
}

function wireBrain() {
  $('kSave').onclick = async () => {
    await AA.api('/api/admin/knowledge', {
      method: 'PUT',
      body: {
        identity: { tagline: $('kTagline').value, email: $('kEmail').value, whatsapp: $('kWa').value },
        bootLines: $('kBoot').value.split('\n').filter(Boolean)
      }
    });
    $('kMsg').textContent = 'saved'; AA.toast('Saved', 'ok');
  };
  $('kAboutSave').onclick = async () => {
    const body = {
      identity: {
        roles: $('kRoles').value.split(',').map(s => s.trim()).filter(Boolean),
        experienceYears: $('kExperience').value.trim(),
        tools: $('kTools').value.split(',').map(s => s.trim()).filter(Boolean),
        location: $('kLocation').value.trim(),
        career: $('kCareer').value.split('\n').map(s => s.trim()).filter(Boolean),
        ventures: $('kVentures').value.split('\n').map(s => s.trim()).filter(Boolean),
        status: $('kStatus').value.trim()
      }
    };
    KB = await AA.api('/api/admin/knowledge', { method: 'PUT', body });
    $('kAboutMsg').textContent = 'saved'; AA.toast('Saved', 'ok');
  };
  $('qaAdd').onclick = async () => {
    const keys = $('qaKeys').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const answer = $('qaAns').value.trim();
    if (!keys.length || !answer) { AA.toast('Keywords and an answer are both needed', 'err'); return; }
    KB.qa = (KB.qa || []).concat({ keys, answer });
    await AA.api('/api/admin/knowledge', { method: 'PUT', body: { qa: KB.qa } });
    $('qaKeys').value = ''; $('qaAns').value = '';
    AA.toast('Answer added', 'ok'); drawQA();
  };
  $('qaSearch').oninput = () => drawQA();
  $('pqaAdd').onclick = async () => {
    const keys = $('pqaKeys').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const answer = $('pqaAns').value.trim();
    if (!keys.length || !answer) { AA.toast('Keywords and an answer are both needed', 'err'); return; }
    KB.qa = (KB.qa || []).concat({ keys, answer, personal: true });
    await AA.api('/api/admin/knowledge', { method: 'PUT', body: { qa: KB.qa } });
    $('pqaKeys').value = ''; $('pqaAns').value = '';
    AA.toast('Personal fact added', 'ok'); drawPersonalQA();
  };
}


/* ── card jobs ── */
const JOB_STATUS = ['new', 'quoted', 'approved', 'printing', 'done', 'cancelled'];
async function loadJobs() {
  try {
    const f = $('jobFilter').value;
    const list = await AA.api('/api/admin/jobs' + (f ? '?status=' + f : ''));
    $('jobList').innerHTML = list.map(j =>
      '<div class="li"><div class="t">' + esc(j.code) + ' · ' + esc(j.title) + '</div>' +
      '<div class="m">' + j.qty + ' cards · ' + j.sides + ' sided · ' + esc(j.clientName || 'no client') +
      (j.quote ? ' · ' + j.quote.symbol + ' ' + j.quote.total.toLocaleString() : '') +
      ' · ' + new Date(j.createdAt).toLocaleDateString() + '</div>' +
      (j.notes ? '<div class="m mt8">' + esc(j.notes) + '</div>' : '') +
      '<div class="acts">' +
      '<select data-js="' + j.id + '" style="max-width:150px">' +
      JOB_STATUS.map(st => '<option value="' + st + '"' + (j.status === st ? ' selected' : '') + '>' + st + '</option>').join('') +
      '</select>' +
      (j.phone ? '<a class="btn btn-cyan btn-sm" target="_blank" href="https://wa.me/' + j.phone.replace(/[^0-9]/g, '') + '">WhatsApp</a>' : '') +
      '<button class="btn btn-red btn-sm" data-jd="' + j.id + '">Delete</button></div></div>').join('')
      || '<p class="hint">No jobs yet.</p>';
    $('jobList').querySelectorAll('[data-js]').forEach(sel => sel.onchange = async () => {
      await AA.api('/api/admin/jobs/' + sel.dataset.js, { method: 'PUT', body: { status: sel.value } });
      AA.toast('Status updated', 'ok'); loadJobs();
    });
    $('jobList').querySelectorAll('[data-jd]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this job?')) return;
      await AA.api('/api/admin/jobs/' + b.dataset.jd, { method: 'DELETE' });
      loadJobs();
    });
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ── payments ── */

async function loadEaaoms() {
  try {
    const d = await AA.api('/api/admin/eaaoms');
    if ($('eaPinHint')) $('eaPinHint').value = d.pinHint || '••••';
    if ($('eaUrl')) $('eaUrl').value = d.url || '';
  } catch (e) {}
}
function wireEaaoms() {
  const btn = $('eaSave');
  if (!btn) return;
  btn.onclick = async () => {
    const body = { url: ($('eaUrl') && $('eaUrl').value) || '' };
    const np = $('eaPinNew') && $('eaPinNew').value.trim();
    if (np) body.pin = np;
    try {
      const r = await AA.api('/api/admin/eaaoms', { method: 'PUT', body });
      if ($('eaPinHint')) $('eaPinHint').value = r.pinHint || '••••';
      if ($('eaPinNew')) $('eaPinNew').value = '';
      if ($('eaMsg')) $('eaMsg').textContent = 'Saved. New PIN is active immediately.';
      AA.toast('e-aaoms PIN updated', 'ok');
    } catch (e) {
      AA.toast(e.message || 'Failed', 'err');
    }
  };
}

async function loadPayments() {
  loadEaaoms();
  try {
    const st = await AA.api('/api/admin/settings');
    const n = st.nepal || {}; const b = n.bank || {};
    $('npEsewa').value = n.esewa || ''; $('npKhalti').value = n.khalti || '';
    $('npBank').value = b.bank || ''; $('npBranch').value = b.branch || '';
    $('npAccName').value = b.name || ''; $('npAcc').value = b.account || '';
    const g = st.gateways || {};
    $('gwStatus').innerHTML =
      '<div class="li"><div class="t">India · Razorpay · INR</div><div class="m">' +
        (g.razorpay.configured
          ? '<span class="pill ok">live</span> key ' + esc(g.razorpay.keyId) + '<br>Buyer pays and files unlock instantly.'
          : '<span class="pill warn">not set</span> add RAZORPAY_KEY_SECRET to .env') + '</div></div>' +
      '<div class="li"><div class="t">International · PayPal · USD</div><div class="m">' +
        (g.paypal.auto
          ? '<span class="pill ok">automatic</span> API keys present'
          : '<span class="pill cy">manual</span> paypal.me/' + esc(g.paypal.handle) +
            '<br>You release each order from the Orders tab.') + '</div></div>' +
      '<div class="li"><div class="t">Nepal · NPR</div><div class="m">' +
        ((g.nepal.esewa || g.nepal.khalti || g.nepal.bank.account || g.nepal.qr)
          ? '<span class="pill ok">ready</span> details shown at checkout'
          : '<span class="pill warn">not set</span> fill the form on the left') + '</div></div>';
  } catch (e) { AA.toast(e.message, 'err'); }
}
function wirePayments() {
  $('npQr').onchange = async e => {
    if (e.target.files[0]) media.qr = await uploadMedia(e.target.files[0], $('npUpl'));
  };
  $('npSave').onclick = async () => {
    const body = {
      nepal: {
        esewa: $('npEsewa').value, khalti: $('npKhalti').value,
        bank: { bank: $('npBank').value, branch: $('npBranch').value,
                name: $('npAccName').value, account: $('npAcc').value }
      }
    };
    if (media.qr) body.nepal.qr = media.qr;
    await AA.api('/api/admin/settings', { method: 'PUT', body });
    AA.toast('Nepal payment details saved', 'ok');
    loadPayments();
  };
}

/* ── FAQ / SEO ── */
let FAQ = [];
async function loadFaq() {
  FAQ = await AA.api('/api/admin/faq');
  drawFaq();
}
function drawFaq() {
  $('faqList').innerHTML = FAQ.map((f, i) =>
    '<div class="li"><div class="field"><label>Question ' + (i + 1) + '</label>' +
    '<input data-fq="' + i + '" value="' + esc(f.q).replace(/"/g, '&quot;') + '"></div>' +
    '<div class="field" style="margin:0"><label>Answer</label>' +
    '<textarea data-fa="' + i + '" rows="3">' + esc(f.a) + '</textarea></div>' +
    '<div class="acts"><button class="btn btn-red btn-sm" data-fd="' + i + '">Remove</button></div></div>').join('')
    || '<p class="hint">No questions yet.</p>';
  $('faqList').querySelectorAll('[data-fq]').forEach(i => i.oninput = () => FAQ[+i.dataset.fq].q = i.value);
  $('faqList').querySelectorAll('[data-fa]').forEach(i => i.oninput = () => FAQ[+i.dataset.fa].a = i.value);
  $('faqList').querySelectorAll('[data-fd]').forEach(b => b.onclick = () => {
    FAQ.splice(+b.dataset.fd, 1); drawFaq();
  });
}
function wireFaq() {
  $('fqAdd').onclick = () => {
    if (!$('fqQ').value.trim() || !$('fqA').value.trim()) { AA.toast('Both a question and an answer are needed', 'err'); return; }
    FAQ.unshift({ q: $('fqQ').value, a: $('fqA').value });
    $('fqQ').value = ''; $('fqA').value = '';
    drawFaq();
  };
  $('fqSave').onclick = async () => {
    await AA.api('/api/admin/faq', { method: 'PUT', body: FAQ });
    AA.toast('FAQ saved — search engines pick this up on the next crawl', 'ok');
  };
}

/* ── editable tiers, extras and printer add/remove ── */
function wireTiers() {
  $('tierSave').onclick = async () => {
    $('tierList').querySelectorAll('[data-ti]').forEach(inp => {
      pricing.tiers[+inp.dataset.ti].mult = 1 - (parseFloat(inp.value) || 0) / 100;
    });
    $('tierList').querySelectorAll('[data-oi]').forEach(inp => {
      pricing.options[+inp.dataset.oi].price = parseFloat(inp.value) || 0;
    });
    await AA.api('/api/admin/pricing', { method: 'PUT', body: { tiers: pricing.tiers, options: pricing.options } });
    AA.toast('Tiers and extras saved', 'ok'); loadPricing();
  };
}
function wirePrinterAdd() {
  $('prtAdd').onclick = () => {
    printers.push({ id: 'printer-' + Date.now().toString(36), brand: 'New brand', model: 'Model',
      dpi: 300, duplex: true, ribbon: 'YMCKO', bleedMm: 1, offsetX: 0, offsetY: 0,
      magstripe: false, rfid: false, owned: false, notes: '' });
    loadPrintersRender();
  };
}

/* ── Classroom slides ── */
let CL_SLIDES = [];
async function loadClassroom() {
  try {
    const d = await AA.api('/api/admin/classroom/slides');
    CL_SLIDES = (d && d.slides) || [];
  } catch (e) {
    CL_SLIDES = [];
    AA.toast(e.message || 'Failed to load slides', 'err');
  }
  drawClassroom();
}
function drawClassroom() {
  const box = $('clList');
  if (!box) return;
  if (!CL_SLIDES.length) {
    box.innerHTML = '<p class="hint">No slides yet. Click “Add slide” or upload an image.</p>';
    return;
  }
  box.innerHTML = CL_SLIDES.map((s, i) => {
    const src = esc(s.src || '');
    const text = esc(s.text || '');
    const n = s.n || (i + 1);
    const hidden = !!s.hidden;
    return '<div class="li" style="display:grid;grid-template-columns:72px 56px 1fr auto;gap:12px;align-items:start' +
      (hidden ? ';opacity:.55' : '') + '">' +
      '<div style="width:72px;height:52px;border-radius:6px;overflow:hidden;background:#0c0f15;border:1px solid rgba(255,255,255,.12)">' +
      (src ? '<img src="' + src + '" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.35)">empty</div>') +
      '</div>' +
      '<div class="field" style="margin:0"><label>#</label>' +
      '<input type="number" min="1" data-cl-n="' + i + '" value="' + n + '" style="width:56px"></div>' +
      '<div>' +
      '<div class="field" style="margin:0 0 6px"><label>Image path</label>' +
      '<input data-cl-src="' + i + '" value="' + src.replace(/"/g, '&quot;') + '" placeholder="/assets/classroom/…">' +
      '</div>' +
      '<div class="field" style="margin:0"><label>Caption / typewriter text</label>' +
      '<textarea data-cl-text="' + i + '" rows="2">' + text + '</textarea></div>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;cursor:pointer">' +
      '<input type="checkbox" data-cl-hidden="' + i + '"' + (hidden ? ' checked' : '') + '> Hidden (hide from /classroom, keep the slot)' +
      '</label>' +
      '</div>' +
      '<div class="acts" style="display:flex;flex-direction:column;gap:6px">' +
      '<button class="btn btn-ghost btn-sm" data-cl-up="' + i + '" title="Move up">↑</button>' +
      '<button class="btn btn-ghost btn-sm" data-cl-dn="' + i + '" title="Move down">↓</button>' +
      '<label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0;text-align:center" title="Replace this image">' +
      'Replace<input type="file" accept="image/*" data-cl-replace="' + i + '" style="display:none">' +
      '</label>' +
      '<button class="btn btn-red btn-sm" data-cl-del="' + i + '">Del</button>' +
      '</div></div>';
  }).join('');

  box.querySelectorAll('[data-cl-n]').forEach(el => {
    el.oninput = () => { CL_SLIDES[+el.dataset.clN].n = parseInt(el.value, 10) || 1; };
  });
  box.querySelectorAll('[data-cl-src]').forEach(el => {
    el.oninput = () => { CL_SLIDES[+el.dataset.clSrc].src = el.value; };
  });
  box.querySelectorAll('[data-cl-text]').forEach(el => {
    el.oninput = () => { CL_SLIDES[+el.dataset.clText].text = el.value; };
  });
  box.querySelectorAll('[data-cl-hidden]').forEach(el => {
    el.onchange = async () => {
      const idx = +el.dataset.clHidden;
      CL_SLIDES[idx].hidden = el.checked;
      const row = el.closest('.li');
      if (row) row.style.opacity = el.checked ? '.55' : '';
      // Auto-save so hide/show is live on both slide systems without a second click
      try {
        $('clMsg').textContent = el.checked ? 'Hiding…' : 'Showing…';
        await saveClassroomSlides(true);
        const visible = CL_SLIDES.filter(s => s.src && !s.hidden).length;
        $('clMsg').textContent = (el.checked ? 'Hidden' : 'Visible') + ' · ' + visible + ' slides live on /classroom';
        AA.toast((el.checked ? 'Slide hidden' : 'Slide visible') + ' · ' + visible + ' public', 'ok');
      } catch (e) {
        $('clMsg').textContent = e.message || 'Save failed';
        AA.toast(e.message || 'Could not save hide state', 'err');
      }
    };
  });
  box.querySelectorAll('[data-cl-del]').forEach(b => {
    b.onclick = () => { CL_SLIDES.splice(+b.dataset.clDel, 1); drawClassroom(); };
  });
  box.querySelectorAll('[data-cl-replace]').forEach(el => {
    el.onchange = async function () {
      const idx = +this.dataset.clReplace;
      const f = this.files && this.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          $('clMsg').textContent = 'Replacing image…';
          const r = await AA.api('/api/admin/classroom/upload', {
            method: 'POST',
            body: { name: f.name, data: reader.result }
          });
          CL_SLIDES[idx].src = r.src;
          // Auto-save the deck so the new src is live immediately (both displays)
          await saveClassroomSlides(true);
          drawClassroom();
          $('clMsg').textContent = 'Replaced & saved · live on /classroom';
          AA.toast('Image replaced and published', 'ok');
        } catch (e) {
          $('clMsg').textContent = e.message || 'Replace failed';
          AA.toast(e.message || 'Replace failed', 'err');
        }
      };
      reader.readAsDataURL(f);
    };
  });
  box.querySelectorAll('[data-cl-up]').forEach(b => {
    b.onclick = () => {
      const i = +b.dataset.clUp;
      if (i <= 0) return;
      const t = CL_SLIDES[i - 1]; CL_SLIDES[i - 1] = CL_SLIDES[i]; CL_SLIDES[i] = t;
      drawClassroom();
    };
  });
  box.querySelectorAll('[data-cl-dn]').forEach(b => {
    b.onclick = () => {
      const i = +b.dataset.clDn;
      if (i >= CL_SLIDES.length - 1) return;
      const t = CL_SLIDES[i + 1]; CL_SLIDES[i + 1] = CL_SLIDES[i]; CL_SLIDES[i] = t;
      drawClassroom();
    };
  });
}
async function saveClassroomSlides(silent) {
  const body = CL_SLIDES.map((s, i) => ({
    n: Number(s.n) > 0 ? Number(s.n) : (i + 1),
    src: String(s.src || '').trim(),
    text: String(s.text || '').trim(),
    hidden: !!s.hidden
  }));
  const d = await AA.api('/api/admin/classroom/slides', { method: 'PUT', body: body });
  CL_SLIDES = (d && d.slides) || body;
  if (!silent) {
    drawClassroom();
    const visible = CL_SLIDES.filter(s => s.src && !s.hidden).length;
    $('clMsg').textContent = 'Saved · ' + CL_SLIDES.length + ' slots · ' + visible + ' visible on /classroom';
    AA.toast('Classroom slides saved (' + visible + ' visible)', 'ok');
  }
  return d;
}
function wireClassroom() {
  if (!$('clAdd')) return;
  $('clAdd').onclick = () => {
    const nextN = CL_SLIDES.length ? Math.max(...CL_SLIDES.map(s => s.n || 0)) + 1 : 1;
    CL_SLIDES.push({ n: nextN, src: '', text: '', hidden: false });
    drawClassroom();
  };
  // Unique id — was previously duplicated with Clients "clSave", which broke both panels
  const saveBtn = $('clSlideSave') || $('clSave');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        $('clMsg').textContent = 'Saving…';
        await saveClassroomSlides(false);
      } catch (e) {
        $('clMsg').textContent = e.message || 'Save failed';
        AA.toast(e.message || 'Save failed', 'err');
      }
    };
  }
  $('clUpload').onchange = async function () {
    const f = this.files && this.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        $('clMsg').textContent = 'Uploading…';
        const r = await AA.api('/api/admin/classroom/upload', {
          method: 'POST',
          body: { name: f.name, data: reader.result }
        });
        const nextN = CL_SLIDES.length ? Math.max(...CL_SLIDES.map(s => s.n || 0)) + 1 : 1;
        CL_SLIDES.push({ n: nextN, src: r.src, text: '', hidden: false });
        // Auto-save so the new slide is live without a second click
        await saveClassroomSlides(true);
        drawClassroom();
        $('clMsg').textContent = 'Uploaded & saved · ' + r.file;
        AA.toast('Image uploaded and published', 'ok');
      } catch (e) {
        $('clMsg').textContent = e.message || 'Upload failed';
        AA.toast(e.message || 'Upload failed', 'err');
      }
      this.value = '';
    };
    reader.readAsDataURL(f);
  };
}

/* ── boot ── */
document.addEventListener('DOMContentLoaded', () => {
  buildTabs();
  wirePosts(); wireClassroomPosts(); wireProducts(); wireClients(); wirePricing(); wirePrinters(); wireBrain();
  wirePayments(); wireEaaoms(); wireFaq(); wireTiers(); wirePrinterAdd(); wireClassroom();
  $('jobFilter').onchange = loadJobs;
  $('btnLogout').onclick = () => { sessionStorage.removeItem('aaoms_token'); location.reload(); };
  $('btnLogin').onclick = login;
  $('pin').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  const t = sessionStorage.getItem('aaoms_token');
  if (t) { AA.token = t; enter(); }
});
})();
