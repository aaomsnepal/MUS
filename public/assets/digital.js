/* ═══════════ aaomsDigital — services, store, checkout ═══════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id);

/* ─────────── services ─────────── */
const SERVICES = [
  { ic: '⟨/⟩', t: 'Software Development', d: 'Code built for Nepal, scaled for the world. Systems that stay online.', tag: '// core · nepal' },
  { ic: '◈', t: 'Website & App Design', d: 'Interfaces for the next generation of businesses and users.', tag: '// visual · future' },
  { ic: '▶', t: 'AI Video Generation', d: 'Scripted AI video, avatars, voice-over and motion — ads and explainers produced in days, not weeks.', tag: '// ai · motion', hot: true },
  { ic: '◎', t: 'Digital Advertisement', d: 'Meta, Google and TikTok campaigns — creative, targeting, budget and reporting handled end to end.', tag: '// reach · convert', hot: true },
  { ic: '✦', t: '3D Animation & VFX', d: 'A decade of studio work — modelling, lookdev, lighting, simulation and final render.', tag: '// 3d · craft', hot: true },
  { ic: '◐', t: 'Product Visualisation', d: 'Photoreal CGI product shots and 360 spins, no photoshoot required.', tag: '// cgi · product' },
  { ic: '≈', t: 'Motion Graphics', d: 'Explainers, logo stings, lower thirds and social cutdowns.', tag: '// motion · brand' },
  { ic: '❖', t: 'Brand Identity & Graphics', d: 'Logo systems, packaging, print and the full visual language around them.', tag: '// identity' },
  { ic: '⌘', t: 'Embroidery Digitizing', d: 'Artwork or photo to stitch-ready DST, PES, JEF and EXP — tested on the machine.', tag: '// stitch · file', hot: true },
  { ic: '▤', t: 'aaomsPrint ID Cards', d: 'Design, batch and print CR-80 PVC cards for hospitals, schools and offices.', tag: '// print · card', href: '/print' },
  { ic: '≋', t: 'Data Analytics', d: 'Turn raw business data into clear decisions and dashboards.', tag: '// signal · insight' },
  { ic: '☁', t: 'Cloud Infrastructure', d: 'Distributed systems that stay stable under load. Always online.', tag: '// lattice · cloud' },
  { ic: '⬡', t: 'E-commerce Platforms', d: 'Storefronts ready for Nepal and beyond. Secure, instant, scalable.', tag: '// commerce · grow' },
  { ic: '⌖', t: 'SEO & AI Search', d: 'Rank on Google and Bing — and get quoted correctly by AI assistants.', tag: '// found · cited', hot: true },
  { ic: '◍', t: 'Social Content Engine', d: 'A month of posts, reels and captions produced in one batch.', tag: '// daily · feed' },
  { ic: '◭', t: 'Photo & Video Editing', d: 'Retouching, colour grading, cleanup and delivery in every format.', tag: '// post · polish' }
];

function buildServices() {
  const g = $('svcGrid'); if (!g) return;
  SERVICES.forEach(s => {
    const d = document.createElement('div');
    d.className = 'svc reveal' + (s.hot ? ' hot' : '');
    d.innerHTML = '<div class="ic"></div><h3></h3><p></p><div class="tag"></div>' +
      (s.href ? '<a class="go" href="' + s.href + '">→ Open the studio</a>'
              : '<button class="go" type="button">→ Select &amp; send request</button>');
    d.querySelector('.ic').textContent = s.ic;
    d.querySelector('h3').textContent = s.t;
    d.querySelector('p').textContent = s.d;
    d.querySelector('.tag').textContent = s.tag;
    const btn = d.querySelector('button.go');
    if (btn) btn.onclick = () => { location.href = '/sayhi?topic=' + encodeURIComponent(s.t); };
    g.appendChild(d);
  });
  AA.initReveal();
}

/* ─────────── store ─────────── */
const ST = { products: [], cart: [], cur: 'USD', cfg: null, pendingOrder: null, pendingOrderKey: null, prefetchTimer: null };
const SYM = { NPR: 'रु', INR: '₹', USD: '$' };
const priceOf = (p, c) => c === 'INR' ? p.priceINR : c === 'USD' ? p.priceUSD : p.priceNPR;

