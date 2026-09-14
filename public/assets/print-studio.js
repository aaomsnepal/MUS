/* ═══════════════════════════════════════════════════════════
   aaomsPrint · Card Studio engine
   Canvas renderer + DOM overlay. Everything the preview shows
   is drawn by the same function used for export, so what you
   see is exactly what prints.
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─────────────── constants ─────────────── */
const CARD_MM = { w: 85.6, h: 53.98 };
const FONTS = {
  display: 'Fraunces, Georgia, serif',
  sans: 'Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  tech: 'Rajdhani, Inter, sans-serif',
  condensed: 'Oswald, Inter, sans-serif'
};
const FIELDS = [
  ['none', 'No binding — fixed text'],
  ['org', 'Organization'], ['sub', 'Sub-line / branch'],
  ['name', 'Full name'], ['role', 'Role / title'],
  ['id', 'ID number'], ['dept', 'Department'],
  ['blood', 'Blood group'], ['valid', 'Valid till'],
  ['phone', 'Phone'], ['email', 'Email'], ['addr', 'Address'],
  ['c1', 'Custom 1'], ['c2', 'Custom 2']
];

/* Code 128 patterns (index 0-106) */
const C128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
'221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
'221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
'212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
'231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
'231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
'314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
'112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
'111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
'214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
'114131','311141','411131','211412','211214','211232','2331112'];

/* ─────────────── state ─────────────── */
const S = {
  side: 'front', orient: 'h', accent: '#d4a84b',
  bg: { type: 'gradient', c1: '#152030', c2: '#0b1118', angle: 135, imageUrl: null, opacity: 100, bar: 4, sheen: true },
  front: [], back: [],
  data: {},
  photoUrl: null, logoUrl: null, photoZoom: 100,
  sel: null, zoom: 120,
  snap: true, guides: true, bleed: false, grid: false,
  printerId: 'evolis-primacy', sides: 'single',
  printers: [], pricing: null,
  history: [], hIdx: -1, quiet: false
};
const IMG = {};           // url -> HTMLImageElement cache
const $ = id => document.getElementById(id);
const els = () => S.side === 'front' ? S.front : S.back;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = p => (p || 'el') + Math.random().toString(36).slice(2, 7);

/* ─────────────── image loader ─────────────── */
function loadImg(url) {
  if (!url) return null;
  if (IMG[url]) return IMG[url].ok ? IMG[url].img : null;
  const img = new Image();
  // Only request CORS mode for images on a different origin. This was
  // being set unconditionally, including for same-origin assets (the
  // logo, uploaded photos, template backgrounds) — on hosts where the
  // static file layer doesn't echo back Access-Control-Allow-Origin,
  // that made the browser refuse to load them at all, leaving that
  // part of the card canvas blank. Same-origin images never need it.
  try {
    if (new URL(url, window.location.href).origin !== window.location.origin) {
      img.crossOrigin = 'anonymous';
    }
  } catch (e) { /* relative/same-origin url — leave crossOrigin unset */ }
  IMG[url] = { img, ok: false };
  img.onload = () => { IMG[url].ok = true; render(); };
  img.onerror = () => { IMG[url].ok = false; };
  img.src = url;
  return null;
}

/* ─────────────── templates ─────────────── */
function T(type, x, y, w, h, extra) {
  return Object.assign({
    id: uid(type), type, text: '', bind: 'none',
    x, y, w, h, fs: 10, font: 'sans', weight: 600,
    color: '#f2ede1', align: 'left', ls: 0, opacity: 100,
    radius: 2, fill: 'accent', rot: 0, caps: false,
    locked: false, hidden: false, qrData: '{id}'
  }, extra || {});
}
const L = (x, y, w, bind, extra) => T('label', x, y, w, 7, Object.assign({ bind, fs: 5, font: 'sans', weight: 700, ls: 12, color: 'accent', caps: true }, extra));
const T1 = (x, y, w, h, bind, extra) => T('text', x, y, w, h, Object.assign({ bind, fs: 12, font: 'display', weight: 600 }, extra));
const M = (x, y, w, bind, extra) => T('mono', x, y, w, 7, Object.assign({ bind, fs: 5.5, font: 'mono', weight: 400, color: '#b9b3a5' }, extra));

