/**
 * AAOMS Billing — Local data store
 * PIN: 6143
 * Fresh start (all counts at 0). Genuine Nepal VAT 13%.
 * Currency: Nepali Rupee रु
 */
const STORE_KEY = 'aaoms_billing_v2';
const PIN_KEY = 'aaoms_pin_ok';
const DEFAULT_PIN = '6143';

const defaultData = () => ({
  company: {
    name: 'AAOMS NEPAL',
    brand: 'aaoms',
    tagline: 'Wear Your Style',
    address: 'Bateshwor, Mahendra Nagar, Dhanusha, Nepal',
    regNo: '619165747',
    panVat: '',
    phone: '',
    email: ''
  },
  fiscalYear: '2083/84',
  pin: DEFAULT_PIN,
  customers: [],
  items: [],
  rawMaterials: [],
  purchases: [],
  invoices: [],
  payments: [],
  quotations: [],
  orders: [],
  challans: [],
  nextIds: {
    customer: 1, item: 1, raw: 1, purchase: 1,
    invoice: 1, payment: 1, quotation: 1, order: 1, challan: 1
  }
});

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const d = defaultData();
      save(d);
      return d;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(e);
    return defaultData();
  }
}

function save(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function isPinOk() {
  return localStorage.getItem(PIN_KEY) === 'true';
}

function setPinOk(ok) {
  if (ok) localStorage.setItem(PIN_KEY, 'true');
  else localStorage.removeItem(PIN_KEY);
}

/** Nepal Rupee — use रु (Devanagari) */
const fmt = (n) => {
  const num = Number(n) || 0;
  const s = num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return 'रु ' + s;
};

const today = () => new Date().toISOString().slice(0, 10);

const CATEGORIES = ['Fabric', 'Button', 'Thread', 'Machine', 'Parts', 'Packaging', 'Other'];

/** Nepal standard VAT rate (VAT Act 2052) — 13% for taxable supplies including garments */
const VAT_RATE = 0.13;

window.Store = { load, save, isPinOk, setPinOk, fmt, today, CATEGORIES, DEFAULT_PIN, VAT_RATE };