/* Razorpay's own integration docs are explicit about this: the checkout
   popup must open synchronously inside the click that triggered it, or
   browsers with strict popup/tracking protection (iOS Safari above all)
   silently swallow it — "nothing happens" is exactly that failure, not a
   crash, so it's easy to miss in testing on desktop Chrome where the same
   code usually still works. The old flow awaited the order-creation AJAX
   call *inside* the click handler, which loses the click's "user gesture"
   status by the time rzp.open() finally runs. Fix: create the order ahead
   of time (as soon as the cart/currency is in a payable state) so the
   click handler can call rzp.open() with zero awaits in between. */
function cartOrderKey() {
  // Buyer email/name are only used for the checkout prefill (read fresh at
  // open() time below), not sent to Razorpay's order object — so they must
  // NOT be part of this key, or every keystroke while typing an email would
  // invalidate the just-fetched order right before the user hits Pay.
  return ST.cur + '|' + ST.cart.slice().sort().join(',');
}
function prefetchRazorpayOrder() {
  if (ST.cur !== 'INR' || !ST.cart.length || !(ST.cfg && ST.cfg.razorpay && ST.cfg.razorpay.enabled)) return;
  const key = cartOrderKey();
  if (ST.pendingOrderKey === key) return; // already have a matching order in flight/ready
  clearTimeout(ST.prefetchTimer);
  ST.prefetchTimer = setTimeout(async () => {
    const myKey = cartOrderKey();
    try {
      const r = await AA.api('/api/store/razorpay/order', { method: 'POST', body: { items: ST.cart, buyer: buyer() } });
      if (cartOrderKey() === myKey) { ST.pendingOrder = r; ST.pendingOrderKey = myKey; }
    } catch (e) { /* silent — payRazorpay() falls back to fetching on click if this never lands */ }
  }, 400); // small debounce so rapid cart edits don't spam order-creation calls
}


function detectCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = navigator.language || '';
    if (/Kathmandu/i.test(tz)) return 'NPR';
    if (/Calcutta|Kolkata/i.test(tz) || /-IN$/i.test(lang)) return 'INR';
  } catch (e) {}
  return 'USD';
}
function setCurrency(c) {
  ST.cur = c;
  document.querySelectorAll('[data-cur]').forEach(b => b.classList.toggle('active', b.dataset.cur === c));
  $('payNote').textContent = c === 'INR' ? 'Indian customers pay in ₹ with Razorpay — UPI, cards, net banking'
    : c === 'USD' ? 'International customers pay in $ with PayPal — @kkpramod'
    : 'Nepal customers pay in रु — eSewa, Khalti, bank transfer or QR';
  buildProducts(); renderCart();
}

async function loadProducts() {
  try { ST.products = await AA.api('/api/store/products'); }
  catch (e) { ST.products = []; }
  buildProducts();
}
function buildProducts() {
  const g = $('prodGrid'); if (!g) return;
  g.innerHTML = '';
  if (!ST.products.length) { g.innerHTML = '<p class="dim">No products listed yet.</p>'; return; }
  ST.products.forEach(p => {
    const d = document.createElement('div');
    d.className = 'prod reveal';
    d.innerHTML =
      '<div class="thumb"><img src="' + (p.thumb || '/assets/logo-infinity.png') + '" alt="" onerror="this.src=\'/assets/logo-infinity.png\'">' +
      (p.featured ? '<span class="pill hot badge">Featured</span>' : '') + '</div>' +
      '<div class="body">' +
        '<h3></h3><p class="blurb"></p>' +
        '<div class="specs">' +
          '<span class="pill cy">' + (p.stitches ? p.stitches.toLocaleString() + ' st' : p.category) + '</span>' +
          (p.sizeMm ? '<span class="pill">' + p.sizeMm + ' mm</span>' : '') +
          (p.colours ? '<span class="pill">' + p.colours + ' colours</span>' : '') +
        '</div>' +
        '<div class="fmt">' + (p.formats || []).join(' · ') + '</div>' +
        '<details><summary>Full description</summary><p></p></details>' +
        '<div class="buyrow"><span class="price">' + SYM[ST.cur] + ' ' + priceOf(p, ST.cur) + '</span>' +
        '<button class="btn btn-gold btn-sm">Add to cart</button></div>' +
      '</div>';
    d.querySelector('h3').textContent = p.title;
    d.querySelector('.blurb').textContent = p.blurb;
    d.querySelector('details p').textContent = p.description || p.blurb;
    d.querySelector('.buyrow .btn').onclick = () => addToCart(p.id);
    g.appendChild(d);
  });
  AA.initReveal();
}