const TEMPLATES = {
  'hospital-staff': { cat: 'health', name: 'Hospital staff', sub: 'photo left · duplex', accent: '#4ec4c8',
    bg: { type: 'gradient', c1: '#0e2230', c2: '#071016', angle: 135, bar: 5 },
    front: [
      T('shape', 0, 0, 100, 17, { fill: 'accent', opacity: 92, radius: 0 }),
      T('logo', 3, 3, 11, 11, {}),
      T1(16, 3.5, 60, 8, 'org', { fs: 7.5, color: '#04161c', weight: 700, font: 'tech' }),
      M(16, 10.5, 60, 'sub', { fs: 4.6, color: '#062028' }),
      T('photo', 4, 24, 26, 52, { radius: 3 }),
      T1(34, 26, 62, 12, 'name', { fs: 11 }),
      M(34, 40, 62, 'role', { fs: 6, color: '#d9d3c4' }),
      M(34, 49, 62, 'dept', { fs: 5.2 }),
      L(34, 58, 30, 'none', { text: 'ID NUMBER' }),
      M(34, 64, 40, 'id', { fs: 6.4, color: '#f2ede1' }),
      T('qr', 82, 58, 14, 22, { qrData: '{id}|{name}|{org}' }),
      T('line', 4, 84, 92, 0.7, { fill: 'accent', opacity: 55 }),
      M(4, 87, 60, 'valid', { fs: 4.6, text: 'Valid till {valid}', bind: 'none' }),
      M(60, 87, 36, 'blood', { fs: 4.6, align: 'right', text: 'Blood {blood}', bind: 'none' })
    ],
    back: [
      T('shape', 0, 0, 100, 10, { fill: 'accent', opacity: 88, radius: 0 }),
      L(4, 2.5, 60, 'none', { text: 'IF FOUND, PLEASE RETURN TO', color: '#04161c' }),
      M(4, 16, 92, 'addr', { fs: 5 }),
      M(4, 24, 92, 'phone', { fs: 5 }),
      M(4, 32, 92, 'email', { fs: 5 }),
      T('barcode', 4, 46, 60, 20, { qrData: '{id}' }),
      T('qr', 74, 44, 22, 34, { qrData: '{id}' }),
      T('line', 4, 78, 44, 0.6, { fill: '#8a8780' }),
      M(4, 81, 44, 'none', { text: 'Authorised signature', fs: 4.4 })
    ] },

  'hospital-doctor': { cat: 'health', name: 'Doctor / consultant', sub: 'dark premium', accent: '#6dcaa0',
    bg: { type: 'diagonal', c1: '#0a1a18', c2: '#04100e', angle: 160, bar: 0 },
    front: [
      T('photo', 68, 12, 27, 54, { radius: 4 }),
      T('logo', 5, 6, 12, 12, {}),
      L(20, 8, 44, 'none', { text: 'MEDICAL IDENTITY' }),
      T1(5, 24, 60, 13, 'name', { fs: 12.5 }),
      M(5, 40, 60, 'role', { fs: 6.2, color: '#d9d3c4' }),
      M(5, 48, 60, 'dept', { fs: 5.4 }),
      T('line', 5, 58, 55, 0.6, { fill: 'accent' }),
      L(5, 62, 30, 'none', { text: 'REG / ID' }),
      M(5, 68, 45, 'id', { fs: 6.6, color: '#f2ede1' }),
      T('qr', 68, 70, 14, 22, { qrData: '{name}|{id}' }),
      M(5, 88, 55, 'org', { fs: 4.8 })
    ],
    back: [
      L(5, 8, 60, 'none', { text: 'EMERGENCY INFORMATION' }),
      M(5, 18, 90, 'none', { text: 'Blood group: {blood}', fs: 5.4 }),
      M(5, 26, 90, 'phone', { fs: 5.4 }),
      M(5, 34, 90, 'addr', { fs: 5 }),
      T('barcode', 5, 50, 60, 18, { qrData: '{id}' }),
      T('qr', 74, 48, 21, 33, { qrData: '{id}' }),
      M(5, 86, 90, 'none', { text: 'Property of {org}. Non-transferable.', fs: 4.4 })
    ] },

  'patient-card': { cat: 'health', name: 'Patient / OPD', sub: 'clinic record card', accent: '#e07070',
    bg: { type: 'solid', c1: '#131820', c2: '#131820', bar: 6 },
    front: [
      T('logo', 4, 5, 11, 11, {}),
      T1(18, 5, 60, 8, 'org', { fs: 7.5, font: 'tech' }),
      L(4, 22, 40, 'none', { text: 'PATIENT NAME' }),
      T1(4, 28, 64, 11, 'name', { fs: 10 }),
      L(4, 44, 30, 'none', { text: 'MRN / OPD NO.' }),
      M(4, 50, 44, 'id', { fs: 7, color: '#f2ede1' }),
      L(4, 62, 30, 'none', { text: 'BLOOD' }),
      M(4, 68, 20, 'blood', { fs: 6.4, color: '#f2ede1' }),
      T('qr', 78, 46, 18, 28, { qrData: '{id}' }),
      M(4, 86, 70, 'phone', { fs: 4.8 })
    ],
    back: [
      L(5, 8, 60, 'none', { text: 'VISIT RECORD' }),
      T('line', 5, 18, 90, 0.5, { fill: '#55524c' }),
      T('line', 5, 32, 90, 0.5, { fill: '#55524c' }),
      T('line', 5, 46, 90, 0.5, { fill: '#55524c' }),
      T('line', 5, 60, 90, 0.5, { fill: '#55524c' }),
      M(5, 68, 90, 'addr', { fs: 4.6 }),
      T('barcode', 5, 76, 55, 16, { qrData: '{id}' })
    ] },

  'school-student': { cat: 'edu', name: 'Student ID', sub: 'school / college', accent: '#5b8dd6',
    bg: { type: 'wave', c1: '#0d1a2c', c2: '#060d16', angle: 140, bar: 6 },
    front: [
      T('logo', 42, 4, 16, 16, { }),
      T1(4, 22, 92, 7, 'org', { fs: 6.6, align: 'center', font: 'tech', weight: 700 }),
      T('photo', 36, 31, 28, 34, { radius: 3 }),
      T1(4, 68, 92, 9, 'name', { fs: 8.5, align: 'center' }),
      M(4, 78, 92, 'role', { fs: 5, align: 'center' }),
      M(4, 85, 92, 'id', { fs: 5.4, align: 'center', color: '#f2ede1' })
    ],
    back: [
      L(5, 8, 60, 'none', { text: 'STUDENT DETAILS' }),
      M(5, 18, 90, 'dept', { fs: 5.2, text: 'Class / Program: {dept}', bind: 'none' }),
      M(5, 26, 90, 'blood', { fs: 5.2, text: 'Blood group: {blood}', bind: 'none' }),
      M(5, 34, 90, 'valid', { fs: 5.2, text: 'Valid till: {valid}', bind: 'none' }),
      M(5, 42, 90, 'phone', { fs: 5.2 }),
      T('barcode', 5, 54, 58, 18, { qrData: '{id}' }),
      T('qr', 72, 52, 22, 34, { qrData: '{id}' }),
      M(5, 86, 90, 'addr', { fs: 4.4 })
    ] },

  'school-teacher': { cat: 'edu', name: 'Teacher / faculty', sub: 'campus staff', accent: '#9b7dff',
    bg: { type: 'grid', c1: '#141026', c2: '#08060f', angle: 130, bar: 5 },
    front: [
      T('shape', 0, 0, 34, 100, { fill: 'accent', opacity: 16, radius: 0 }),
      T('photo', 4, 22, 26, 50, { radius: 3 }),
      T('logo', 6, 5, 12, 12, {}),
      L(37, 10, 50, 'none', { text: 'FACULTY' }),
      T1(37, 20, 58, 12, 'name', { fs: 10.5 }),
      M(37, 35, 58, 'role', { fs: 6 }),
      M(37, 43, 58, 'dept', { fs: 5.4 }),
      L(37, 54, 30, 'none', { text: 'STAFF ID' }),
      M(37, 60, 40, 'id', { fs: 6.4, color: '#f2ede1' }),
      T('qr', 80, 68, 15, 24, { qrData: '{id}' }),
      M(37, 88, 42, 'org', { fs: 4.6 })
    ],
    back: [
      L(5, 8, 60, 'none', { text: 'CAMPUS ACCESS' }),
      M(5, 20, 90, 'addr', { fs: 5 }),
      M(5, 28, 90, 'phone', { fs: 5 }),
      T('qr', 36, 40, 28, 44, { qrData: '{id}|{name}' }),
      M(5, 88, 90, 'none', { text: 'Return to {org} if found.', fs: 4.4, align: 'center' })
    ] },

  'corporate-employee': { cat: 'corp', name: 'Employee badge', sub: 'corporate standard', accent: '#d4a84b',
    bg: { type: 'gradient', c1: '#1b1a17', c2: '#0a0a09', angle: 135, bar: 5 },
    front: [
      T('logo', 4, 5, 12, 12, {}),
      T1(19, 6, 50, 7, 'org', { fs: 6.6, font: 'tech', weight: 700 }),
      T('photo', 70, 22, 26, 50, { radius: 3 }),
      T1(4, 28, 62, 12, 'name', { fs: 11 }),
      M(4, 43, 62, 'role', { fs: 6 }),
      M(4, 51, 62, 'dept', { fs: 5.2 }),
      T('line', 4, 62, 60, 0.6, { fill: 'accent' }),
      M(4, 67, 50, 'id', { fs: 6.2, color: '#f2ede1' }),
      T('barcode', 4, 78, 50, 15, { qrData: '{id}' })
    ],
    back: [
      T('shape', 0, 0, 100, 12, { fill: 'accent', opacity: 90, radius: 0 }),
      L(4, 3.5, 60, 'none', { text: 'ACCESS & CONTACT', color: '#1a1208' }),
      M(4, 20, 92, 'addr', { fs: 5 }),
      M(4, 28, 92, 'phone', { fs: 5 }),
      M(4, 36, 92, 'email', { fs: 5 }),
      T('qr', 70, 46, 26, 40, { qrData: '{name}|{id}|{org}' }),
      T('line', 4, 76, 44, 0.6, { fill: '#8a8780' }),
      M(4, 79, 44, 'none', { text: 'Signature', fs: 4.4 })
    ] },

  'corporate-exec': { cat: 'corp', name: 'Executive', sub: 'minimal luxury', accent: '#d4a84b',
    bg: { type: 'solid', c1: '#0a0a0b', c2: '#0a0a0b', bar: 0 },
    front: [
      T('line', 8, 22, 22, 0.8, { fill: 'accent' }),
      T1(8, 30, 70, 14, 'name', { fs: 13 }),
      M(8, 48, 70, 'role', { fs: 6, ls: 8 }),
      T('logo', 78, 8, 14, 14, {}),
      M(8, 84, 60, 'org', { fs: 4.8, ls: 10 }),
      M(60, 84, 32, 'id', { fs: 4.8, align: 'right' })
    ],
    back: [
      T('logo', 42, 26, 16, 16, {}),
      M(8, 52, 84, 'phone', { fs: 5.4, align: 'center' }),
      M(8, 60, 84, 'email', { fs: 5.4, align: 'center' }),
      M(8, 68, 84, 'addr', { fs: 4.8, align: 'center' })
    ] },

  'visitor': { cat: 'corp', name: 'Visitor pass', sub: 'day badge', accent: '#e07070',
    bg: { type: 'diagonal', c1: '#2a1416', c2: '#100708', angle: 145, bar: 8 },
    front: [
      T1(4, 12, 92, 14, 'none', { text: 'VISITOR', fs: 13, align: 'center', font: 'condensed', weight: 600, ls: 14 }),
      T('line', 20, 30, 60, 0.7, { fill: 'accent' }),
      T1(4, 36, 92, 12, 'name', { fs: 10, align: 'center' }),
      M(4, 50, 92, 'role', { fs: 5.4, align: 'center', text: 'Host: {role}', bind: 'none' }),
      M(4, 58, 92, 'valid', { fs: 5.4, align: 'center', text: 'Valid: {valid}', bind: 'none' }),
      T('qr', 42, 66, 16, 25, { qrData: '{id}' })
    ],
    back: [
      L(5, 10, 90, 'none', { text: 'VISITOR RULES', align: 'center' }),
      M(5, 24, 90, 'none', { text: 'Wear this badge visibly at all times.', fs: 4.8, align: 'center' }),
      M(5, 34, 90, 'none', { text: 'Escort required in restricted areas.', fs: 4.8, align: 'center' }),
      M(5, 44, 90, 'none', { text: 'Return at reception on exit.', fs: 4.8, align: 'center' }),
      M(5, 62, 90, 'phone', { fs: 5, align: 'center' }),
      M(5, 76, 90, 'org', { fs: 5, align: 'center' })
    ] },

  'contractor': { cat: 'corp', name: 'Contractor', sub: 'temporary access', accent: '#f0a04b',
    bg: { type: 'circuit', c1: '#221709', c2: '#0d0904', angle: 135, bar: 6 },
    front: [
      T('photo', 4, 20, 24, 48, { radius: 3 }),
      L(32, 12, 50, 'none', { text: 'CONTRACTOR' }),
      T1(32, 20, 64, 11, 'name', { fs: 10 }),
      M(32, 34, 64, 'role', { fs: 5.6 }),
      M(32, 42, 64, 'org', { fs: 5.6 }),
      M(32, 52, 64, 'id', { fs: 6, color: '#f2ede1' }),
      M(32, 62, 64, 'valid', { fs: 5, text: 'Expires {valid}', bind: 'none' }),
      T('barcode', 4, 74, 54, 16, { qrData: '{id}' }),
      T('qr', 78, 70, 18, 26, { qrData: '{id}' })
    ],
    back: [
      L(5, 10, 90, 'none', { text: 'SAFETY DECLARATION' }),
      M(5, 22, 90, 'none', { text: 'PPE mandatory on site.', fs: 4.8 }),
      M(5, 30, 90, 'none', { text: 'Report to site office on arrival.', fs: 4.8 }),
      M(5, 44, 90, 'phone', { fs: 5 }),
      M(5, 52, 90, 'addr', { fs: 4.6 }),
      T('qr', 70, 56, 26, 38, { qrData: '{id}' })
    ] },

  'membership': { cat: 'corp', name: 'Membership', sub: 'club / loyalty', accent: '#c9a227',
    bg: { type: 'gradient', c1: '#1d1608', c2: '#080604', angle: 120, bar: 0 },
    front: [
      T('logo', 6, 8, 14, 14, {}),
      L(72, 12, 24, 'none', { text: 'MEMBER', align: 'right' }),
      T1(6, 44, 66, 12, 'name', { fs: 10.5 }),
      M(6, 58, 66, 'role', { fs: 5.4, text: '{role} member', bind: 'none' }),
      M(6, 76, 60, 'id', { fs: 7, font: 'mono', ls: 6, color: '#f2ede1' }),
      M(60, 84, 36, 'valid', { fs: 4.6, align: 'right', text: 'Valid {valid}', bind: 'none' })
    ],
    back: [
      T('shape', 0, 14, 100, 16, { fill: '#000000', opacity: 100, radius: 0 }),
      T('barcode', 6, 42, 60, 20, { qrData: '{id}' }),
      T('qr', 74, 40, 20, 32, { qrData: '{id}' }),
      M(6, 74, 90, 'phone', { fs: 4.6 }),
      M(6, 82, 90, 'none', { text: 'Terms apply. Non-transferable.', fs: 4.2 })
    ] },

  'gym': { cat: 'corp', name: 'Gym / fitness', sub: 'bold sport', accent: '#6dcaa0',
    bg: { type: 'diagonal', c1: '#06231b', c2: '#02100c', angle: 155, bar: 7 },
    front: [
      T1(5, 10, 60, 12, 'org', { fs: 10, font: 'condensed', weight: 600, ls: 4 }),
      T('photo', 70, 20, 26, 50, { radius: 40 }),
      T1(5, 32, 60, 12, 'name', { fs: 10 }),
      M(5, 46, 60, 'role', { fs: 5.6 }),
      L(5, 58, 40, 'none', { text: 'MEMBER ID' }),
      M(5, 64, 50, 'id', { fs: 6.4, color: '#f2ede1' }),
      M(5, 82, 60, 'valid', { fs: 5, text: 'Expires {valid}', bind: 'none' }),
      T('qr', 72, 74, 16, 22, { qrData: '{id}' })
    ],
    back: [
      L(5, 10, 90, 'none', { text: 'ACCESS HOURS' }),
      M(5, 22, 90, 'none', { text: 'Sun – Fri · 5:00 – 21:00', fs: 5 }),
      M(5, 32, 90, 'phone', { fs: 5 }),
      M(5, 40, 90, 'addr', { fs: 4.6 }),
      T('barcode', 5, 54, 58, 18, { qrData: '{id}' }),
      T('qr', 72, 52, 22, 34, { qrData: '{id}' })
    ] },

  'event': { cat: 'event', name: 'Event badge', sub: 'conference', accent: '#4ec4c8',
    bg: { type: 'hex', c1: '#08222a', c2: '#030f13', angle: 135, bar: 6 },
    front: [
      T1(4, 8, 92, 8, 'org', { fs: 7, align: 'center', font: 'tech', weight: 700, ls: 6 }),
      T('line', 30, 19, 40, 0.6, { fill: 'accent' }),
      T1(4, 26, 92, 15, 'name', { fs: 13, align: 'center' }),
      M(4, 44, 92, 'role', { fs: 6, align: 'center' }),
      M(4, 53, 92, 'dept', { fs: 5.2, align: 'center' }),
      T('qr', 40, 62, 20, 30, { qrData: '{id}|{name}' })
    ],
    back: [
      L(5, 10, 90, 'none', { text: 'SCHEDULE & ACCESS', align: 'center' }),
      M(5, 24, 90, 'none', { text: 'Day 1 · Keynote 09:00', fs: 5, align: 'center' }),
      M(5, 32, 90, 'none', { text: 'Day 2 · Workshops 10:00', fs: 5, align: 'center' }),
      M(5, 46, 90, 'phone', { fs: 5, align: 'center' }),
      M(5, 54, 90, 'addr', { fs: 4.6, align: 'center' }),
      T('barcode', 20, 66, 60, 20, { qrData: '{id}' })
    ] },

  'press': { cat: 'event', name: 'Press / media', sub: 'high contrast', accent: '#e07070',
    bg: { type: 'solid', c1: '#0b0b0c', c2: '#0b0b0c', bar: 10 },
    front: [
      T1(4, 14, 92, 14, 'none', { text: 'PRESS', fs: 14, align: 'center', font: 'condensed', ls: 18, color: 'accent' }),
      T('photo', 37, 30, 26, 34, { radius: 3 }),
      T1(4, 66, 92, 10, 'name', { fs: 9, align: 'center' }),
      M(4, 77, 92, 'org', { fs: 5.2, align: 'center' }),
      M(4, 85, 92, 'id', { fs: 4.8, align: 'center' })
    ],
    back: [
      L(5, 12, 90, 'none', { text: 'MEDIA ACCESS', align: 'center' }),
      M(5, 26, 90, 'none', { text: 'Valid for accredited zones only.', fs: 4.8, align: 'center' }),
      T('qr', 36, 38, 28, 42, { qrData: '{id}' }),
      M(5, 86, 90, 'phone', { fs: 4.6, align: 'center' })
    ] },

  'volunteer': { cat: 'event', name: 'Volunteer / crew', sub: 'friendly', accent: '#9b7dff',
    bg: { type: 'dots', c1: '#150f2a', c2: '#070512', angle: 135, bar: 6 },
    front: [
      T('logo', 4, 5, 12, 12, {}),
      L(19, 8, 50, 'none', { text: 'CREW' }),
      T('photo', 68, 20, 28, 46, { radius: 40 }),
      T1(5, 28, 58, 12, 'name', { fs: 10.5 }),
      M(5, 42, 58, 'role', { fs: 5.8 }),
      M(5, 52, 58, 'dept', { fs: 5 }),
      M(5, 76, 58, 'id', { fs: 5.6, color: '#f2ede1' }),
      T('qr', 70, 70, 16, 24, { qrData: '{id}' })
    ],
    back: [
      L(5, 10, 90, 'none', { text: 'CREW CONTACT' }),
      M(5, 24, 90, 'phone', { fs: 5 }),
      M(5, 32, 90, 'email', { fs: 5 }),
      M(5, 46, 90, 'addr', { fs: 4.6 }),
      T('barcode', 5, 60, 58, 18, { qrData: '{id}' })
    ] },

  'minimal': { cat: 'corp', name: 'Minimal', sub: 'clean type only', accent: '#e6e2d6',
    bg: { type: 'solid', c1: '#101214', c2: '#101214', bar: 0 },
    front: [
      T1(8, 32, 70, 14, 'name', { fs: 12 }),
      M(8, 50, 70, 'role', { fs: 5.6 }),
      M(8, 78, 50, 'id', { fs: 5.2 }),
      T('photo', 74, 26, 20, 40, { radius: 2 })
    ],
    back: [
      M(8, 40, 84, 'org', { fs: 5.6, align: 'center' }),
      M(8, 50, 84, 'phone', { fs: 5, align: 'center' }),
      T('qr', 40, 58, 20, 30, { qrData: '{id}' })
    ] },

  'blank': { cat: 'corp', name: 'Blank canvas', sub: 'start from zero', accent: '#d4a84b',
    bg: { type: 'gradient', c1: '#152030', c2: '#0b1118', angle: 135, bar: 0 },
    front: [], back: [] }
};

