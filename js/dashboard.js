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
      <td>${money(p.price)}${p.discount ? ` <span style="color:var(--navy);">(-\${p.discount}%)</span>` : ""}</td>
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