function addToCart(id) {
  if (ST.cart.includes(id)) { AA.toast('Already in the cart'); return; }
  ST.cart.push(id);
  renderCart();
  AA.toast('Added to cart', 'ok');
  $('cartCount').textContent = ST.cart.length;
}
function renderCart() {
  $('cartCount').textContent = ST.cart.length;
  const box = $('cartItems'); if (!box) return;
  box.innerHTML = '';
  let total = 0;
  ST.cart.forEach(id => {
    const p = ST.products.find(x => x.id === id); if (!p) return;
    const price = priceOf(p, ST.cur); total += price;
    const r = document.createElement('div');
    r.className = 'cart-line';
    r.innerHTML = '<span class="t"></span><span class="p">' + SYM[ST.cur] + ' ' + price + '</span><button class="x">✕</button>';
    r.querySelector('.t').textContent = p.title;
    r.querySelector('.x').onclick = () => { ST.cart = ST.cart.filter(x => x !== id); renderCart(); };
    box.appendChild(r);
  });
  if (!ST.cart.length) box.innerHTML = '<p class="hint">Cart is empty — add a design to continue.</p>';
  $('cartTotal').textContent = 'Total: ' + SYM[ST.cur] + ' ' + total.toLocaleString() +
    (ST.cur === 'INR' ? '   · pay with Razorpay' : ST.cur === 'USD' ? '   · pay with PayPal' : '   · eSewa / Khalti / bank');
  const hint = $('payHint');
  if (ST.cfg) {
    if (ST.cur === 'INR' && !ST.cfg.razorpay.enabled) hint.textContent = 'Razorpay keys are not set on the server yet.';
    else if (ST.cur === 'USD' && !ST.cfg.paypal.enabled) hint.textContent = 'PayPal keys are not set on the server yet.';
    else if (ST.cur === 'NPR') hint.textContent = 'Pay by eSewa, Khalti, bank or QR — files are released once the payment shows.';
    else hint.textContent = 'Secure checkout. The download link appears here the moment payment clears.';
  }
  prefetchRazorpayOrder();
  $('payBtn').textContent = 'Pay ' + SYM[ST.cur] + ' ' + total.toLocaleString() + ' & download';
}

/* ─────────── checkout ─────────── */
function buyer() {
  return { name: $('buyName').value, email: $('buyEmail').value, country: $('buyCountry').value };
}
function showDownloads(r) {
  const box = $('dlBox');
  box.classList.remove('hide');
  box.innerHTML = '<h4>Payment confirmed · ' + r.code + '</h4>' +
    '<p class="hint">Your link is live for seven days. A copy has been recorded against your order code.</p>' +
    '<a href="/api/store/download/' + r.token + '" target="_blank">Open my download page →</a>';
  ST.cart = []; renderCart();
}

async function payRazorpay() {
  const key = cartOrderKey();
  let r = (ST.pendingOrderKey === key) ? ST.pendingOrder : null;
  if (!r) {
    // Fallback path — only hit if the user clicked Pay faster than the
    // background prefetch above could complete (e.g. very first click on a
    // slow connection). Still works on most browsers; only the strictest
    // (iOS Safari with tracking prevention) may block it, same as before.
    r = await AA.api('/api/store/razorpay/order', { method: 'POST', body: { items: ST.cart, buyer: buyer() } });
  }
  ST.pendingOrder = null; ST.pendingOrderKey = null; // an order can only be used once
  const rzp = new Razorpay({
    key: r.keyId, amount: r.amount, currency: r.currency,
    name: 'aaoms Digital Products',
    description: 'Embroidery digitizing files',
    image: '/assets/logo-infinity.png',
    order_id: r.orderId,
    prefill: { name: $('buyName').value, email: $('buyEmail').value },
    theme: { color: '#d4a84b' },
    modal: {
      // If the order we used was actually stale/already-paid server-side,
      // Razorpay itself will report a clear error here instead of the
      // checkout just silently failing to open.
      ondismiss: () => { prefetchRazorpayOrder(); }
    },
    handler: async resp => {
      try {
        const v = await AA.api('/api/store/razorpay/verify', {
          method: 'POST',
          body: Object.assign({ localId: r.localId }, resp)
        });
        showDownloads(v);
        AA.toast('Payment verified — files unlocked', 'ok');
      } catch (e) { AA.toast(e.message, 'err'); }
    }
  });
  rzp.open();
}

