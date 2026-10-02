/* ============================================================
   CAMPUS MARKET — dashboard.js (business dashboard)
   ============================================================ */

let CURRENT_BIZ = null;
let selectedLocations = [];

function guardBusinessSession() {
  const session = FMG.getSession();
  if (!session || session.type !== "business") {
    window.location.href = "index.html";
    return null;
  }
  const biz = FMG.businessById(session.id);
  if (!biz) { FMG.clearSession(); window.location.href = "index.html"; return null; }
  return biz;
}

function trialStatus(biz) {
  if (!biz.freeTrial) return { active: false, label: "Standard subscription", expired: false };
  const today = new Date();
  const end = new Date(biz.trialEndsAt);
  const active = today <= end;
  const daysLeft = Math.max(0, Math.ceil((end - today) / 86400000));
  return { active, expired: !active, label: active ? `Free trial · ${daysLeft} days left` : "Free trial ended", daysLeft };
}

function bizProducts() { return FMG.getProducts().filter(p => p.bizId === CURRENT_BIZ.id); }
function bizOrderLines() {
  const products = bizProducts();
  const ids = new Set(products.map(p => p.id));
  const lines = [];
  FMG.getOrders().forEach(order => {
    order.items.forEach(item => {
      if (ids.has(item.productId)) {
        const p = products.find(x => x.id === item.productId);
        const price = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
        lines.push({ orderId: order.id, date: order.createdAt, productName: p.name, qty: item.qty, revenue: price * item.qty, location: order.location });
      }
    });
  });
  return lines;
}

