/* ═══════════ Say Hi — write & send ═══════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id);

const TOPICS = ['3D / animation project','AI video','Digital advertisement','Website or app','ID card printing (aaomsPrint)',
  'Embroidery digitizing','Digital Gurukul training','Bulk / corporate order','Something else'];

const STARTERS = [
  ['Card printing brief', 'We need ID cards for our staff. Roughly {qty} cards, {sides}, and we would like a design made from our logo. Can you share a quotation and timeline?'],
  ['Digitizing request', 'I have artwork I need digitized for embroidery. Final size is about __ mm, stitched on __ fabric. Which formats can you deliver, and what is the turnaround?'],
  ['Project brief', 'We are working on __ and need help with __. The deadline is __ and the budget is around __. Here is what we already have: __'],
  ['Training', 'I want to learn __ . My current level is __ and I can give about __ hours a week. Where should I start?']
];

let topic = 'General';

function buildTopics() {
  const box = $('topics');
  const param = new URLSearchParams(location.search).get('topic');
  const list = param && !TOPICS.includes(param) ? [param].concat(TOPICS) : TOPICS;
  list.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t;
    b.onclick = () => { topic = t; box.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); };
    box.appendChild(b);
    if ((param && t === param) || (!param && i === 0)) { b.click(); }
  });
}

function buildStarters() {
  const box = $('starters');
  STARTERS.forEach(([label, text]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = '+ ' + label;
    b.onclick = () => {
      const ta = $('cMsg');
      ta.value = (ta.value ? ta.value.replace(/\s*$/, '') + '\n\n' : '') +
        text.replace('{qty}', '100').replace('{sides}', 'double sided');
      ta.focus(); count();
    };
    box.appendChild(b);
  });
}

function count() {
  const v = $('cMsg').value;
  $('charCount').textContent = v.length + ' characters';
  const words = v.trim() ? v.trim().split(/\s+/).length : 0;
  $('readTime').textContent = words ? words + ' words' : '';
}

function tick() {
  const now = new Date();
  const npt = new Date(now.getTime() + (now.getTimezoneOffset() + 345) * 60000);
  $('clock').textContent = npt.toTimeString().slice(0, 8) + ' NPT';
  const h = npt.getHours(), d = npt.getDay();
  const open = d !== 6 && h >= 10 && h < 18;
  $('openState').textContent = open ? 'OPEN' : 'AFTER HOURS';
}

function messageText() {
  return 'Topic: ' + topic +
    '\nName: ' + ($('cName').value || '—') +
    '\nEmail: ' + ($('cEmail').value || '—') +
    ($('cPhone').value ? '\nPhone: ' + $('cPhone').value : '') +
    ($('cBudget').value ? '\nBudget: ' + $('cBudget').value : '') +
    '\n\n' + $('cMsg').value;
}

async function send() {
  const msg = $('cMsg').value.trim();
  if (msg.length < 5) { AA.toast('Write a line or two first', 'err'); $('cMsg').focus(); return; }
  if (!$('cName').value.trim()) { AA.toast('Add your name so I know who is writing', 'err'); $('cName').focus(); return; }
  const btn = $('btnSend'); btn.disabled = true;
  $('sendState').textContent = 'transmitting…';
  try {
    const r = await AA.api('/api/contact', {
      method: 'POST',
      body: {
        name: $('cName').value, email: $('cEmail').value, phone: $('cPhone').value,
        topic: topic, budget: $('cBudget').value, message: msg
      }
    });
    const rec = $('receipt');
    rec.classList.remove('hide');
    rec.innerHTML = '<b>Message received.</b><span class="code">' + r.code + '</span>' +
      'Quote this code in any follow-up and I will find the thread instantly.<br>' +
      'Reply normally arrives the same working day.<br><br>' +
      'In a hurry? <a class="gold" href="https://wa.me/9779803840868?text=' +
      encodeURIComponent('Hi Pramod — I just sent message ' + r.code + ' from your site.') +
      '" target="_blank" rel="noopener">Nudge me on WhatsApp →</a>';
    $('sendState').textContent = 'sent · ' + r.code;
    $('cMsg').value = ''; count();
    AA.toast('Message sent — ' + r.code, 'ok');
    rec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    $('sendState').textContent = 'failed';
    AA.toast(e.message + ' — try WhatsApp instead', 'err');
  }
  btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  buildTopics(); buildStarters(); count(); tick();
  setInterval(tick, 1000);
  $('cMsg').addEventListener('input', count);
  $('btnSend').onclick = send;
  $('btnWa').onclick = () => window.open('https://wa.me/9779803840868?text=' + encodeURIComponent(messageText()), '_blank');
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send();
  });
});
})();
