/* ============================================================
   CAMPUS MARKET — main.js (public marketplace)
   ============================================================ */

function money(n) {
  return "UGX " + Number(n || 0).toLocaleString("en-UG");
}

/* ---------------- cookie / data-use consent ---------------- */
function initConsent() {
  const banner = document.getElementById("cookieBanner");
  
  // Safety Check: If the banner doesn't exist on this page, exit smoothly without crashing
  if (!banner) return; 

  const consent = FMG.getConsent();
  if (consent) { 
    banner.classList.add("hidden"); 
    return; 
  }
  
  banner.classList.remove("hidden");
  
  const acceptBtn = document.getElementById("consentAccept");
  if (acceptBtn) {
    acceptBtn.onclick = () => {
      FMG.setConsent({ accepted: true, at: new Date().toISOString() });
      banner.classList.add("hidden");
    };
  }
  
  const declineBtn = document.getElementById("consentDecline");
  if (declineBtn) {
    declineBtn.onclick = () => {
      FMG.setConsent({ accepted: false, at: new Date().toISOString() });
      banner.classList.add("hidden");
    };
  }
  
  const linkBtn = document.getElementById("consentLink");
  if (linkBtn) {
    linkBtn.onclick = (e) => {
      e.preventDefault();
      openTermsModal();
    };
  }
}

function openTermsModal() {
  const html = `
  <div class="modal-overlay" id="termsOverlay">
    <div class="modal modal-wide">
      <button class="modal-close" data-close>&times;</button>
      <h2>Terms, cookies &amp; data use</h2>
      <p class="sub">Please read before continuing to use CAMPUS MARKET.</p>
      <p>We use cookies and similar storage to keep you signed in, remember your cart, and measure how the
      site is used. If you accept, businesses on the platform may receive aggregated, anonymised insight
      from this activity (for example, which categories and locations get the most interest) so they can
      improve stock, pricing and delivery decisions. We do not sell personal contact details to third parties.</p>
      <p>By registering as a user or a business you agree to our marketplace rules: accurate product listings,
      fair pricing, respectful communication, and timely fulfilment of paid orders. Admin (GROUP A, KU MASAKA)
      may remove listings or accounts that break these rules.</p>
      <button class="btn btn-primary" data-close>Close</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("termsOverlay");
}

function bindOverlayClose(id) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.hasAttribute("data-close")) el.remove();
    });
  }
}

/* ---------------- header search + category rendering ---------------- */
function renderCategoryBar() {
  const bar = document.getElementById("categoryBar");
  if (!bar) return;

  const params = new URLSearchParams(location.search);
  const active = params.get("cat") || "";
  let html = `<a href="index.html" class="category-chip ${active === "" ? "active" : ""}">All categories</a>`;
  FMG.categories.forEach(c => {
    html += `<a href="index.html?cat=${c.id}" class="category-chip ${active === c.id ? "active" : ""}">${c.label}</a>`;
  });
  bar.innerHTML = html;

  const catSelect = document.getElementById("searchCategory");
  if (catSelect) {
    let optHtml = `<option value="">All</option>`;
    FMG.categories.forEach(c => optHtml += `<option value="${c.id}">${c.label}</option>`);
    catSelect.innerHTML = optHtml;
    if (active) catSelect.value = active;
  }

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    const q = params.get("q") || "";
    searchInput.value = q;
  }
}

function currentFilters() {
  const params = new URLSearchParams(location.search);
  return { cat: params.get("cat") || "", q: (params.get("q") || "").toLowerCase().trim() };
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const { cat, q } = currentFilters();
  const products = FMG.getProducts();
  const businesses = FMG.getBusinesses();

  const filtered = products.filter(p => {
    const biz = businesses.find(b => b.id === p.bizId);
    const matchesCat = !cat || p.category === cat;
    const haystack = (p.name + " " + p.desc + " " + (biz ? biz.name : "")).toLowerCase();
    const matchesQ = !q || haystack.includes(q);
    return matchesCat && matchesQ;
  });

  const resultCount = document.getElementById("resultCount");
  if (resultCount) {
    resultCount.textContent =
      filtered.length + (filtered.length === 1 ? " product" : " products") +
      (cat ? " in " + FMG.categoryById(cat).label : "") + (q ? ` matching "${q}"` : "");
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:rgba(33,26,22,0.6);">
      No products found. Try another category or search term.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const biz = businesses.find(b => b.id === p.bizId);
    const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    const stockBadge = p.stock === 0 ? `<span class="stock-badge">Out of stock</span>` :
      (p.stock <= 5 ? `<span class="stock-badge">Only ${p.stock} left</span>` : "");
    return `
    <article class="product-card">
      <div class="product-thumb">
        ${p.discount ? `<span class="discount-badge">-\${p.discount}%</span>` : ""}
        ${stockBadge}
        <img src="${p.image}" alt="${p.name}" loading="lazy" decoding="async">
      </div>
      <div class="product-body">
        <span class="product-cat">${FMG.categoryById(p.category) ? FMG.categoryById(p.category).label : p.category}</span>
        <span class="product-name">${p.name}</span>
        <span class="product-biz">${biz ? biz.name : "Unknown seller"} · ${biz ? FMG.locationById(biz.location)?.label || "" : ""}</span>
        <div class="product-price-row">
          <span class="price-now">${money(finalPrice)}</span>
          ${p.discount ? `<span class="price-was">\${money(p.price)}</span>` : ""}
        </div>
        <div class="product-actions">
          <button class="btn btn-outline-dark btn-sm" onclick="openProductModal('${p.id}')">View</button>
          <button class="btn btn-primary btn-sm" ${p.stock === 0 ? "disabled" : ""} onclick="addToCartGuarded('${p.id}')">Add to cart</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function openProductModal(productId) {
  const p = FMG.getProducts().find(x => x.id === productId);
  if (!p) return;
  const biz = FMG.businessById(p.bizId);
  const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
  const html = `
  <div class="modal-overlay" id="productOverlay">
    <div class="modal modal-wide">
      <button class="modal-close" data-close>&times;</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <img src="${p.image}" alt="${p.name}" style="border-radius:4px;">
        <div>
          <span class="product-cat">${FMG.categoryById(p.category)?.label || p.category}</span>
          <h2 style="margin-top:2px;">${p.name}</h2>
          <p class="sub">Sold by <strong>${biz ? biz.name : "—"}</strong> · ${biz ? FMG.locationById(biz.location)?.label : ""}</p>
          <div class="product-price-row" style="margin-bottom:10px;">
            <span class="price-now" style="font-size:1.3rem;">${money(finalPrice)}</span>
            ${p.discount ? `<span class="price-was">\${money(p.price)}</span>` : ""}
          </div>
          <p>${p.desc}</p>
          <p class="form-note">${p.stock > 0 ? p.stock + " in stock" : "Currently out of stock"}</p>
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button class="btn btn-primary" ${p.stock === 0 ? "disabled" : ""} onclick="addToCartGuarded('${p.id}');document.getElementById('productOverlay').remove();">Add to cart</button>
            <button class="btn btn-outline-dark" onclick="openThreadWithBusiness('${p.bizId}')">Message seller</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("productOverlay");
  const products = FMG.getProducts().map(x => x.id === p.id ? { ...x, views: (x.views || 0) + 1 } : x);
  FMG.saveProducts(products);
}

// Global initialization trigger for marketplace pages
document.addEventListener("DOMContentLoaded", () => {
  initConsent();
  renderCategoryBar();
  renderProducts();
});