/* ─────────────── data ─────────────── */
function readData() {
  return {
    org: $('dOrg').value, sub: $('dSub').value, name: $('dName').value,
    role: $('dRole').value, id: $('dId').value, dept: $('dDept').value,
    blood: $('dBlood').value, valid: $('dValid').value, phone: $('dPhone').value,
    email: $('dEmail').value, addr: $('dAddr').value, c1: $('dC1').value, c2: $('dC2').value
  };
}
function merge(str, data) {
  return String(str || '').replace(/\{(\w+)\}/g, (m, k) => (data[k] !== undefined && data[k] !== '') ? data[k] : '');
}
function elText(el, data) {
  let t;
  if (el.bind && el.bind !== 'none') t = data[el.bind] || '';
  else t = merge(el.text, data);
  return el.caps ? String(t).toUpperCase() : String(t);
}
function elColor(el) { return el.color === 'accent' ? S.accent : el.color; }
function elFill(el) { return el.fill === 'accent' ? S.accent : el.fill; }

/* ─────────────── QR ─────────────── */
function qrMatrix(text) {
  if (typeof qrcode !== 'function') return null;
  const t = String(text || ' ').slice(0, 400);
  for (let type = 4; type <= 20; type++) {
    try {
      const q = qrcode(type, 'M');
      q.addData(t); q.make();
      return q;
    } catch (e) { /* try bigger */ }
  }
  return null;
}
function drawQR(ctx, x, y, w, h, text, dark, light) {
  const q = qrMatrix(text);
  const side = Math.min(w, h);
  const ox = x + (w - side) / 2, oy = y + (h - side) / 2;
  ctx.fillStyle = light; ctx.fillRect(ox, oy, side, side);
  if (!q) { ctx.fillStyle = dark; ctx.fillRect(ox + side * .2, oy + side * .2, side * .6, side * .6); return; }
  const n = q.getModuleCount();
  const pad = side * 0.06;
  const cell = (side - pad * 2) / n;
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (q.isDark(r, c)) ctx.fillRect(ox + pad + c * cell, oy + pad + r * cell, cell + 0.4, cell + 0.4);
}

/* ─────────────── Code128 barcode ─────────────── */
function code128B(text) {
  const s = String(text || '0').replace(/[^\x20-\x7e]/g, '').slice(0, 24) || '0';
  const codes = [104];
  let sum = 104;
  for (let i = 0; i < s.length; i++) {
    const v = s.charCodeAt(i) - 32;
    codes.push(v); sum += v * (i + 1);
  }
  codes.push(sum % 103, 106);
  return codes.map(c => C128[c]).join('');
}
function drawBarcode(ctx, x, y, w, h, text, dark, light) {
  const pat = code128B(text);
  let total = 0;
  for (const ch of pat) total += parseInt(ch, 10);
  const unit = w / total;
  ctx.fillStyle = light; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = dark;
  let cx = x, bar = true;
  for (const ch of pat) {
    const wd = parseInt(ch, 10) * unit;
    if (bar) ctx.fillRect(cx, y, wd, h * 0.78);
    cx += wd; bar = !bar;
  }
  ctx.fillStyle = dark;
  ctx.font = (h * 0.17) + 'px ' + FONTS.mono;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(String(text).slice(0, 24), x + w / 2, y + h * 0.81);
  ctx.textAlign = 'left';
}

