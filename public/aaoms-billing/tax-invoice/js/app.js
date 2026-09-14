import hospitalsData from './hospitals.js';

const EMAILJS_SERVICE_ID = "service_03qseph";
const EMAILJS_TEMPLATE_ID = "template_invoice";
const VAT_RATE = 0.13;

window.currentDocMode = "tax";

window.currentInvoice = {
  invoiceNo: "INV-" + Math.floor(1000 + Math.random() * 9000),
  date: new Date().toISOString().split('T')[0],
  hospitalName: "",
  hospitalEmail: "",
  hospitalPhone: "",
  taxableSubtotal: 0.00,
  vatAmount: 0.00,
  grandTotal: 0.00
};

window.productCatalog = [
  { id: "MW-01", name: "Surgical Scrub Set (Autoclavable Fabric)", unitPrice: 1800 },
  { id: "MW-02", name: "Doctor Lab Coat (Anti-Microbial Fabric)", unitPrice: 1500 },
  { id: "MW-03", name: "Hospital Bed Sheet & Pillowcase Set", unitPrice: 950 },
  { id: "SI-01", name: "Maxillofacial Surgical Tool Kit (ISO Standard)", unitPrice: 45000 },
  { id: "SI-02", name: "Sterile OT Surgical Drapes Set", unitPrice: 650 },
  { id: "HA-01", name: "Stainless Steel Instrument Trolley", unitPrice: 12500 },
  { id: "HA-02", name: "Adjustable IV Stand (Heavy Duty)", unitPrice: 3200 }
];

window.switchDocumentMode = function(mode) {
  window.currentDocMode = mode;
  const tenderGroup = document.getElementById("tender-fields-group");
  const sectionTitle = document.getElementById("section-title");

  if (mode === "tender") {
    if (tenderGroup) tenderGroup.style.display = "block";
    if (sectionTitle) sectionTitle.innerText = "Government Tender Bidding Proposal (e-GP)";
  } else {
    if (tenderGroup) tenderGroup.style.display = "none";
    if (sectionTitle) sectionTitle.innerText = "Tax Invoice & Quotation Generator";
  }
};

window.loadHospitals = function() {
  const select = document.getElementById("hospital-select");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Hospital --</option>';
  hospitalsData.forEach((hosp, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.innerText = `${hosp.name} (${hosp.address})`;
    select.appendChild(opt);
  });
};

window.onHospitalSelect = function(index) {
  if (index === "") return;
  const selected = hospitalsData[index];
  window.currentInvoice.hospitalName = selected.name;
  window.currentInvoice.hospitalEmail = selected.email;
  window.currentInvoice.hospitalPhone = selected.phone;

  document.getElementById("hospital-email-display").value = selected.email || "";
  document.getElementById("hospital-phone-display").value = selected.phone || "";
};

window.autoFillCatalogItem = function(productId) {
  const selected = window.productCatalog.find(p => p.id === productId);
  if (!selected) return;

  document.getElementById("item-desc-input").value = selected.name;
  document.getElementById("item-price-input").value = selected.unitPrice;
  window.calculateNepalVAT();
};

window.calculateNepalVAT = function() {
  const qty = parseFloat(document.getElementById("item-qty-input").value) || 0;
  const price = parseFloat(document.getElementById("item-price-input").value) || 0;
  
  const total = qty * price;
  const vat = total * VAT_RATE;
  const grandTotal = total + vat;

  window.currentInvoice.taxableSubtotal = total;
  window.currentInvoice.vatAmount = vat;
  window.currentInvoice.grandTotal = grandTotal;

  document.getElementById("item-total-display").innerText = "NPR " + total.toFixed(2);
  document.getElementById("subtotal-val").innerText = "NPR " + total.toFixed(2);
  document.getElementById("vat-val").innerText = "NPR " + vat.toFixed(2);
  document.getElementById("grandtotal-val").innerText = "NPR " + grandTotal.toFixed(2);

  const earnestInput = document.getElementById("earnest-money");
  if (earnestInput) {
    const bidSecurity = grandTotal * 0.025;
    earnestInput.value = "NPR " + bidSecurity.toFixed(2) + " (2.5%)";
  }
};

