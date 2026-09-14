/* ═══════════ Job board ═══════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const COLS = [['new','New'],['quoted','Quoted'],['approved','Approved'],['printing','Printing'],['done','Done'],['cancelled','Cancelled']];
let jobs = [];

async function login() {
  try {
    const r = await AA.api('/api/admin/login', { method: 'POST', body: { pin: $('pin').value } });
    AA.token = r.token; sessionStorage.setItem('aaoms_token', r.token);
    $('gate').classList.add('hide'); $('board').classList.remove('hide');
    load();
  } catch (e) { $('gateMsg').textContent = e.message; }
}

async function load() {
  try {
    jobs = await AA.api('/api/admin/jobs');
    const s = await AA.api('/api/admin/stats');
    $('statLine').textContent = s.jobs + ' jobs · ' + s.queue + ' in queue · ' + s.cardsPrinted + ' cards printed';
    draw();
  } catch (e) { AA.toast(e.message, 'err'); }
}

function draw() {
  const k = $('kanban'); k.innerHTML = '';
  COLS.forEach(([key, label]) => {
    const list = jobs.filter(j => j.status === key);
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = '<h3>' + label + ' <span>' + list.length + '</span></h3>';
    list.forEach(j => {
      const c = document.createElement('div');
      c.className = 'jcard';
      c.innerHTML = '<div class="code">' + j.code + '</div><div class="t"></div>' +
        '<div class="m">' + j.qty + ' cards · ' + j.sides + '</div>' +
        (j.clientName ? '<div class="m">' + esc(j.clientName) + '</div>' : '') +
        (j.preview ? '<img src="' + j.preview + '" alt="">' : '');
      c.querySelector('.t').textContent = j.title;
      c.onclick = () => open(j);
      col.appendChild(c);
    });
    k.appendChild(col);
  });
}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

function open(j) {
  const m = $('modalIn');
  m.innerHTML =
    '<h2>' + esc(j.title) + '</h2><p class="mono muted">' + j.code + '</p>' +
    (j.preview ? '<img src="' + j.preview + '" style="width:220px;border-radius:8px;margin:12px 0;border:1px solid var(--edge)">' : '') +
    '<div class="kv">' +
      '<b>Client</b><span>' + esc(j.clientName || '—') + '</span>' +
      '<b>Contact</b><span>' + esc(j.contact || '—') + ' · ' + esc(j.phone || '—') + '</span>' +
      '<b>Email</b><span>' + esc(j.email || '—') + '</span>' +
      '<b>Quantity</b><span>' + j.qty + ' cards, ' + j.sides + ' sided</span>' +
      '<b>Printer</b><span>' + esc(j.printerId) + '</span>' +
      '<b>Extras</b><span>' + ((j.options || []).join(', ') || 'none') + '</span>' +
      '<b>Total</b><span>' + (j.quote ? (j.quote.symbol + ' ' + j.quote.total.toLocaleString()) : '—') + '</span>' +
      '<b>Batch rows</b><span>' + ((j.rows || []).length || 0) + '</span>' +
      '<b>Notes</b><span>' + esc(j.notes || '—') + '</span>' +
    '</div>' +
    '<div class="field"><label>Status</label><select id="mStatus">' +
      COLS.map(c => '<option value="' + c[0] + '"' + (j.status === c[0] ? ' selected' : '') + '>' + c[1] + '</option>').join('') +
    '</select></div>' +
    '<div class="hist">' + (j.history || []).map(h => h.at.replace('T', ' ').slice(0, 16) + '  ' + h.status + '  (' + h.by + ')').join('\n') + '</div>' +
    '<div class="flexrow mt16">' +
      '<button class="btn btn-gold btn-sm" id="mSave">Save status</button>' +
      (j.phone ? '<a class="btn btn-cyan btn-sm" target="_blank" href="https://wa.me/' + j.phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent('Regarding your card job ' + j.code) + '">WhatsApp client</a>' : '') +
      '<button class="btn btn-red btn-sm" id="mDel">Delete</button>' +
      '<span class="spacer"></span><button class="btn btn-ghost btn-sm" id="mClose">Close</button>' +
    '</div>';
  $('modal').classList.add('open');
  $('mClose').onclick = () => $('modal').classList.remove('open');
  $('mSave').onclick = async () => {
    try { await AA.api('/api/admin/jobs/' + j.id, { method: 'PUT', body: { status: $('mStatus').value } });
      AA.toast('Status updated', 'ok'); $('modal').classList.remove('open'); load();
    } catch (e) { AA.toast(e.message, 'err'); }
  };
  $('mDel').onclick = async () => {
    if (!confirm('Delete job ' + j.code + '? This cannot be undone.')) return;
    try { await AA.api('/api/admin/jobs/' + j.id, { method: 'DELETE' });
      $('modal').classList.remove('open'); load();
    } catch (e) { AA.toast(e.message, 'err'); }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const t = sessionStorage.getItem('aaoms_token');
  if (t) { AA.token = t; $('gate').classList.add('hide'); $('board').classList.remove('hide'); load(); }
  $('btnLogin').onclick = login;
  $('pin').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('btnRefresh').onclick = load;
  $('modal').onclick = e => { if (e.target.id === 'modal') $('modal').classList.remove('open'); };
});
})();