async function payPaypal() {
  const cfg = ST.cfg && ST.cfg.paypal ? ST.cfg.paypal : {};

  // Full API checkout, if the PayPal keys are set on the server
  if (cfg.enabled) {
    const r = await AA.api('/api/store/paypal/order', { method: 'POST', body: { items: ST.cart, buyer: buyer() } });
    const base = cfg.env === 'sandbox' ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
    const win = window.open(base + '/checkoutnow?token=' + r.orderId, 'paypal', 'width=500,height=700');
    $('payHint').textContent = 'Finish the payment in the PayPal window, then come back — this page checks automatically.';
    const started = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1000) { clearInterval(poll); return; }
      if (win && !win.closed) return;
      clearInterval(poll);
      try {
        const v = await AA.api('/api/store/paypal/capture', { method: 'POST', body: { orderId: r.orderId, localId: r.localId } });
        showDownloads(v);
        AA.toast('PayPal payment captured — files unlocked', 'ok');
      } catch (e) { $('payHint').textContent = 'Payment not completed: ' + e.message; }
    }, 1500);
    return;
  }

  // PayPal.me route — pay @kkpramod directly, then confirm
  const r = await AA.api('/api/store/paypalme/order', { method: 'POST', body: { items: ST.cart, buyer: buyer() } });
  window.open(r.payUrl, '_blank', 'noopener');
  const box = $('dlBox');
  box.classList.remove('hide');
  box.innerHTML =
    '<h4>Order ' + r.code + ' created</h4>' +
    '<p class="hint">A PayPal window opened for <b>' + r.handle + '</b> — $ ' + r.amount.toFixed(2) + ' USD. ' +
    'If it did not open, <a class="gold" href="' + r.payUrl + '" target="_blank" rel="noopener">tap here to pay</a>.</p>' +
    '<p class="hint">Once PayPal confirms the payment, press the button below. Your files are released to the email you gave, ' +
    'usually within a few hours — normally much faster during Nepal working hours.</p>' +
    '<button class="btn btn-gold btn-sm" id="claimBtn" style="margin-top:8px">I have paid — release my files</button>' +
    '<p class="hint mt8" id="claimMsg"></p>';
  $('claimBtn').onclick = async () => {
    try {
      await AA.api('/api/store/claim', {
        method: 'POST',
        body: { localId: r.localId, note: 'paid via paypal.me/' + (cfg.me || 'kkpramod') }
      });
      $('claimMsg').innerHTML = 'Thank you — order <b>' + r.code + '</b> is flagged for release. ' +
        'Quote that code if you message us. <a class="gold" target="_blank" rel="noopener" href="https://wa.me/9779803840868?text=' +
        encodeURIComponent('Hi, I paid for order ' + r.code + ' via PayPal (' + r.handle + ').') + '">Nudge on WhatsApp →</a>';
      $('claimBtn').disabled = true;
      ST.cart = []; renderCart();
      AA.toast('Order ' + r.code + ' flagged for release', 'ok');
    } catch (e) { AA.toast(e.message, 'err'); }
  };
}