window.sendWhatsAppMessage = function() {
  if (!window.currentInvoice.hospitalPhone) {
    alert("Please select a target hospital/institution first.");
    return;
  }
  let phone = window.currentInvoice.hospitalPhone.replace(/[^0-9]/g, '');
  if (phone.length === 10) phone = "977" + phone;

  let msg = "";
  if (window.currentDocMode === "tender") {
    const tenderID = document.getElementById("tender-id").value || "N/A";
    const earnest = document.getElementById("earnest-money").value || "N/A";
    msg = `*AAOMS NEPAL - GOVERNMENT TENDER BID PROPOSAL*%0A` +
          `--------------------------------------------%0A` +
          `*Institution:* ${window.currentInvoice.hospitalName}%0A` +
          `*Tender ID:* ${tenderID}%0A` +
          `*Bid Security:* ${earnest}%0A` +
          `*Total Bid Amount:* NPR ${window.currentInvoice.grandTotal.toFixed(2)}%0A%0A` +
          `Visit our website: https://aaomsnepal.com`;
  } else {
    msg = `*AAOMS NEPAL - TAX INVOICE*%0A` +
          `-----------------------------------%0A` +
          `*Invoice No:* ${window.currentInvoice.invoiceNo}%0A` +
          `*Hospital:* ${window.currentInvoice.hospitalName}%0A` +
          `*Taxable Amount:* NPR ${window.currentInvoice.taxableSubtotal.toFixed(2)}%0A` +
          `*VAT (13%):* NPR ${window.currentInvoice.vatAmount.toFixed(2)}%0A` +
          `*Grand Total:* NPR ${window.currentInvoice.grandTotal.toFixed(2)}%0A%0A` +
          `Visit our website: https://aaomsnepal.com`;
  }

  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
};

window.sendDocumentEmail = function() {
  if (!window.currentInvoice.hospitalEmail) {
    alert("Please select a hospital with a valid email first.");
    return;
  }
  if (typeof emailjs === 'undefined') {
    alert("Email service didn't load (check your internet connection) — try again, or use the WhatsApp/Print options instead.");
    return;
  }

  const params = {
    to_email: window.currentInvoice.hospitalEmail,
    hospital_name: window.currentInvoice.hospitalName,
    invoice_no: window.currentInvoice.invoiceNo,
    total_amount: "NPR " + window.currentInvoice.grandTotal.toFixed(2)
  };

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
    .then(() => alert(`Successfully sent to ${window.currentInvoice.hospitalEmail}!`))
    .catch((err) => alert("Failed to send email. Ensure your EmailJS settings are complete."));
};

async function fetchNepalTaxNews() {
  const newsContainer = document.getElementById("tax-news-feed");
  try {
    const res = await fetch("https://api.rss2json.com/v1/api.json?rss_url=https://thehimalayantimes.com/rss/business");
    const data = await res.json();

    if (data.status === "ok" && data.items.length > 0) {
      newsContainer.innerHTML = "";
      data.items.slice(0, 5).forEach(item => {
        const card = document.createElement("div");
        card.className = "news-card";
        card.innerHTML = `
          <a href="${item.link}" target="_blank" class="news-title">${item.title}</a>
          <p class="news-date">📅 ${new Date(item.pubDate).toLocaleDateString("en-US")}</p>
        `;
        newsContainer.appendChild(card);
      });
    }
  } catch (err) {
    newsContainer.innerHTML = `
      <div class="news-card">
        <p class="news-title">IRD Nepal: Standard VAT Rate maintained at 13% for medical equipment imports and sales.</p>
        <p class="news-date">📅 IRD Nepal Compliant</p>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.loadHospitals();
  window.calculateNepalVAT();
  fetchNepalTaxNews();
});