/* ---------- section switching ---------- */
function showSection(id) {
  document.querySelectorAll(".dash-section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".dash-nav a").forEach(a => a.classList.toggle("active", a.dataset.section === id));
  if (id === "sec-progression") renderProgressionChart();
  if (id === "sec-sales") renderSalesChart();
  if (id === "sec-locations") setTimeout(initMap, 50);
}

/* ---------- overview ---------- */
function renderOverview() {
  const products = bizProducts();
  const lines = bizOrderLines();
  const revenue = lines.reduce((s, l) => s + l.revenue, 0);
  const unitsSold = lines.reduce((s, l) => s + l.qty, 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  document.getElementById("kpiRevenue").textContent = money(revenue);
  document.getElementById("kpiProducts").textContent = products.length;
  document.getElementById("kpiUnits").textContent = unitsSold;
  document.getElementById("kpiLowStock").textContent = lowStock;

  const notes = fmgLoad("fmg_biz_notifications", []).filter(n => n.bizId === CURRENT_BIZ.id).slice(0, 6);
  document.getElementById("notificationList").innerHTML = notes.length
    ? notes.map(n => `<li>${n.message} <span style="color:rgba(33,26,22,0.5);font-size:0.76rem;">· ${new Date(n.at).toLocaleString()}</span></li>`).join("")
    : "<li>No notifications yet — they will appear here when shoppers add your products to cart.</li>";
}

/* ---------- products ---------- */
function renderProductsTable() {
  const products = bizProducts();
  const tbody = document.getElementById("productsTableBody");
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No products yet. Use "Upload product" to add your first listing.</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => {
    const badge = p.stock === 0 ? '<span class="badge-chip badge-out">Out of stock</span>' :
      (p.stock <= 5 ? '<span class="badge-chip badge-low">Low stock</span>' : '<span class="badge-chip badge-in">In stock</span>');
    return `<tr>
      <td><img src="${p.image}" alt="${p.name}" style="width:44px;height:44px;object-fit:cover;border-radius:3px;"></td>
      <td>${p.name}<br><span style="color:rgba(33,26,22,0.55);font-size:0.78rem;">${FMG.categoryById(p.category)?.label || p.category}</span></td>
      <td>${money(p.price)}${p.discount ? ` <span style="color:var(--navy);">(-${p.discount}%)</span>` : ""}</td>
      <td>${p.stock} ${badge}</td>
      <td>${p.views || 0}</td>
      <td>
        <button class="btn btn-outline-dark btn-sm" onclick="openProductForm('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBizProduct('${p.id}')">Delete</button>
      </td>
    </tr>`;
  }).join("");
}

function deleteBizProduct(id) {
  if (!confirm("Remove this product from your storefront?")) return;
  FMG.saveProducts(FMG.getProducts().filter(p => p.id !== id));
  renderProductsTable();
  renderOverview();
}

let editingProductId = null;
let pendingImageDataUrl = null;

function openProductForm(id) {
  editingProductId = id || null;
  pendingImageDataUrl = null;
  const p = id ? FMG.getProducts().find(x => x.id === id) : null;
  document.getElementById("productFormTitle").textContent = p ? "Edit product" : "Upload product";
  document.getElementById("pfName").value = p ? p.name : "";
  document.getElementById("pfCategory").value = p ? p.category : FMG.categories[0].id;
  document.getElementById("pfPrice").value = p ? p.price : "";
  document.getElementById("pfDiscount").value = p ? p.discount : 0;
  document.getElementById("pfStock").value = p ? p.stock : "";
  document.getElementById("pfDesc").value = p ? p.desc : "";
  document.getElementById("uploadPreview").src = p ? p.image : FMG.placeholder(FMG.categories[0].id, "New");
  document.getElementById("pfDeliveryEnabled").checked = p ? !!p.deliveryEnabled : false;
  renderDeliveryFeeInputs(p ? p.deliveryFees || {} : {});
  toggleDeliveryFeeInputs();
  document.getElementById("productFormOverlay").classList.remove("hidden");
}
function closeProductForm() { document.getElementById("productFormOverlay").classList.add("hidden"); }

// The fee list only offers the towns this business already ticked in "Delivery & pickup" (section 7.6),
// so a business can't promise a fee for a point it doesn't actually serve.
function renderDeliveryFeeInputs(existingFees) {
  const bizLocationIds = fmgLoad("fmg_biz_locations_" + CURRENT_BIZ.id, [CURRENT_BIZ.location]);
  const box = document.getElementById("deliveryFeeInputs");
  if (bizLocationIds.length === 0) {
    box.innerHTML = `<p class="form-note">You haven't selected any delivery/pickup towns yet — add some under "Delivery & pickup" first.</p>`;
    return;
  }
  box.innerHTML = bizLocationIds.map(locId => {
    const loc = FMG.locationById(locId);
    const fee = existingFees[locId] || 0;
    return `<div class="field-row" style="align-items:end;">
      <div class="field" style="margin-bottom:8px;"><label>${loc ? loc.label : locId}</label>
        <input type="number" min="0" max="${FMG.maxDeliveryFee}" step="500" class="pf-delivery-fee" data-loc="${locId}" value="${fee}">
      </div>
    </div>`;
  }).join("");
}

function toggleDeliveryFeeInputs() {
  document.getElementById("deliveryFeeSection").classList.toggle("hidden", !document.getElementById("pfDeliveryEnabled").checked);
}

function handleImageSelect(input) {
  const file = input.files[0];
  if (!file) return;
  // Resize/compress client-side so uploads never bloat the page or slow the site down.
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 700;
      let { width, height } = img;
      if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim; }
      else if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      pendingImageDataUrl = canvas.toDataURL("image/jpeg", 0.72);
      document.getElementById("uploadPreview").src = pendingImageDataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveProductForm() {
  const name = document.getElementById("pfName").value.trim();
  const category = document.getElementById("pfCategory").value;
  const price = Number(document.getElementById("pfPrice").value);
  const discount = Number(document.getElementById("pfDiscount").value) || 0;
  const stock = Number(document.getElementById("pfStock").value);
  const desc = document.getElementById("pfDesc").value.trim();
  const deliveryEnabled = document.getElementById("pfDeliveryEnabled").checked;
  const errEl = document.getElementById("productFormError");
  if (!name || !price || price <= 0 || isNaN(stock) || stock < 0) {
    errEl.textContent = "Please fill in a product name, a price above zero, and stock quantity.";
    errEl.classList.remove("hidden");
    return;
  }

  // Read the per-town delivery fees and hard-enforce the UGX 10,000 cap before saving anything.
  const deliveryFees = {};
  let feeError = "";
  document.querySelectorAll(".pf-delivery-fee").forEach(input => {
    const fee = Number(input.value) || 0;
    if (fee > FMG.maxDeliveryFee) feeError = `Delivery fee for ${input.closest(".field").querySelector("label").textContent} cannot exceed UGX ${FMG.maxDeliveryFee.toLocaleString()}.`;
    if (fee > 0) deliveryFees[input.dataset.loc] = Math.min(fee, FMG.maxDeliveryFee);
  });
  if (deliveryEnabled && feeError) {
    errEl.textContent = feeError;
    errEl.classList.remove("hidden");
    return;
  }

  errEl.classList.add("hidden");
  const products = FMG.getProducts();
  if (editingProductId) {
    const idx = products.findIndex(p => p.id === editingProductId);
    products[idx] = { ...products[idx], name, category, price, discount, stock, desc, deliveryEnabled, deliveryFees,
      image: pendingImageDataUrl || products[idx].image };
  } else {
    products.push({
      id: FMG.uid("prod"), name, category, price, discount, stock, desc, bizId: CURRENT_BIZ.id,
      deliveryEnabled, deliveryFees,
      image: pendingImageDataUrl || FMG.placeholder(category, name),
      createdAt: new Date().toISOString(), views: 0
    });
  }
  FMG.saveProducts(products);
  closeProductForm();
  renderProductsTable();
  renderOverview();
  toast(editingProductId ? "Product updated." : "Product uploaded — now visible on the public site.");
}

/* ---------- orders / sales per month ---------- */
function renderOrdersTable() {
  const lines = bizOrderLines().sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById("ordersTableBody");
  if (lines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No sales yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = lines.map(l => `
    <tr>
      <td>${new Date(l.date).toLocaleDateString()}</td>
      <td>${l.productName}</td>
      <td>${l.qty}</td>
      <td>${FMG.locationById(l.location)?.label || l.location}</td>
      <td>${money(l.revenue)}</td>
    </tr>`).join("");
}

function monthKey(d) { const dt = new Date(d); return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0"); }
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "short", year: "2-digit" });
}