/* ─────────────── background ─────────────── */
function paintBG(ctx, W, H, bg, accent) {
  const c1 = bg.c1 || '#152030', c2 = bg.c2 || '#0b1118';
  const rad = (bg.angle || 135) * Math.PI / 180;
  const gx = Math.cos(rad), gy = Math.sin(rad);

  if (bg.type === 'solid') { ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H); }
  else {
    const g = ctx.createLinearGradient(W / 2 - gx * W / 2, H / 2 - gy * H / 2, W / 2 + gx * W / 2, H / 2 + gy * H / 2);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = accent; ctx.fillStyle = accent;
  const u = H / 100;
  if (bg.type === 'grid') {
    ctx.globalAlpha = 0.14; ctx.lineWidth = Math.max(0.5, u * 0.12);
    for (let x = 0; x < W; x += u * 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += u * 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  } else if (bg.type === 'dots') {
    ctx.globalAlpha = 0.2;
    for (let x = u * 3; x < W; x += u * 5) for (let y = u * 3; y < H; y += u * 5) {
      ctx.beginPath(); ctx.arc(x, y, u * 0.32, 0, Math.PI * 2); ctx.fill();
    }
  } else if (bg.type === 'wave') {
    ctx.globalAlpha = 0.18; ctx.lineWidth = Math.max(0.6, u * 0.18);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const y = H * (0.45 + k * 0.11) + Math.sin(x / W * Math.PI * 3 + k) * H * 0.07;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (bg.type === 'hex') {
    ctx.globalAlpha = 0.16; ctx.lineWidth = Math.max(0.5, u * 0.12);
    const R = u * 5, dx = R * 1.75, dy = R * 1.52;
    let row = 0;
    for (let y = -dy; y < H + dy; y += dy) {
      const off = (row % 2) * dx / 2;
      for (let x = -dx; x < W + dx; x += dx) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          const px = x + off + R * Math.cos(a), py = y + R * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      }
      row++;
    }
  } else if (bg.type === 'circuit') {
    ctx.globalAlpha = 0.2; ctx.lineWidth = Math.max(0.5, u * 0.16);
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 22; i++) {
      let x = rnd() * W, y = rnd() * H;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 3; s++) {
        if (rnd() > .5) x += (rnd() - .5) * W * .3; else y += (rnd() - .5) * H * .3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, u * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  } else if (bg.type === 'diagonal') {
    ctx.globalAlpha = 0.12;
    for (let i = -H; i < W; i += u * 9) {
      ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H * 0.7, 0);
      ctx.lineTo(i + H * 0.7 + u * 3.5, 0); ctx.lineTo(i + u * 3.5, H);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();

  if (bg.type === 'image' && bg.imageUrl) {
    const img = loadImg(bg.imageUrl);
    if (img) {
      ctx.save();
      ctx.globalAlpha = (bg.opacity == null ? 100 : bg.opacity) / 100;
      const r = Math.max(W / img.width, H / img.height);
      const iw = img.width * r, ih = img.height * r;
      ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
      ctx.restore();
    }
  }

  if (bg.sheen) {
    const sh = ctx.createLinearGradient(0, 0, W, H);
    sh.addColorStop(0, 'rgba(255,255,255,0.07)');
    sh.addColorStop(0.42, 'rgba(255,255,255,0.015)');
    sh.addColorStop(0.55, 'rgba(255,255,255,0.05)');
    sh.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
  }

  if (bg.bar > 0) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(0, 0, W, H * bg.bar / 100);
    ctx.globalAlpha = 1;
  }
}

/* ─────────────── element painter ─────────────── */
function fitFont(ctx, text, maxW, size, family, weight) {
  let s = size;
  ctx.font = weight + ' ' + s + 'px ' + family;
  while (ctx.measureText(text).width > maxW && s > 3) {
    s -= Math.max(0.5, s * 0.05);
    ctx.font = weight + ' ' + s + 'px ' + family;
  }
  return s;
}

function paintEl(ctx, el, W, H, data, opts) {
  if (el.hidden) return;
  const x = el.x / 100 * W, y = el.y / 100 * H;
  const w = el.w / 100 * W, h = el.h / 100 * H;
  ctx.save();
  ctx.globalAlpha = (el.opacity == null ? 100 : el.opacity) / 100;
  if (el.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(el.rot * Math.PI / 180); ctx.translate(-(x + w / 2), -(y + h / 2)); }

  if (el.type === 'shape') {
    ctx.fillStyle = elFill(el);
    roundRect(ctx, x, y, w, h, el.radius / 100 * H);
    ctx.fill();
  } else if (el.type === 'line') {
    ctx.fillStyle = elFill(el);
    ctx.fillRect(x, y, w, Math.max(1, h));
  } else if (el.type === 'photo' || el.type === 'logo') {
    const url = el.type === 'photo'
      ? (data && data.__photo ? data.__photo : (opts.photoUrl !== undefined ? opts.photoUrl : S.photoUrl))
      : S.logoUrl;
    const img = loadImg(url);
    ctx.save();
    roundRect(ctx, x, y, w, h, el.radius / 100 * H); ctx.clip();
    if (img) {
      if (el.type === 'logo') {
        const r = Math.min(w / img.width, h / img.height);
        const iw = img.width * r, ih = img.height * r;
        ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      } else {
        const z = (S.photoZoom || 100) / 100;
        const r = Math.max(w / img.width, h / img.height) * z;
        const iw = img.width * r, ih = img.height * r;
        ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = Math.max(6, h * 0.13) + 'px ' + FONTS.mono;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.type === 'logo' ? 'LOGO' : 'PHOTO', x + w / 2, y + h / 2);
    }
    ctx.restore();
  } else if (el.type === 'qr') {
    drawQR(ctx, x, y, w, h, merge(el.qrData, data), '#111111', '#ffffff');
  } else if (el.type === 'barcode') {
    drawBarcode(ctx, x, y, w, h, merge(el.qrData, data), '#111111', '#ffffff');
  } else if (el.type === 'signature') {
    ctx.fillStyle = elFill(el);
    ctx.fillRect(x, y + h * 0.6, w, Math.max(1, H * 0.006));
    ctx.fillStyle = elColor(el);
    ctx.font = (el.fs / 100 * H) + 'px ' + FONTS.mono;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText(elText(el, data) || 'Signature', x, y + h * 0.68);
  } else {
    const text = elText(el, data);
    if (text) {
      const fam = FONTS[el.font] || FONTS.sans;
      const size0 = el.fs / 100 * H;
      ctx.textBaseline = 'top';
      const ls = (el.ls || 0) / 100 * size0;
      const measure = t => ctx.measureText(t).width + ls * Math.max(0, t.length - 1);
      let size = size0;
      ctx.font = el.weight + ' ' + size + 'px ' + fam;
      while (measure(text) > w && size > 3) {
        size -= Math.max(0.4, size * 0.05);
        ctx.font = el.weight + ' ' + size + 'px ' + fam;
      }
      const tw = measure(text);
      let tx = x;
      if (el.align === 'center') tx = x + (w - tw) / 2;
      if (el.align === 'right') tx = x + w - tw;
      ctx.fillStyle = elColor(el);
      if (ls) {
        let cx = tx;
        for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + ls; }
      } else ctx.fillText(text, tx, y);
    }
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ─────────────── full card draw ─────────────── */
function drawCard(ctx, W, H, side, opts) {
  opts = opts || {};
  const data = opts.data || readData();
  const list = side === 'front' ? S.front : S.back;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  roundRect(ctx, 0, 0, W, H, W * 0.028); ctx.clip();
  paintBG(ctx, W, H, S.bg, S.accent);
  list.forEach(el => paintEl(ctx, el, W, H, data, opts));
  ctx.restore();
  if (opts.guides) {
    const m = W * 0.035;
    ctx.strokeStyle = 'rgba(109,202,160,.45)';
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.setLineDash([]);
  }
  if (opts.bleedGuide) {
    ctx.strokeStyle = 'rgba(224,112,112,.5)';
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    const b = W * 0.012;
    ctx.strokeRect(-b, -b, W + b * 2, H + b * 2);
    ctx.setLineDash([]);
  }
  if (opts.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(W * i / 10, 0); ctx.lineTo(W * i / 10, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H * i / 10); ctx.lineTo(W, H * i / 10); ctx.stroke();
    }
  }
}

/* ─────────────── preview render ─────────────── */
function previewSize() {
  const land = S.orient === 'h';
  const base = S.zoom * 3.4;
  const w = land ? base : base * (CARD_MM.h / CARD_MM.w);
  const h = land ? base * (CARD_MM.h / CARD_MM.w) : base;
  return { w: Math.round(w), h: Math.round(h) };
}

function render() {
  const cv = $('cardCanvas'); if (!cv) return;
  const { w, h } = previewSize();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const shell = $('cardShell');
  shell.style.width = w + 'px'; shell.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCard(ctx, w, h, S.side, { guides: S.guides, bleedGuide: S.bleed, grid: S.grid });
  buildOverlay(w, h);
  $('stageSide').textContent = S.side.toUpperCase();
  const p = printer();
  $('stageMeta').textContent = 'CR-80 · ' + (S.orient === 'h' ? '85.6 × 53.98' : '53.98 × 85.6') + ' mm · ' + (p ? p.dpi : 300) + ' dpi';
  renderLayers();
  renderOtherSide(w, h, dpr);
}

// Secondary read-only preview of whichever side (front/back) is NOT
// currently being edited — always visible below the active stage, so
// the back-of-card design is never hidden behind the Front/Back toggle.
function renderOtherSide(w, h, dpr) {
  const other = S.side === 'front' ? 'back' : 'front';
  const cv2 = $('cardCanvasOther'); if (!cv2) return;
  cv2.width = w * dpr; cv2.height = h * dpr;
  cv2.style.width = w + 'px'; cv2.style.height = h + 'px';
  const shell2 = $('cardShellOther');
  if (shell2) { shell2.style.width = w + 'px'; shell2.style.height = h + 'px'; }
  const ctx2 = cv2.getContext('2d');
  ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCard(ctx2, w, h, other, { guides: false, bleedGuide: S.bleed, grid: false });
  const lbl = $('stageOtherSide');
  if (lbl) lbl.textContent = other.toUpperCase();
}

function buildOverlay(w, h) {
  const ov = $('overlay');
  ov.innerHTML = '';
  els().forEach(el => {
    const d = document.createElement('div');
    d.className = 'ov-el' + (S.sel === el.id ? ' sel' : '') + (el.locked ? ' locked' : '');
    d.style.left = (el.x / 100 * w) + 'px';
    d.style.top = (el.y / 100 * h) + 'px';
    d.style.width = (el.w / 100 * w) + 'px';
    d.style.height = (Math.max(el.h, 1.5) / 100 * h) + 'px';
    if (el.rot) d.style.transform = 'rotate(' + el.rot + 'deg)';
    d.dataset.id = el.id;
    const hd = document.createElement('div'); hd.className = 'hdl br'; d.appendChild(hd);
    ov.appendChild(d);
    d.addEventListener('pointerdown', e => {
      if (e.target === hd) return;
      select(el.id);
      if (!el.locked) startDrag(e, el, w, h);
    });
    hd.addEventListener('pointerdown', e => {
      e.stopPropagation(); select(el.id);
      if (!el.locked) startResize(e, el, w, h);
    });
    d.addEventListener('dblclick', () => {
      const inp = document.querySelector('#inspector [data-k="text"]');
      if (inp) { inp.focus(); inp.select(); }
    });
  });
}

const snapv = v => S.snap ? Math.round(v * 2) / 2 : v;

function startDrag(e, el, w, h) {
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y;
  function move(ev) {
    el.x = snapv(clamp(ox + (ev.clientX - sx) / w * 100, -5, 105 - el.w));
    el.y = snapv(clamp(oy + (ev.clientY - sy) / h * 100, -5, 105 - el.h));
    $('posRead').textContent = 'x ' + el.x.toFixed(1) + ' · y ' + el.y.toFixed(1);
    render();
  }
  function up() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    commit();
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
function startResize(e, el, w, h) {
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY, ow = el.w, oh = el.h;
  function move(ev) {
    el.w = snapv(clamp(ow + (ev.clientX - sx) / w * 100, 2, 110 - el.x));
    el.h = snapv(clamp(oh + (ev.clientY - sy) / h * 100, 0.4, 110 - el.y));
    $('posRead').textContent = 'w ' + el.w.toFixed(1) + ' · h ' + el.h.toFixed(1);
    render();
  }
  function up() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    commit();
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* ─────────────── layers + inspector ─────────────── */
function select(id) { S.sel = id; render(); renderInspector(); }
function selected() { return els().find(e => e.id === S.sel); }

function renderLayers() {
  const box = $('elList'); if (!box) return;
  box.innerHTML = '';
  els().slice().reverse().forEach(el => {
    const row = document.createElement('div');
    row.className = 'el-item' + (S.sel === el.id ? ' active' : '');
    const label = el.bind !== 'none' ? '{' + el.bind + '}' : (el.text || el.type);
    row.innerHTML = '<span class="ty">' + el.type + '</span><span class="nm"></span>' +
      '<span class="lk' + (el.locked ? ' on' : '') + '">' + (el.locked ? '🔒' : '🔓') + '</span>' +
      '<span class="lk' + (el.hidden ? '' : ' on') + '">' + (el.hidden ? '○' : '●') + '</span>';
    row.querySelector('.nm').textContent = String(label).slice(0, 26);
    const locks = row.querySelectorAll('.lk');
    locks[0].onclick = ev => { ev.stopPropagation(); el.locked = !el.locked; commit(); render(); };
    locks[1].onclick = ev => { ev.stopPropagation(); el.hidden = !el.hidden; commit(); render(); };
    row.onclick = () => select(el.id);
    box.appendChild(row);
  });
}

function insField(label, key, type, opts) {
  const el = selected();
  const v = el[key];
  let inner;
  if (type === 'select') {
    inner = '<select data-k="' + key + '">' + opts.map(o =>
      '<option value="' + o[0] + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
  } else if (type === 'color') {
    inner = '<input type="color" data-k="' + key + '" value="' + (v === 'accent' ? S.accent : v) + '">';
  } else {
    inner = '<input type="' + type + '" data-k="' + key + '" value="' + String(v).replace(/"/g, '&quot;') + '"' +
      (opts && opts.step ? ' step="' + opts.step + '"' : '') + '>';
  }
  return '<div class="field"><label>' + label + '</label>' + inner + '</div>';
}

function renderInspector() {
  const box = $('inspector');
  const el = selected();
  if (!el) { box.innerHTML = '<p class="hint">Select an element on the card.</p>'; return; }
  const isText = ['text', 'label', 'mono', 'signature'].includes(el.type);
  let html = '<div class="insp-head">' + el.type + ' · ' + el.id + '</div>';

  if (isText) {
    html += insField('Bind to field', 'bind', 'select', FIELDS);
    if (el.bind === 'none') html += insField('Text (use {name}, {id}…)', 'text', 'text');
    html += '<div class="row2">' + insField('Font', 'font', 'select', [['display', 'Fraunces'], ['sans', 'Inter'], ['mono', 'JetBrains'], ['tech', 'Rajdhani'], ['condensed', 'Oswald']]) +
      insField('Weight', 'weight', 'select', [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Black']]) + '</div>';
    html += '<div class="row2">' + insField('Size %', 'fs', 'number', { step: '0.2' }) + insField('Letter space', 'ls', 'number', { step: '1' }) + '</div>';
    html += insField('Colour', 'color', 'color');
    html += '<div class="field"><label>Use accent colour</label><button class="btn btn-ghost btn-sm" data-act="accentcolor">Set to accent</button></div>';
    html += '<div class="field"><label>Align</label><div class="align-seg">' +
      ['left', 'center', 'right'].map(a => '<button data-align="' + a + '" class="' + (el.align === a ? 'active' : '') + '">' + a + '</button>').join('') + '</div></div>';
    html += '<label class="tb-check"><input type="checkbox" data-k="caps"' + (el.caps ? ' checked' : '') + '> UPPERCASE</label>';
  }
  if (el.type === 'qr' || el.type === 'barcode') {
    html += insField('Encoded data', 'qrData', 'text');
    html += '<p class="hint">Use placeholders: {id} {name} {org} {phone} — or a full URL.</p>';
  }
  if (el.type === 'shape' || el.type === 'line' || el.type === 'signature') {
    html += insField('Fill colour', 'fill', 'color');
    html += '<div class="field"><button class="btn btn-ghost btn-sm" data-act="accentfill">Set fill to accent</button></div>';
  }
  if (['photo', 'logo', 'shape'].includes(el.type)) html += insField('Corner radius %', 'radius', 'number', { step: '0.5' });

  html += '<div class="field"><label>Position &amp; size (%)</label><div class="mini4">' +
    '<input type="number" data-k="x" value="' + el.x + '" step="0.5" title="x">' +
    '<input type="number" data-k="y" value="' + el.y + '" step="0.5" title="y">' +
    '<input type="number" data-k="w" value="' + el.w + '" step="0.5" title="w">' +
    '<input type="number" data-k="h" value="' + el.h + '" step="0.5" title="h">' +
    '</div></div>';
  html += '<div class="row2">' + insField('Opacity %', 'opacity', 'number', { step: '5' }) + insField('Rotation °', 'rot', 'number', { step: '1' }) + '</div>';
  box.innerHTML = html;

  box.querySelectorAll('[data-k]').forEach(inp => {
    const k = inp.dataset.k;
    const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' || inp.type === 'color' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const e2 = selected(); if (!e2) return;
      if (inp.type === 'checkbox') e2[k] = inp.checked;
      else if (inp.type === 'number') e2[k] = parseFloat(inp.value) || 0;
      else e2[k] = inp.value;
      render();
      if (k === 'bind') renderInspector();
      debounceCommit();
    });
  });
  box.querySelectorAll('[data-align]').forEach(b => b.onclick = () => {
    const e2 = selected(); e2.align = b.dataset.align; renderInspector(); render(); commit();
  });
  const ac = box.querySelector('[data-act="accentcolor"]');
  if (ac) ac.onclick = () => { selected().color = 'accent'; render(); renderInspector(); commit(); };
  const af = box.querySelector('[data-act="accentfill"]');
  if (af) af.onclick = () => { selected().fill = 'accent'; render(); renderInspector(); commit(); };
}

/* ─────────────── history ─────────────── */
function snapshot() {
  return JSON.stringify({ front: S.front, back: S.back, bg: S.bg, accent: S.accent, orient: S.orient });
}
function commit() {
  if (S.quiet) return;
  const snap = snapshot();
  if (S.history[S.hIdx] === snap) return;
  S.history = S.history.slice(0, S.hIdx + 1);
  S.history.push(snap);
  if (S.history.length > 60) S.history.shift();
  S.hIdx = S.history.length - 1;
}
let cT = null;
function debounceCommit() { clearTimeout(cT); cT = setTimeout(commit, 500); }
function restore(snap) {
  const o = JSON.parse(snap);
  S.front = o.front; S.back = o.back; S.bg = o.bg; S.accent = o.accent; S.orient = o.orient;
  $('dAccent').value = S.accent;
  syncBgInputs();
  render(); renderInspector();
}
function undo() { if (S.hIdx > 0) { S.hIdx--; restore(S.history[S.hIdx]); } }
function redo() { if (S.hIdx < S.history.length - 1) { S.hIdx++; restore(S.history[S.hIdx]); } }

/* ─────────────── templates UI ─────────────── */
function loadTemplate(key) {
  const t = TEMPLATES[key]; if (!t) return;
  S.quiet = true;
  S.front = JSON.parse(JSON.stringify(t.front));
  S.back = JSON.parse(JSON.stringify(t.back));
  S.accent = t.accent;
  S.bg = Object.assign({ type: 'gradient', c1: '#152030', c2: '#0b1118', angle: 135, imageUrl: S.bg.imageUrl, opacity: 100, bar: 4, sheen: true }, t.bg);
  $('dAccent').value = S.accent;
  syncBgInputs();
  S.sel = null;
  S.quiet = false;
  commit(); render(); renderInspector();
  AA.toast('Template loaded — ' + t.name, 'ok');
}
function buildTemplateGrid(cat) {
  const g = $('tplGrid'); g.innerHTML = '';
  Object.entries(TEMPLATES).forEach(([k, t]) => {
    if (cat !== 'all' && t.cat !== cat) return;
    const b = document.createElement('button');
    b.className = 'tpl'; b.dataset.tpl = k;
    b.innerHTML = '<span></span><small></small>';
    b.querySelector('span').textContent = t.name;
    b.querySelector('small').textContent = t.sub;
    b.onclick = () => {
      g.querySelectorAll('.tpl').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); loadTemplate(k);
    };
    g.appendChild(b);
  });
}

/* ─────────────── add / edit elements ─────────────── */
function addElement(type) {
  const base = { text: 'New text', bind: 'none' };
  let el;
  if (type === 'text') el = T('text', 8, 40, 55, 12, Object.assign({ fs: 11, font: 'display' }, base));
  else if (type === 'label') el = T('label', 8, 12, 40, 7, { text: 'LABEL', fs: 5, weight: 700, ls: 12, color: 'accent', caps: true });
  else if (type === 'mono') el = T('mono', 8, 60, 45, 7, { text: 'mono line', fs: 5.5, font: 'mono', color: '#b9b3a5' });
  else if (type === 'photo') el = T('photo', 68, 20, 26, 50, { radius: 3 });
  else if (type === 'logo') el = T('logo', 6, 6, 14, 14, {});
  else if (type === 'qr') el = T('qr', 74, 62, 18, 28, { qrData: '{id}' });
  else if (type === 'barcode') el = T('barcode', 8, 76, 55, 16, { qrData: '{id}' });
  else if (type === 'shape') el = T('shape', 8, 20, 40, 20, { fill: 'accent', opacity: 25, radius: 3 });
  else if (type === 'line') el = T('line', 8, 55, 60, 0.7, { fill: 'accent' });
  else if (type === 'signature') el = T('signature', 8, 70, 45, 12, { text: 'Authorised signature', fs: 4.6, fill: '#8a8780' });
  else return;
  els().push(el);
  select(el.id); commit();
}

/* ─────────────── printers / pricing ─────────────── */
function printer() { return S.printers.find(p => p.id === S.printerId) || S.printers[0]; }

async function loadPrinters() {
  try { S.printers = await AA.api('/api/print/printers'); } catch (e) { S.printers = []; }
  const sel = $('printerSel'); sel.innerHTML = '';
  S.printers.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.brand + ' ' + p.model + (p.owned ? ' · in-house' : '');
    sel.appendChild(o);
  });
  sel.value = S.printerId;
  updatePrinterNote();

  const grid = $('printerGrid');
  if (grid) {
    grid.innerHTML = '';
    S.printers.forEach(p => {
      const d = document.createElement('div');
      d.className = 'pcard reveal';
      d.innerHTML = '<div class="brand"></div><div class="model"></div><div class="specs">' +
        '<span class="pill cy">' + p.dpi + ' dpi</span>' +
        '<span class="pill">' + p.ribbon + '</span>' +
        (p.duplex ? '<span class="pill ok">duplex</span>' : '') +
        (p.magstripe ? '<span class="pill">magstripe</span>' : '') +
        (p.rfid ? '<span class="pill">RFID</span>' : '') +
        (p.owned ? '<span class="pill hot">in-house</span>' : '') +
        '</div><p class="nt"></p>';
      d.querySelector('.brand').textContent = p.brand;
      d.querySelector('.model').textContent = p.model;
      d.querySelector('.nt').textContent = p.notes || '';
      grid.appendChild(d);
    });
    AA.initReveal();
  }
}
function updatePrinterNote() {
  const p = printer();
  $('printerNote').textContent = p
    ? p.brand + ' ' + p.model + ' · ' + p.dpi + ' dpi · bleed ' + p.bleedMm + ' mm · ' + (p.duplex ? 'duplex capable' : 'single side only')
    : 'No printer profile loaded.';
}

async function loadPricing() {
  try { S.pricing = await AA.api('/api/print/pricing'); } catch (e) { return; }
  const box = $('qOptions'); box.innerHTML = '';
  (S.pricing.options || []).forEach(o => {
    const lab = document.createElement('label');
    lab.className = 'opt-chk';
    lab.innerHTML = '<input type="checkbox" value="' + o.id + '"><span></span>';
    lab.querySelector('span').textContent = o.label + ' +' + o.price;
    lab.querySelector('input').addEventListener('change', e => {
      lab.classList.toggle('on', e.target.checked); refreshQuote();
    });
    box.appendChild(lab);
  });
  refreshQuote();
}
function chosenOptions() {
  return Array.from(document.querySelectorAll('#qOptions input:checked')).map(i => i.value);
}
let lastQuote = null;
async function refreshQuote() {
  try {
    const q = await AA.api('/api/print/quote', {
      method: 'POST',
      body: { qty: $('qQty').value, sides: S.sides, options: chosenOptions(), newDesign: $('qNew').value === 'yes' }
    });
    lastQuote = q;
    const sy = q.symbol || '';
    $('quoteBox').innerHTML =
      'Quantity      <b>' + q.qty + '</b> cards (' + q.tier + ')\n' +
      'Sides         ' + (q.sides === 'double' ? 'double' : 'single') + '\n' +
      'Rate / card   <b>' + sy + ' ' + q.unit + '</b>' + (q.discountPercent ? '  (−' + q.discountPercent + '%)' : '') + '\n' +
      'Cards         ' + sy + ' ' + q.cards.toLocaleString() + '\n' +
      (q.designFee ? 'Design fee    ' + sy + ' ' + q.designFee + '\n' : '') +
      (q.vat ? 'VAT ' + q.vatPercent + '%       ' + sy + ' ' + q.vat.toLocaleString() + '\n' : '') +
      '<span class="quote-total">TOTAL         ' + sy + ' ' + q.total.toLocaleString() + '</span>';
  } catch (e) { $('quoteBox').textContent = 'Quote unavailable — ' + e.message; }
}
function quoteText() {
  if (!lastQuote) return 'aaomsPrint quotation';
  const q = lastQuote, sy = q.symbol || '';
  return 'aaomsPrint — ID card quotation\n\n' +
    'Quantity: ' + q.qty + ' cards\nSides: ' + q.sides + '\nRate/card: ' + sy + ' ' + q.unit +
    (q.options.length ? '\nExtras: ' + q.options.map(o => o.label).join(', ') : '') +
    (q.designFee ? '\nDesign fee: ' + sy + ' ' + q.designFee : '') +
    (q.vat ? '\nVAT ' + q.vatPercent + '%: ' + sy + ' ' + q.vat : '') +
    '\nTOTAL: ' + sy + ' ' + q.total +
    '\n\naaomsPrint · AAOMS Nepal';
}

/* ─────────────── export ─────────────── */
function exportCanvas(side, dpi, dataOverride, photoOverride) {
  const p = printer();
  const bleed = S.bleed ? (p ? p.bleedMm : 1) : 0;
  const mmW = (S.orient === 'h' ? CARD_MM.w : CARD_MM.h) + bleed * 2;
  const mmH = (S.orient === 'h' ? CARD_MM.h : CARD_MM.w) + bleed * 2;
  const W = Math.round(mmW / 25.4 * dpi), H = Math.round(mmH / 25.4 * dpi);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  // Per-printer registration offset (mm, set in the printer profile) was
  // stored but never applied — every export ignored it. Convert to px at
  // the export dpi and shift the artwork before drawing.
  const offX = p && p.offsetX ? Math.round(p.offsetX / 25.4 * dpi) : 0;
  const offY = p && p.offsetY ? Math.round(p.offsetY / 25.4 * dpi) : 0;
  if (offX || offY) ctx.translate(offX, offY);
  drawCard(ctx, W, H, side, { data: dataOverride, photoUrl: photoOverride });
  if (offX || offY) ctx.translate(-offX, -offY);
  return c;
}
function download(dataUrl, name) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = name; a.click();
}
function fileBase() {
  return (readData().name || 'card').replace(/[^\w\-]+/g, '-').toLowerCase();
}
async function exportPNG(dpi) {
  await document.fonts.ready;
  const c = exportCanvas(S.side, dpi);
  download(c.toDataURL('image/png'), fileBase() + '-' + S.side + '-' + dpi + 'dpi.png');
  AA.toast('PNG exported at ' + dpi + ' dpi', 'ok');
}
async function exportBothPNG() {
  await document.fonts.ready;
  download(exportCanvas('front', 300).toDataURL('image/png'), fileBase() + '-front.png');
  setTimeout(() => download(exportCanvas('back', 300).toDataURL('image/png'), fileBase() + '-back.png'), 400);
  AA.toast('Front and back exported', 'ok');
}
async function exportPDF() {
  if (!window.jspdf) { AA.toast('PDF library not loaded', 'err'); return; }
  await document.fonts.ready;
  const { jsPDF } = window.jspdf;
  const p = printer();
  const bleed = S.bleed ? (p ? p.bleedMm : 1) : 0;
  const mmW = (S.orient === 'h' ? CARD_MM.w : CARD_MM.h) + bleed * 2;
  const mmH = (S.orient === 'h' ? CARD_MM.h : CARD_MM.w) + bleed * 2;
  const doc = new jsPDF({ unit: 'mm', format: [mmW, mmH], orientation: mmW > mmH ? 'landscape' : 'portrait' });
  doc.addImage(exportCanvas('front', 600).toDataURL('image/png'), 'PNG', 0, 0, mmW, mmH);
  if (S.sides === 'double') {
    doc.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
    doc.addImage(exportCanvas('back', 600).toDataURL('image/png'), 'PNG', 0, 0, mmW, mmH);
  }
  doc.save(fileBase() + '-print.pdf');
  AA.toast('Print-ready PDF saved', 'ok');
}
async function printSheet() {
  await document.fonts.ready;
  const mmW = S.orient === 'h' ? CARD_MM.w : CARD_MM.h;
  const mmH = S.orient === 'h' ? CARD_MM.h : CARD_MM.w;
  const imgs = [exportCanvas('front', 600).toDataURL('image/png')];
  if (S.sides === 'double') imgs.push(exportCanvas('back', 600).toDataURL('image/png'));
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><title>aaomsPrint sheet</title><style>' +
    '@page{size:' + mmW + 'mm ' + mmH + 'mm;margin:0}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    'img{width:' + mmW + 'mm;height:' + mmH + 'mm;display:block;page-break-after:always}' +
    '</style></head><body>' + imgs.map(s => '<img src="' + s + '">').join('') +
    '<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>');
  w.document.close();
}