async function payNepal() {
  const r = await AA.api('/api/store/npr/order', { method: 'POST', body: { items: ST.cart, buyer: buyer() } });
  const np = (ST.cfg && ST.cfg.nepal) ? ST.cfg.nepal : {};
  const p = r.pay || {};
  let methods = '';
  if (p.esewa)  methods += '<div class="pay-line"><b>eSewa</b><span>' + p.esewa + '</span></div>';
  if (p.khalti) methods += '<div class="pay-line"><b>Khalti</b><span>' + p.khalti + '</span></div>';
  if (p.bank && p.bank.account) {
    methods += '<div class="pay-line"><b>Bank</b><span>' + (p.bank.bank || '') +
      (p.bank.branch ? ' · ' + p.bank.branch : '') + '<br>' + (p.bank.name || '') +
      '<br>A/C ' + p.bank.account + '</span></div>';
  }
  if (p.qr) methods += '<img src="' + p.qr + '" alt="Payment QR" style="width:180px;border-radius:10px;margin:10px 0">';
  if (!methods) {
    methods = '<p class="hint">Payment details are sent over WhatsApp — tap the button below and we will confirm the amount and account.</p>';
  }

  const box = $('dlBox');
  box.classList.remove('hide');
  box.innerHTML =
    '<h4>Order ' + r.code + ' · रु ' + r.amount.toLocaleString() + '</h4>' +
    '<p class="hint">Send the amount using any of these, then press the button below.</p>' +
    methods +
    '<p class="hint">Put the order code <b>' + r.code + '</b> in the payment remarks so it is easy to match.</p>' +
    '<a class="btn btn-cyan btn-sm" href="' + r.whatsapp + '" target="_blank" rel="noopener" style="margin:8px 8px 0 0">Send proof on WhatsApp</a>' +
    '<button class="btn btn-gold btn-sm" id="claimBtn" style="margin-top:8px">I have paid — release my files</button>' +
    '<p class="hint mt8" id="claimMsg"></p>';

  $('claimBtn').onclick = async () => {
    try {
      await AA.api('/api/store/claim', { method: 'POST', body: { localId: r.localId, note: 'NPR payment declared' } });
      $('claimMsg').innerHTML = 'Thank you — order <b>' + r.code + '</b> is flagged for release. ' +
        'Your files are sent to the email you gave, usually within a few hours.';
      $('claimBtn').disabled = true;
      ST.cart = []; renderCart();
      AA.toast('Order ' + r.code + ' flagged for release', 'ok');
    } catch (e) { AA.toast(e.message, 'err'); }
  };
}

async function pay() {
  if (!ST.cart.length) { AA.toast('Cart is empty', 'err'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('buyEmail').value)) {
    AA.toast('A valid email is needed for the download link', 'err'); return;
  }
  const btn = $('payBtn'); btn.disabled = true;
  try {
    if (ST.cur === 'INR') await payRazorpay();
    else if (ST.cur === 'USD') await payPaypal();
    else await payNepal();
  } catch (e) { AA.toast(e.message, 'err'); }
  btn.disabled = false;
}

/* ─────────── FAQ ─────────── */
async function loadFaq() {
  const box = $('faqList'); if (!box) return;
  let list = [];
  try { list = await AA.api('/api/store/faq'); } catch (e) { return; }
  box.innerHTML = '';
  list.forEach(f => {
    const d = document.createElement('div');
    d.className = 'faq-item reveal';
    d.innerHTML = '<button class="faq-q" type="button"><span></span><i>+</i></button><div class="faq-a"></div>';
    d.querySelector('span').textContent = f.q;
    d.querySelector('.faq-a').textContent = f.a;
    d.querySelector('.faq-q').onclick = () => d.classList.toggle('open');
    box.appendChild(d);
  });
  // structured data for search engines and AI answer engines
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: list.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });
  document.head.appendChild(ld);
  AA.initReveal();
}

/* ─────────── boot ─────────── */
document.addEventListener('DOMContentLoaded', async () => {
  buildServices();
  AA.initTicker('.aa-ticker .track', [
    'aaomsDigital · <b>16 services</b> live',
    'embroidery digitizing · <b>DST · PES · JEF · EXP</b>',
    'instant download · <b>worldwide</b>',
    'Razorpay <b>India</b> · PayPal <b>international</b>',
    'aaomsPrint · <b>Evolis Primacy</b> · CR-80',
    'AI video · digital advertisement · <b>new</b>',
    'Nepal · Kathmandu · <b>UTC+5:45</b>'
  ]);
  try { ST.cfg = await AA.api('/api/store/config'); } catch (e) { ST.cfg = { razorpay: {}, paypal: {} }; }
  await loadProducts();
  setCurrency(detectCurrency());
  loadFaq();

  document.querySelectorAll('[data-cur]').forEach(b => b.onclick = () => setCurrency(b.dataset.cur));
  $('cartBtn').onclick = () => $('cartDrawer').classList.add('open');
  $('cartClose').onclick = () => $('cartDrawer').classList.remove('open');
  $('cartDrawer').onclick = e => { if (e.target.id === 'cartDrawer') $('cartDrawer').classList.remove('open'); };
  $('payBtn').onclick = pay;

  const slug = location.pathname.split('/')[2];
  if (slug) {
    const p = ST.products.find(x => x.slug === slug);
    if (p) { document.getElementById('store').scrollIntoView({ behavior: 'smooth' }); }
  }
});
})();