function monthlyRevenueSeries() {
  const lines = bizOrderLines();
  const map = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    map[monthKey(d)] = 0;
  }
  lines.forEach(l => { const k = monthKey(l.date); if (k in map) map[k] += l.revenue; });
  // Demo baseline so a fresh business still sees a meaningful trend line.
  Object.keys(map).forEach((k, idx) => { if (map[k] === 0) map[k] = Math.round(150000 + idx * 60000 + Math.random() * 90000); });
  return Object.entries(map).map(([k, v]) => ({ label: monthLabel(k), value: v }));
}

let progressionChart, salesChart;
function renderProgressionChart() {
  const series = monthlyRevenueSeries();
  const ctx = document.getElementById("progressionCanvas").getContext("2d");
  if (progressionChart) progressionChart.destroy();
  progressionChart = new Chart(ctx, {
    type: "line",
    data: { labels: series.map(s => s.label), datasets: [{ label: "Revenue (UGX)", data: series.map(s => s.value), borderColor: "#E8A93B", backgroundColor: "rgba(232,169,59,0.18)", fill: true, tension: 0.3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => (v / 1000) + "k" } } } }
  });
}
function renderSalesChart() {
  const series = monthlyRevenueSeries();
  const ctx = document.getElementById("salesCanvas").getContext("2d");
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, {
    type: "bar",
    data: { labels: series.map(s => s.label), datasets: [{ label: "Sales (UGX)", data: series.map(s => s.value), backgroundColor: "#1B2A4A" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => (v / 1000) + "k" } } } }
  });
}

/* ---------- income statement / balance sheet ---------- */
function renderFinance() {
  const lines = bizOrderLines();
  const revenue = lines.reduce((s, l) => s + l.revenue, 0);
  const cogs = Math.round(revenue * 0.6);
  const grossProfit = revenue - cogs;
  const status = trialStatus(CURRENT_BIZ);
  const platformFeeRate = status.active ? 0 : 0.05;
  const platformFee = Math.round(revenue * platformFeeRate);
  const netProfit = grossProfit - platformFee;

  document.getElementById("incomeStatement").innerHTML = `
    <table class="data-table">
      <tr><td>Sales revenue</td><td style="text-align:right;">${money(revenue)}</td></tr>
      <tr><td>Estimated cost of goods sold</td><td style="text-align:right;">(${money(cogs)})</td></tr>
      <tr><th>Gross profit</th><th style="text-align:right;">${money(grossProfit)}</th></tr>
      <tr><td>Platform fee ${status.active ? "(waived — free trial)" : "(5%)"}</td><td style="text-align:right;">(${money(platformFee)})</td></tr>
      <tr><th>Net profit</th><th style="text-align:right;">${money(netProfit)}</th></tr>
    </table>
    <p class="form-note">Cost of goods and fees are estimates for demonstration. Connect real accounting figures once a backend is in place.</p>`;

  const products = bizProducts();
  const inventoryValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const cash = revenue;
  const totalAssets = inventoryValue + cash;
  const liabilities = status.expired ? Math.round(revenue * 0.05) : 0;
  const equity = totalAssets - liabilities;

  document.getElementById("balanceSheet").innerHTML = `
    <table class="data-table">
      <tr><th colspan="2">Assets</th></tr>
      <tr><td>Cash from sales</td><td style="text-align:right;">${money(cash)}</td></tr>
      <tr><td>Inventory on hand (at listed price)</td><td style="text-align:right;">${money(inventoryValue)}</td></tr>
      <tr><th>Total assets</th><th style="text-align:right;">${money(totalAssets)}</th></tr>
      <tr><th colspan="2">Liabilities &amp; equity</th></tr>
      <tr><td>Platform fees owed</td><td style="text-align:right;">${money(liabilities)}</td></tr>
      <tr><th>Owner's equity</th><th style="text-align:right;">${money(equity)}</th></tr>
    </table>`;
}