/* ─────────────── designs ─────────────── */
async function saveDesign() {
  const name = $('dsgName').value.trim();
  if (!name) { AA.toast('Give the design a name first', 'err'); return; }
  try {
    await AA.api('/api/print/designs', {
      method: 'POST',
      body: { name, orient: S.orient, accent: S.accent, bg: S.bg, front: S.front, back: S.back, meta: { data: readData() } }
    });
    AA.toast('Design saved', 'ok');
    listDesigns();
  } catch (e) { AA.toast(e.message, 'err'); }
}
async function listDesigns() {
  const box = $('dsgList'); if (!box) return;
  try {
    const list = await AA.api('/api/print/designs');
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<p class="hint">No saved designs yet.</p>'; return; }
    list.forEach(d => {
      const r = document.createElement('div');
      r.className = 'dsg-row';
      r.innerHTML = '<span class="nm"></span><span class="pill">' + (d.orient === 'h' ? 'land' : 'port') + '</span>';
      r.querySelector('.nm').textContent = d.name;
      r.querySelector('.nm').onclick = () => openDesign(d.id);
      box.appendChild(r);
    });
  } catch (e) { box.innerHTML = '<p class="hint">Could not load designs.</p>'; }
}
async function openDesign(id) {
  try {
    const d = await AA.api('/api/print/designs/' + id);
    S.quiet = true;
    S.front = d.front || []; S.back = d.back || [];
    S.bg = Object.assign(S.bg, d.bg || {}); S.accent = d.accent || S.accent;
    setOrient(d.orient || 'h');
    $('dAccent').value = S.accent; $('dsgName').value = d.name;
    syncBgInputs();
    S.quiet = false; commit(); render(); renderInspector();
    AA.toast('Loaded — ' + d.name, 'ok');
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ─────────────── CSV batch ─────────────── */
let csvRows = [], csvHeaders = [], batchCards = [];
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
function loadCSVText(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) { AA.toast('CSV needs a header row plus at least one data row', 'err'); return; }
  csvHeaders = rows[0].map(h => h.trim());
  csvRows = rows.slice(1).map(r => {
    const o = {}; csvHeaders.forEach((h, i) => o[h] = (r[i] || '').trim()); return o;
  });
  buildMapUI();
  $('csvMapWrap').classList.remove('hide');
  logBatch(csvRows.length + ' rows loaded · columns: ' + csvHeaders.join(', '));
}
function buildMapUI() {
  const box = $('csvMap'); box.innerHTML = '';
  FIELDS.filter(f => f[0] !== 'none').forEach(([key, label]) => {
    const auto = csvHeaders.find(h => h.toLowerCase().replace(/[^a-z]/g, '') === key) ||
      csvHeaders.find(h => h.toLowerCase().includes(key));
    const d = document.createElement('div');
    d.className = 'field';
    d.innerHTML = '<label>' + label + '</label><select data-field="' + key + '"><option value="">— not used —</option>' +
      csvHeaders.map(h => '<option value="' + h + '"' + (h === auto ? ' selected' : '') + '>' + h + '</option>').join('') + '</select>';
    box.appendChild(d);
  });
}
function rowToData(row) {
  const base = readData();
  const out = Object.assign({}, base);
  document.querySelectorAll('#csvMap select').forEach(s => {
    if (s.value) out[s.dataset.field] = row[s.value] || '';
  });
  // a column literally called photo / image may hold a URL per person
  const ph = csvHeaders.find(h => /^(photo|image|picture)$/i.test(h));
  if (ph && row[ph]) out.__photo = row[ph];
  return out;
}
function logBatch(msg) {
  const b = $('batchLog');
  b.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n' + b.textContent.slice(0, 1200);
}
async function batchPreview() {
  await document.fonts.ready;
  batchCards = [];
  const strip = $('batchStrip'); strip.innerHTML = '';
  const max = Math.min(csvRows.length, 40);
  for (let i = 0; i < max; i++) {
    const data = rowToData(csvRows[i]);
    const c = exportCanvas('front', 150, data);
    const url = c.toDataURL('image/png');
    batchCards.push({ data, url });
    const img = new Image(); img.src = url; strip.appendChild(img);
  }
  logBatch('Previewed ' + max + ' of ' + csvRows.length + ' cards');
}
async function batchZip() {
  if (!window.JSZip) { AA.toast('ZIP library not loaded', 'err'); return; }
  await document.fonts.ready;
  const zip = new JSZip();
  const folder = zip.folder('aaomsPrint-cards');
  logBatch('Rendering ' + csvRows.length + ' cards at 300 dpi…');
  for (let i = 0; i < csvRows.length; i++) {
    const data = rowToData(csvRows[i]);
    const nm = (data.name || ('card-' + (i + 1))).replace(/[^\w\-]+/g, '-').toLowerCase();
    folder.file(nm + '-front.png', exportCanvas('front', 300, data).toDataURL('image/png').split(',')[1], { base64: true });
    if (S.sides === 'double')
      folder.file(nm + '-back.png', exportCanvas('back', 300, data).toDataURL('image/png').split(',')[1], { base64: true });
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'aaomsPrint-batch.zip'; a.click();
  logBatch('ZIP ready — ' + csvRows.length + ' cards');
  AA.toast('Batch ZIP downloaded', 'ok');
}
async function batchPDF() {
  if (!window.jspdf) { AA.toast('PDF library not loaded', 'err'); return; }
  await document.fonts.ready;
  const { jsPDF } = window.jspdf;
  const mmW = S.orient === 'h' ? CARD_MM.w : CARD_MM.h;
  const mmH = S.orient === 'h' ? CARD_MM.h : CARD_MM.w;
  const doc = new jsPDF({ unit: 'mm', format: [mmW, mmH], orientation: mmW > mmH ? 'landscape' : 'portrait' });
  for (let i = 0; i < csvRows.length; i++) {
    const data = rowToData(csvRows[i]);
    if (i > 0) doc.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
    doc.addImage(exportCanvas('front', 300, data).toDataURL('image/png'), 'PNG', 0, 0, mmW, mmH);
    if (S.sides === 'double') {
      doc.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
      doc.addImage(exportCanvas('back', 300, data).toDataURL('image/png'), 'PNG', 0, 0, mmW, mmH);
    }
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }
  doc.save('aaomsPrint-batch.pdf');
  logBatch('PDF ready — ' + csvRows.length + ' cards');
}
async function batchJob() {
  if (!csvRows.length) { AA.toast('Load a CSV first', 'err'); return; }
  const rows = csvRows.map(rowToData);
  await submitJob({ qty: rows.length, rows, title: ($('jTitle').value || 'Batch card job') + ' (' + rows.length + ')' });
}

/* ─────────────── jobs ─────────────── */
async function submitJob(extra) {
  await document.fonts.ready;
  const preview = exportCanvas('front', 100).toDataURL('image/jpeg', 0.7);
  const body = Object.assign({
    title: $('jTitle').value || 'ID card job',
    clientName: $('jClient').value, contact: $('jContact').value,
    phone: $('jPhone').value, email: $('jEmail').value,
    notes: $('jNotes').value, qty: parseInt($('qQty').value, 10) || 1,
    sides: S.sides, options: chosenOptions(), printerId: S.printerId,
    designName: $('dsgName').value, newDesign: $('qNew').value === 'yes',
    preview
  }, extra || {});
  try {
    const r = await AA.api('/api/print/jobs', { method: 'POST', body });
    $('jobResult').textContent = 'Job created · code ' + r.code + '\nTotal ' + (r.quote.symbol || '') + ' ' + r.quote.total.toLocaleString();
    AA.toast('Job ' + r.code + ' sent to the queue', 'ok');
  } catch (e) { AA.toast(e.message, 'err'); }
}

/* ─────────────── bg inputs ─────────────── */
function syncBgInputs() {
  $('bgType').value = S.bg.type;
  $('bgC1').value = S.bg.c1; $('bgC2').value = S.bg.c2;
  $('bgAngle').value = S.bg.angle; $('bgAngVal').textContent = S.bg.angle + '°';
  $('bgOpacity').value = S.bg.opacity == null ? 100 : S.bg.opacity;
  $('bgBar').value = S.bg.bar == null ? 4 : S.bg.bar;
  $('bgSheen').checked = !!S.bg.sheen;
}

/* ─────────────── orientation / side ─────────────── */
function setOrient(o) {
  S.orient = o;
  document.querySelectorAll('[data-orient]').forEach(b => b.classList.toggle('active', b.dataset.orient === o));
  render();
}
function setSide(s) {
  S.side = s; S.sel = null;
  document.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('active', b.dataset.side === s));
  render(); renderInspector();
}

/* ─────────────── uploads ─────────────── */
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function handleUpload(input, apply) {
  const f = input.files && input.files[0];
  if (!f) return;
  const dataUrl = await fileToDataUrl(f);
  apply(dataUrl);
  render();
  try {
    const r = await AA.api('/api/print/upload', { method: 'POST', body: { dataUrl } });
    apply(r.url); render();
  } catch (e) { /* keep the local data URL */ }
}

/* ─────────────── wiring ─────────────── */
function wire() {
  document.querySelectorAll('.blk-h').forEach(h => h.onclick = () => {
    const b = h.parentElement;
    b.dataset.open = b.dataset.open === '1' ? '0' : '1';
  });

  document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => setSide(b.dataset.side));
  const other = $('stageOther');
  if (other) other.addEventListener('click', () => setSide(S.side === 'front' ? 'back' : 'front'));
  document.querySelectorAll('[data-orient]').forEach(b => b.onclick = () => { setOrient(b.dataset.orient); commit(); });
  document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addElement(b.dataset.add));

  $('zoom').addEventListener('input', e => { S.zoom = +e.target.value; $('zoomVal').textContent = S.zoom + '%'; render(); });
  ['optSnap:snap', 'optGuides:guides', 'optBleed:bleed', 'optGrid:grid'].forEach(pair => {
    const [id, key] = pair.split(':');
    $(id).addEventListener('change', e => { S[key] = e.target.checked; render(); });
  });

  ['dOrg', 'dSub', 'dName', 'dRole', 'dId', 'dDept', 'dBlood', 'dValid', 'dPhone', 'dEmail', 'dAddr', 'dC1', 'dC2']
    .forEach(id => $(id).addEventListener('input', render));
  $('dAccent').addEventListener('input', e => { S.accent = e.target.value; render(); debounceCommit(); });
  $('dPhotoZoom').addEventListener('input', e => { S.photoZoom = +e.target.value; render(); });
  $('dPhoto').addEventListener('change', () => handleUpload($('dPhoto'), u => S.photoUrl = u));
  $('dLogo').addEventListener('change', () => handleUpload($('dLogo'), u => S.logoUrl = u));
  $('btnClearPhoto').onclick = () => { S.photoUrl = null; $('dPhoto').value = ''; render(); };
  $('btnClearLogo').onclick = () => { S.logoUrl = null; $('dLogo').value = ''; render(); };

  $('bgType').addEventListener('change', e => { S.bg.type = e.target.value; render(); commit(); });
  $('bgC1').addEventListener('input', e => { S.bg.c1 = e.target.value; render(); debounceCommit(); });
  $('bgC2').addEventListener('input', e => { S.bg.c2 = e.target.value; render(); debounceCommit(); });
  $('bgAngle').addEventListener('input', e => { S.bg.angle = +e.target.value; $('bgAngVal').textContent = S.bg.angle + '°'; render(); });
  $('bgOpacity').addEventListener('input', e => { S.bg.opacity = +e.target.value; render(); });
  $('bgBar').addEventListener('input', e => { S.bg.bar = +e.target.value; render(); });
  $('bgSheen').addEventListener('change', e => { S.bg.sheen = e.target.checked; render(); commit(); });
  $('bgImage').addEventListener('change', () => handleUpload($('bgImage'), u => { S.bg.imageUrl = u; S.bg.type = 'image'; $('bgType').value = 'image'; }));

  document.querySelectorAll('.tfx').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tfx').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); buildTemplateGrid(b.dataset.cat);
  });

  $('btnUndo').onclick = undo;
  $('btnRedo').onclick = redo;
  $('btnDup').onclick = () => {
    const el = selected(); if (!el) return;
    const c = JSON.parse(JSON.stringify(el));
    c.id = uid(c.type); c.x = clamp(c.x + 3, 0, 95); c.y = clamp(c.y + 3, 0, 95);
    els().push(c); select(c.id); commit();
  };
  $('btnDel').onclick = () => {
    const el = selected(); if (!el) return;
    const arr = els(); arr.splice(arr.indexOf(el), 1);
    S.sel = null; commit(); render(); renderInspector();
  };
  $('btnUp').onclick = () => {
    const arr = els(), el = selected(); if (!el) return;
    const i = arr.indexOf(el); if (i < arr.length - 1) { arr.splice(i, 1); arr.splice(i + 1, 0, el); commit(); render(); }
  };
  $('btnDown').onclick = () => {
    const arr = els(), el = selected(); if (!el) return;
    const i = arr.indexOf(el); if (i > 0) { arr.splice(i, 1); arr.splice(i - 1, 0, el); commit(); render(); }
  };

  $('printerSel').addEventListener('change', e => { S.printerId = e.target.value; updatePrinterNote(); render(); });
  $('sidesSel').addEventListener('change', e => { S.sides = e.target.value; refreshQuote(); });

  $('btnPng300').onclick = () => exportPNG(300);
  $('btnPng600').onclick = () => exportPNG(600);
  $('btnBothSides').onclick = exportBothPNG;
  $('btnPdf').onclick = exportPDF;
  $('btnSheet').onclick = printSheet;

  $('btnSaveDesign').onclick = saveDesign;
  $('btnExportJson').onclick = () => {
    const blob = new Blob([JSON.stringify({ name: $('dsgName').value || 'design', orient: S.orient, accent: S.accent, bg: S.bg, front: S.front, back: S.back }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = ($('dsgName').value || 'design') + '.json'; a.click();
  };
  $('btnImportJson').onclick = () => $('jsonFile').click();
  $('jsonFile').addEventListener('change', async () => {
    const f = $('jsonFile').files[0]; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      S.quiet = true;
      S.front = o.front || []; S.back = o.back || [];
      S.bg = Object.assign(S.bg, o.bg || {}); S.accent = o.accent || S.accent;
      setOrient(o.orient || 'h'); $('dAccent').value = S.accent;
      syncBgInputs(); S.quiet = false; commit(); render();
      AA.toast('Design imported', 'ok');
    } catch (e) { AA.toast('Bad JSON file', 'err'); }
  });

  $('qQty').addEventListener('input', refreshQuote);
  $('qNew').addEventListener('change', refreshQuote);
  $('btnQuoteWa').onclick = () => window.open('https://wa.me/9779803840868?text=' + encodeURIComponent(quoteText()), '_blank');
  $('btnQuoteMail').onclick = () => { window.location.href = 'mailto:aaomsnepal@gmail.com?subject=' + encodeURIComponent('aaomsPrint quotation') + '&body=' + encodeURIComponent(quoteText()); };

  $('btnSubmitJob').onclick = () => submitJob();
  $('btnTrack').onclick = async () => {
    const code = $('trackCode').value.trim();
    if (!code) return;
    try {
      const r = await AA.api('/api/print/track/' + encodeURIComponent(code));
      $('trackOut').textContent = r.code + ' · ' + r.title + '\n' + r.qty + ' cards · status: ' + r.status.toUpperCase();
    } catch (e) { $('trackOut').textContent = e.message; }
  };

  $('csvFile').addEventListener('change', async () => {
    const f = $('csvFile').files[0]; if (!f) return;
    loadCSVText(await f.text());
  });
  $('btnCsvPaste').onclick = () => {
    const t = $('csvPaste');
    t.classList.toggle('hide');
    if (!t.classList.contains('hide')) {
      t.oninput = () => { if (t.value.includes('\n')) loadCSVText(t.value); };
    }
  };
  $('btnCsvSample').onclick = () => {
    const csv = 'name,role,id,department,blood,valid,phone\n' +
      'Sita Sharma,Staff Nurse,NP-2026-0142,Emergency,O+,2027-12-31,+977 9800000001\n' +
      'Ram Thapa,Lab Technician,NP-2026-0143,Pathology,B+,2027-12-31,+977 9800000002\n' +
      'Gita Karki,Receptionist,NP-2026-0144,Front Desk,A+,2027-12-31,+977 9800000003\n';
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'aaomsprint-sample.csv'; a.click();
  };
  $('btnBatchPreview').onclick = batchPreview;
  $('btnBatchZip').onclick = batchZip;
  $('btnBatchPdf').onclick = batchPDF;
  $('btnBatchJob').onclick = batchJob;

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    const el = selected();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); $('btnDup').click(); return; }
    if (!el) return;
    const step = e.shiftKey ? 2 : 0.5;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('btnDel').click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); el.x = clamp(el.x - step, -5, 105); render(); debounceCommit(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); el.x = clamp(el.x + step, -5, 105); render(); debounceCommit(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); el.y = clamp(el.y - step, -5, 105); render(); debounceCommit(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); el.y = clamp(el.y + step, -5, 105); render(); debounceCommit(); }
  });

  window.addEventListener('resize', () => render());
  document.fonts && document.fonts.ready.then(() => render());
}

/* ─────────────── boot ─────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  wire();
  buildTemplateGrid('all');
  S.logoUrl = '/assets/logo-infinity.png';
  await loadPrinters();
  await loadPricing();
  loadTemplate('hospital-staff');
  const first = document.querySelector('.tpl'); if (first) first.classList.add('active');
  setSide('front'); setOrient('h');
  listDesigns();
  render();
});

window.AAPRINT = { S, render, drawCard, exportCanvas, TEMPLATES };
})();
