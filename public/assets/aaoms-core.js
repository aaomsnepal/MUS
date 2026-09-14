/* ═══════════════════════════════════════════════════
   aaomsCore JS — shared behaviour for every page
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';
  const AA = window.AA = window.AA || {};

  /* ── toast ─────────────────────────────────── */
  AA.toast = function(msg, kind){
    let box = document.getElementById('aaToast');
    if(!box){ box = document.createElement('div'); box.id='aaToast'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'aa-toast ' + (kind||'');
    t.textContent = msg;
    box.appendChild(t);
    box.classList.add('show');
    setTimeout(()=>{ t.remove(); if(!box.children.length) box.classList.remove('show'); }, 3200);
  };

  /* ── fetch helper ──────────────────────────── */
  AA.api = async function(url, opts){
    opts = opts || {};
    opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
    if(AA.token) opts.headers['x-admin-token'] = AA.token;
    if(opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    const r = await fetch(url, opts);
    let d = null;
    try { d = await r.json(); } catch(e){ d = {}; }
    if(!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    return d;
  };

  /* ── mobile nav ────────────────────────────── */
  AA.initNav = function(){
    const b = document.querySelector('.aa-burger');
    const l = document.querySelector('.aa-links');
    if(b && l) b.addEventListener('click', ()=> l.classList.toggle('open'));

    // dropdown submenus — hover on desktop (CSS), tap on touch/narrow screens
    document.querySelectorAll('.navsub').forEach(sub=>{
      const top = sub.querySelector('a.sub-top');
      if(!top) return;
      top.addEventListener('click', e=>{
        const narrow = window.innerWidth <= 820 || !window.matchMedia('(hover:hover)').matches;
        if(narrow){ e.preventDefault(); sub.classList.toggle('open'); }
      });
    });
    document.addEventListener('click', e=>{
      document.querySelectorAll('.navsub.open').forEach(sub=>{
        if(!sub.contains(e.target)) sub.classList.remove('open');
      });
    });
    const path = location.pathname.replace(/\/$/,'') || '/';
    document.querySelectorAll('.aa-links a').forEach(a=>{
      const href = (a.getAttribute('href')||'').split('#')[0].replace(/\/$/,'');
      if(href && href === path) a.classList.add('active');
    });
  };

  /* ── scroll reveal ─────────────────────────── */
  AA.initReveal = function(){
    const els = document.querySelectorAll('.reveal');
    if(!els.length) return;
    if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries=>{
      entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
    }, {threshold:.08, rootMargin:'0px 0px -40px 0px'});
    els.forEach(e=>io.observe(e));
  };

  /* ── cursor glow ───────────────────────────── */
  AA.initGlow = function(){
    if(!window.matchMedia('(hover:hover)').matches || window.innerWidth < 900) return;
    const g = document.createElement('div'); g.id='aaGlow'; document.body.appendChild(g);
    let tx=0,ty=0,cx=0,cy=0;
    window.addEventListener('pointermove', e=>{ tx=e.clientX; ty=e.clientY; }, {passive:true});
    (function loop(){ cx += (tx-cx)*0.09; cy += (ty-cy)*0.09;
      g.style.left = cx+'px'; g.style.top = cy+'px'; requestAnimationFrame(loop); })();
  };

  /* ── ambient hex field (same language as home) ── */
  AA.initField = function(canvasId){
    const c = document.getElementById(canvasId || 'aaCanvas');
    if(!c) return;
    const ctx = c.getContext('2d');
    let w,h,dpr,hexes=[],t=0;
    const R = 30;
    function resize(){
      dpr = Math.min(window.devicePixelRatio||1, 2);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w*dpr; c.height = h*dpr;
      c.style.width = w+'px'; c.style.height = h+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      hexes = [];
      const dx = R*1.75, dy = R*1.55; let row=0;
      for(let y=-dy; y<h+dy; y+=dy){
        const off = (row%2)*(dx*.5);
        for(let x=-dx; x<w+dx; x+=dx) hexes.push({x:x+off,y,p:Math.random()*Math.PI*2});
        row++;
      }
    }
    function hex(x,y,r,a){
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const ang = Math.PI/3*i - Math.PI/6;
        const px = x+r*Math.cos(ang), py = y+r*Math.sin(ang);
        i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(78,196,200,'+a+')';
      ctx.stroke();
    }
    function frame(){
      t += 0.007;
      ctx.clearRect(0,0,w,h);
      const g = ctx.createRadialGradient(w*.5,h*.3,20,w*.5,h*.3,Math.max(w,h)*.55);
      g.addColorStop(0,'rgba(212,168,75,0.035)');
      g.addColorStop(.4,'rgba(78,196,200,0.018)');
      g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      for(const hx of hexes){
        const wave = .5 + .5*Math.sin(t + hx.p + hx.x*.01 + hx.y*.008);
        hex(hx.x, hx.y, R*(.85+wave*.08), 0.012 + wave*0.05);
        if(wave > .88){
          ctx.beginPath(); ctx.arc(hx.x,hx.y,1.1,0,Math.PI*2);
          ctx.fillStyle = 'rgba(212,168,75,'+(0.12+wave*.22)+')'; ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    resize(); frame();
  };

  /* ── boot loader ───────────────────────────── */
  AA.initBoot = function(){
    const b = document.getElementById('aaBoot');
    if(!b) return;
    const done = ()=> setTimeout(()=>{ b.classList.add('gone'); setTimeout(()=>b.remove(), 700); }, 260);
    if(document.readyState === 'complete') done();
    else window.addEventListener('load', done);
  };

  /* ── ticker builder ────────────────────────── */
  AA.initTicker = function(sel, items){
    const el = document.querySelector(sel || '.aa-ticker .track');
    if(!el) return;
    const list = items || [];
    const html = list.map(s=>'<span>'+s+'</span>').join('');
    el.innerHTML = html + html;
  };



  /* ── public chat room (WebSocket realtime + REST fallback) ── */
  AA.initChat = function(){
    if (/\/admin/i.test(location.pathname)) return;
    if (document.getElementById('aaChatFab')) return;

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'aaChatFab';
    fab.className = 'aa-chat-fab';
    fab.setAttribute('aria-label', 'Open community chat');
    fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="badge" id="aaChatBadge">0</span>';

    const panel = document.createElement('div');
    panel.id = 'aaChatPanel';
    panel.className = 'aa-chat-panel';
    panel.innerHTML =
      '<div class="aa-chat-head">' +
        '<div><div class="title">Discussion Room</div><div class="sub" id="aaChatSub">Connecting…</div></div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<button type="button" id="aaChatMusic" title="Hindi music" style="background:none;border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#d4a84b;font-size:14px;padding:3px 7px;cursor:pointer;line-height:1">&#127925;</button>' +
          '<button type="button" class="close" id="aaChatClose" aria-label="Close">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="aa-chat-msgs" id="aaChatMsgs"><div class="aa-chat-empty">Loading…</div></div>' +
      '<div class="aa-chat-foot">' +
        '<div class="aa-chat-name-row">' +
          '<input id="aaChatName" maxlength="24" placeholder="Your name" autocomplete="nickname">' +
        '</div>' +
        '<div class="aa-chat-send-row">' +
          '<input id="aaChatInput" maxlength="400" placeholder="Say something…" autocomplete="off">' +
          '<button type="button" id="aaChatSend">Send</button>' +
        '</div>' +
        '<div class="aa-chat-status" id="aaChatStatus"></div>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const msgsEl = document.getElementById('aaChatMsgs');
    const nameEl = document.getElementById('aaChatName');
    const inputEl = document.getElementById('aaChatInput');
    const sendBtn = document.getElementById('aaChatSend');
    const statusEl = document.getElementById('aaChatStatus');
    const badge = document.getElementById('aaChatBadge');
    const subEl = document.getElementById('aaChatSub');

    let lastId = null;
    let knownIds = {};
    let pollTimer = null;
    let myName = localStorage.getItem('aa_chat_name') || '';
    let unread = 0;
    let open = false;
    let online = 0;
    let ws = null;
    let wsMode = false;
    let reconnectTimer = null;
    let pingTimer = null;

    if (myName) nameEl.value = myName;

    function setStatus(t, err) {
      statusEl.textContent = t || '';
      statusEl.className = 'aa-chat-status' + (err ? ' err' : '');
    }
    function setSub() {
      const live = wsMode && ws && ws.readyState === 1;
      const base = live ? 'Live' : 'Online';
      subEl.textContent = online > 0 ? (base + ' \u00B7 ' + online + ' online') : (base + ' \u00B7 everyone can join');
    }
    function fmtTime(iso) {
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ''; }
    }
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s == null ? '' : String(s);
      return d.innerHTML;
    }
    function renderMsg(m, fromLive) {
      if (!m || !m.id || knownIds[m.id]) return;
      knownIds[m.id] = true;
      const empty = msgsEl.querySelector('.aa-chat-empty');
      if (empty) empty.remove();
      const mine = myName && m.name === myName;
      const el = document.createElement('div');
      el.className = 'aa-chat-msg' + (mine ? ' mine' : '');
      el.dataset.id = m.id;
      el.innerHTML =
        '<div class="who">' + esc(m.name) + '</div>' +
        '<div class="txt">' + esc(m.text) + '</div>' +
        '<div class="when">' + esc(fmtTime(m.ts)) + '</div>';
      msgsEl.appendChild(el);
      lastId = m.id;
      if (open) msgsEl.scrollTop = msgsEl.scrollHeight;
      else if (!mine) {
        unread++;
        badge.textContent = unread > 99 ? '99+' : String(unread);
        fab.classList.add('has-new');
      }
    }
    async function loadHistory() {
      try {
        const r = await fetch('/api/chat?t=' + Date.now(), { cache: 'no-store' });
        const d = await r.json();
        const list = (d && d.messages) || [];
        if (typeof d.online === 'number') { online = d.online; setSub(); }
        if (!list.length) {
          if (!msgsEl.querySelector('.aa-chat-msg')) {
            msgsEl.innerHTML = '<div class="aa-chat-empty">No messages yet.<br>Be the first to say hello.</div>';
          }
          return;
        }
        list.forEach(function(m){ renderMsg(m, false); });
        if (open) msgsEl.scrollTop = msgsEl.scrollHeight;
      } catch (e) {
        if (!msgsEl.querySelector('.aa-chat-msg')) {
          msgsEl.innerHTML = '<div class="aa-chat-empty">Chat temporarily unavailable.</div>';
        }
      }
    }
    function stopPoll() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
    function startPoll() {
      stopPoll();
      pollTimer = setInterval(function() {
        if (wsMode && ws && ws.readyState === 1) return;
        loadHistory();
      }, open ? 3000 : 15000);
    }
    function wsUrl() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return proto + '//' + location.host + '/ws/chat';
    }
    function connectWs() {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) {
        try { ws.close(); } catch (e) {}
        ws = null;
      }
      let socket;
      try { socket = new WebSocket(wsUrl()); } catch (e) {
        wsMode = false; setSub(); startPoll(); return;
      }
      ws = socket;
      socket.addEventListener('open', function() {
        wsMode = true;
        setSub();
        stopPoll();
        if (myName) {
          try { socket.send(JSON.stringify({ type: 'join', name: myName })); } catch (e) {}
        }
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(function() {
          if (ws && ws.readyState === 1) {
            try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) {}
          }
        }, 25000);
      });
      socket.addEventListener('message', function(ev) {
        let data;
        try { data = JSON.parse(ev.data); } catch (e) { return; }
        if (!data || !data.type) return;
        if (data.type === 'hello') {
          if (typeof data.online === 'number') online = data.online;
          setSub();
        } else if (data.type === 'presence') {
          if (typeof data.online === 'number') online = data.online;
          setSub();
        } else if (data.type === 'message' && data.message) {
          renderMsg(data.message, true);
        } else if (data.type === 'cleared') {
          knownIds = {};
          lastId = null;
          msgsEl.innerHTML = '<div class="aa-chat-empty">Chat was cleared.<br>Say hello again.</div>';
        } else if (data.type === 'error') {
          setStatus(data.error || 'Error', true);
        } else if (data.type === 'pong') {
          /* keepalive */
        }
      });
      socket.addEventListener('close', function() {
        wsMode = false;
        setSub();
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        startPoll();
        reconnectTimer = setTimeout(connectWs, 2500);
      });
      socket.addEventListener('error', function() {
        try { socket.close(); } catch (e) {}
      });
    }
    function openPanel() {
      open = true;
      panel.classList.add('open');
      fab.classList.add('open');
      fab.classList.remove('has-new');
      unread = 0;
      badge.textContent = '0';
      msgsEl.scrollTop = msgsEl.scrollHeight;
      inputEl.focus();
      if (!wsMode) startPoll();
    }
    function closePanel() {
      open = false;
      panel.classList.remove('open');
      fab.classList.remove('open');
    }
    async function send() {
      const name = (nameEl.value || '').trim();
      const text = (inputEl.value || '').trim();
      if (name.length < 2) { setStatus('Enter a name (at least 2 characters)', true); nameEl.focus(); return; }
      if (!text) { setStatus('Type a message', true); inputEl.focus(); return; }
      myName = name;
      localStorage.setItem('aa_chat_name', name);
      sendBtn.disabled = true;
      setStatus('Sending…');

      // Prefer WebSocket realtime path
      if (ws && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({ type: 'chat', name: name, text: text }));
          inputEl.value = '';
          setStatus('');
          sendBtn.disabled = false;
          inputEl.focus();
          return;
        } catch (e) { /* fall through to REST */ }
      }

      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, text: text })
        });
        const d = await r.json().catch(function(){ return {}; });
        if (!r.ok) throw new Error(d.error || 'Could not send');
        inputEl.value = '';
        setStatus('');
        if (d.message) renderMsg(d.message, false);
        if (typeof d.online === 'number') { online = d.online; setSub(); }
        msgsEl.scrollTop = msgsEl.scrollHeight;
      } catch (e) {
        setStatus(e.message || 'Send failed', true);
      } finally {
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    fab.addEventListener('click', openPanel);
    document.getElementById('aaChatClose').addEventListener('click', closePanel);

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    nameEl.addEventListener('change', function() {
      myName = (nameEl.value || '').trim();
      if (myName) {
        localStorage.setItem('aa_chat_name', myName);
        if (ws && ws.readyState === 1) {
          try { ws.send(JSON.stringify({ type: 'join', name: myName })); } catch (e) {}
        }
      }
    });

    loadHistory();
    connectWs();

    /* ── Hindi music player ── */
    var chatMusicOn = false;
    var chatPlaylist = [];
    var chatTrackIdx = 0;
    var chatAudio = null;
    var musicBtn = document.getElementById('aaChatMusic');

    function shuffleArr(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function musicSub(txt) {
      var el = document.getElementById('aaChatSub');
      if (el && chatMusicOn) el.textContent = txt;
    }

    async function loadMusic() {
      try {
        var r = await fetch('/api/music/popular');
        var d = await r.json();
        if (d.status && d.results && d.results.length) {
          chatPlaylist = shuffleArr(d.results.slice());
          chatTrackIdx = 0;
        }
      } catch(e) {}
    }

    async function playMusicTrack(track) {
      if (!track || !chatMusicOn) return;
      musicSub(track.title + ' - ' + track.artist);
      try {
        var r = await fetch('/api/music/stream/' + track.id);
        var d = await r.json();
        if (d.status && d.stream) {
          if (chatAudio) { chatAudio.pause(); chatAudio = null; }
          chatAudio = new Audio(d.stream);
          chatAudio.volume = 0.3;
          chatAudio.onended = function() { nextMusicTrack(); };
          chatAudio.onerror = function() { nextMusicTrack(); };
          chatAudio.play().catch(function() { nextMusicTrack(); });
        } else {
          nextMusicTrack();
        }
      } catch(e) { nextMusicTrack(); }
    }

    function nextMusicTrack() {
      if (!chatMusicOn) return;
      chatTrackIdx++;
      if (chatTrackIdx >= chatPlaylist.length - 2) {
        fetchMoreMusic();
      }
      if (chatTrackIdx >= chatPlaylist.length) {
        chatTrackIdx = 0;
      }
      playMusicTrack(chatPlaylist[chatTrackIdx]);
    }

    async function fetchMoreMusic() {
      try {
        var r = await fetch('/api/music/trending');
        var d = await r.json();
        if (d.status && d.results && d.results.length) {
          var existing = {};
          chatPlaylist.forEach(function(s) { existing[s.id] = true; });
          d.results.forEach(function(s) { if (!existing[s.id]) chatPlaylist.push(s); });
        }
      } catch(e) {}
    }

    if (musicBtn) {
      musicBtn.addEventListener('click', function() {
        chatMusicOn = !chatMusicOn;
        if (chatMusicOn) {
          this.textContent = '\uD83D\uDD0A';
          if (!chatPlaylist.length) {
            loadMusic().then(function() { if (chatPlaylist.length) playMusicTrack(chatPlaylist[0]); });
          } else {
            playMusicTrack(chatPlaylist[chatTrackIdx]);
          }
        } else {
          this.textContent = '\uD83C\uDFB5';
          if (chatAudio) { chatAudio.pause(); chatAudio = null; }
          musicSub('Live \u00B7 ' + chatOnlineCount() + ' online');
        }
      });
    }
  };

  /* ── auto-init ─────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function(){
    AA.initNav(); AA.initReveal(); AA.initGlow(); AA.initBoot(); AA.initChat();
    if(document.getElementById('aaCanvas')) AA.initField('aaCanvas');
  });
})();