/* ---------- delivery & pickup locations ---------- */
function renderLocationChips() {
  selectedLocations = fmgLoad("fmg_biz_locations_" + CURRENT_BIZ.id, [CURRENT_BIZ.location]);
  const list = document.getElementById("locationChips");
  list.innerHTML = FMG.locations.map(l => `
    <button type="button" class="location-chip ${selectedLocations.includes(l.id) ? "selected" : ""}" data-loc="${l.id}">${l.label}</button>`).join("");
  list.querySelectorAll(".location-chip").forEach(btn => {
    btn.onclick = () => {
      const loc = btn.dataset.loc;
      if (selectedLocations.includes(loc)) selectedLocations = selectedLocations.filter(x => x !== loc);
      else selectedLocations.push(loc);
      fmgSave("fmg_biz_locations_" + CURRENT_BIZ.id, selectedLocations);
      btn.classList.toggle("selected");
      initMap();
    };
  });
}

let bizMap = null;
function initMap() {
  const el = document.getElementById("map");
  if (!el || typeof L === "undefined") return;
  if (bizMap) { bizMap.remove(); bizMap = null; }
  bizMap = L.map("map").setView([0.0, 31.9], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors", maxZoom: 17
  }).addTo(bizMap);
  FMG.locations.forEach(loc => {
    const active = selectedLocations.includes(loc.id);
    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: active ? 9 : 6, color: active ? "#E8A93B" : "#1B2A4A", fillColor: active ? "#E8A93B" : "#1B2A4A", fillOpacity: 0.85
    }).addTo(bizMap);
    marker.bindPopup(`<strong>${loc.label}</strong><br>${active ? "Active pickup/delivery point" : "Not selected"}`);
  });
}

/* ---------- messages: two-way threads with shoppers ---------- */
function renderMessages() {
  const threads = FMG.getThreads().filter(t => t.bizId === CURRENT_BIZ.id)
    .sort((a, b) => new Date(b.messages.at(-1)?.at || b.createdAt) - new Date(a.messages.at(-1)?.at || a.createdAt));
  const list = document.getElementById("messagesList");
  list.innerHTML = threads.length ? threads.map(t => `
    <div class="panel" style="margin-bottom:10px;padding:14px 16px;">
      <strong>${t.userName}</strong>
      ${t.unreadForBiz ? '<span class="badge-chip badge-low" style="margin-left:6px;">New</span>' : ""}
      <div style="max-height:180px;overflow-y:auto;margin:10px 0;display:flex;flex-direction:column;gap:6px;">
        ${t.messages.map(m => `<div class="chat-msg ${m.from === "business" ? "user" : "bot"}" style="align-self:${m.from === "business" ? "flex-end" : "flex-start"};max-width:85%;">${m.text}</div>`).join("")}
      </div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="reply-${t.id}" placeholder="Write a reply..." style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:4px;">
        <button class="btn btn-primary btn-sm" onclick="replyToThread('${t.id}')">Send</button>
      </div>
    </div>`).join("")
    : `<p style="color:rgba(33,26,22,0.6);">No messages from shoppers yet — they'll appear here after using "Message seller" on one of your products.</p>`;
}

function replyToThread(threadId) {
  const input = document.getElementById("reply-" + threadId);
  const text = input.value.trim();
  if (!text) return;
  const threads = FMG.getThreads();
  const idx = threads.findIndex(t => t.id === threadId);
  if (idx === -1) return;
  threads[idx].messages.push({ from: "business", text, at: new Date().toISOString() });
  threads[idx].unreadForBiz = false;
  threads[idx].unreadForUser = true; // this is what lets the shopper's browser pick up the reply
  FMG.saveThreads(threads);
  renderMessages();
  toast("Reply sent to " + threads[idx].userName + ".");
}

/* ---------- chatbot settings ---------- */
function renderChatbotSettings() {
  const saved = fmgLoad("fmg_biz_chatbot_" + CURRENT_BIZ.id, { persona: "friendly", greeting: `Hi! Thanks for visiting ${CURRENT_BIZ.name}. How can I help?` });
  document.getElementById("chatbotPersona").value = saved.persona;
  document.getElementById("chatbotGreeting").value = saved.greeting;
}
function saveChatbotSettings() {
  const persona = document.getElementById("chatbotPersona").value;
  const greeting = document.getElementById("chatbotGreeting").value.trim();
  fmgSave("fmg_biz_chatbot_" + CURRENT_BIZ.id, { persona, greeting });
  toast("Chat assistant settings saved.");
}

/* ---------- payment methods this business accepts from shoppers ----------
   Shown at public checkout via FMG.commonOfferedMethods() — a method only
   counts as "offered" once it's both switched on AND has an account number
   filled in, so a half-configured toggle can't be selected by a shopper. */
function renderPaymentMethodsForm() {
  const pm = CURRENT_BIZ.paymentMethods || FMG.emptyPaymentMethods();
  const box = document.getElementById("paymentMethodsForm");
  box.innerHTML = FMG.paymentMethods.map(m => {
    const entry = pm[m.id] || { enabled: false, [m.field]: "" };
    return `
    <div class="field" style="border:1px solid var(--line);border-radius:4px;padding:12px 14px;margin-bottom:10px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:0.95rem;">
        <input type="checkbox" id="pm-${m.id}-enabled" ${entry.enabled ? "checked" : ""} style="width:auto;">
        ${m.label}
      </label>
      <input type="text" id="pm-${m.id}-value" placeholder="${m.fieldLabel}" value="${entry[m.field] || ""}" style="margin-top:8px;">
    </div>`;
  }).join("");
}

function savePaymentMethodsForm() {
  const paymentMethods = {};
  FMG.paymentMethods.forEach(m => {
    const enabled = document.getElementById(`pm-${m.id}-enabled`).checked;
    const value = document.getElementById(`pm-${m.id}-value`).value.trim();
    paymentMethods[m.id] = { enabled, [m.field]: value };
  });
  const businesses = FMG.getBusinesses();
  const idx = businesses.findIndex(b => b.id === CURRENT_BIZ.id);
  businesses[idx] = { ...businesses[idx], paymentMethods };
  FMG.saveBusinesses(businesses);
  CURRENT_BIZ = businesses[idx];
  toast("Payment methods saved — shoppers will see whichever ones have an account number filled in.");
}

/* ---------- bootstrap ---------- */
document.addEventListener("DOMContentLoaded", () => {
  CURRENT_BIZ = guardBusinessSession();
  if (!CURRENT_BIZ) return;

  document.getElementById("bizNameLabel").textContent = CURRENT_BIZ.name;
  const status = trialStatus(CURRENT_BIZ);
  const pill = document.getElementById("trialPill");
  pill.textContent = status.label;
  pill.classList.toggle("expired", status.expired);

  renderOverview();
  renderProductsTable();
  renderOrdersTable();
  renderFinance();
  renderLocationChips();
  renderMessages();
  renderChatbotSettings();
  renderPaymentMethodsForm();

  document.querySelectorAll(".dash-nav a[data-section]").forEach(a => {
    a.addEventListener("click", (e) => { e.preventDefault(); showSection(a.dataset.section); });
  });
  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("addProductBtn").onclick = () => openProductForm(null);
  document.getElementById("productFormClose").onclick = closeProductForm;
  document.getElementById("productFormSave").onclick = saveProductForm;
  document.getElementById("imageInput").addEventListener("change", (e) => handleImageSelect(e.target));
  document.getElementById("chatbotSaveBtn").onclick = saveChatbotSettings;
  document.getElementById("pfDeliveryEnabled").addEventListener("change", toggleDeliveryFeeInputs);
  document.getElementById("paymentMethodsSaveBtn").onclick = savePaymentMethodsForm;

  showSection("sec-overview");

  // When cloud sync is on, another device's changes (a shopper's order landing,
  // an admin edit, etc.) arrive here in the background — keep the numbers fresh.
  document.addEventListener("fmg:updated", (e) => {
    if (!CURRENT_BIZ) return;
    if (e.detail.key === "fmg_businesses") {
      const refreshed = FMG.businessById(CURRENT_BIZ.id);
      if (refreshed) CURRENT_BIZ = refreshed;
    }
    if (e.detail.key === "fmg_threads") renderMessages();
    renderOverview();
    renderProductsTable();
    renderOrdersTable();
    renderFinance();
    renderMessages();
  });
});
