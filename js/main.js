/* ============================================================
   CAMPUS MARKET — main.js (public marketplace)
   ============================================================ */

function money(n) {
  return "UGX " + Number(n || 0).toLocaleString("en-UG");
}

/* ---------------- cookie / data-use consent ---------------- */
function initConsent() {
  const banner = document.getElementById("cookieBanner");
  const consent = FMG.getConsent();
  if (consent) { banner.classList.add("hidden"); return; }
  banner.classList.remove("hidden");
  document.getElementById("consentAccept").onclick = () => {
    FMG.setConsent({ accepted: true, at: new Date().toISOString() });
    banner.classList.add("hidden");
  };
  document.getElementById("consentDecline").onclick = () => {
    FMG.setConsent({ accepted: false, at: new Date().toISOString() });
    banner.classList.add("hidden");
  };
  document.getElementById("consentLink").onclick = (e) => {
    e.preventDefault();
    openTermsModal();
  };
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
  el.addEventListener("click", (e) => {
    if (e.target === el || e.target.hasAttribute("data-close")) el.remove();
  });
}

/* ---------------- header search + category rendering ---------------- */
function renderCategoryBar() {
  const bar = document.getElementById("categoryBar");
  const params = new URLSearchParams(location.search);
  const active = params.get("cat") || "";
  let html = `<a href="index.html" class="category-chip ${active === "" ? "active" : ""}">All categories</a>`;
  FMG.categories.forEach(c => {
    html += `<a href="index.html?cat=${c.id}" class="category-chip ${active === c.id ? "active" : ""}">${c.label}</a>`;
  });
  bar.innerHTML = html;

  const catSelect = document.getElementById("searchCategory");
  let optHtml = `<option value="">All</option>`;
  FMG.categories.forEach(c => optHtml += `<option value="${c.id}">${c.label}</option>`);
  catSelect.innerHTML = optHtml;
  if (active) catSelect.value = active;

  const q = params.get("q") || "";
  document.getElementById("searchInput").value = q;
}

function currentFilters() {
  const params = new URLSearchParams(location.search);
  return { cat: params.get("cat") || "", q: (params.get("q") || "").toLowerCase().trim() };
}

/* ---------------- header search + category rendering ---------------- */
// (Keep your money function and category bar code here as they are)

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const { cat, q } = currentFilters();
  
  // Make sure we pull from your exact local sync array names
  const products = typeof FMG !== "undefined" ? FMG.getProducts() : JSON.parse(localStorage.getItem("fmg_products_data") || "[]");
  const businesses = typeof FMG !== "undefined" ? FMG.getBusinesses() : JSON.parse(localStorage.getItem("fmg_businesses_data") || "[]");

  const filtered = products.filter(p => {
    // Looks up the registered business matching the product's bizId (e.g. "biz_muqnejfm5teaz")
    const biz = businesses.find(b => b.id === p.bizId || b.bizId === p.bizId);
    const matchesCat = !cat || p.category === cat;
    const haystack = (p.name + " " + p.desc + " " + (biz ? (biz.name || biz.businessName || "") : "")).toLowerCase();
    const matchesQ = !q || haystack.includes(q);
    return matchesCat && matchesQ;
  });

  const resultCount = document.getElementById("resultCount");
  if (resultCount) {
    resultCount.textContent = filtered.length + (filtered.length === 1 ? " product" : " products");
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:rgba(33,26,22,0.6);">No products found.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    // Find the correct seller document again for rendering
    const biz = businesses.find(b => b.id === p.bizId || b.bizId === p.bizId);
    
    // Grabs the real input text name from registration, or defaults back smoothly
    const businessName = biz ? (biz.name || biz.businessName) : "Unknown seller";
    const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    const stockBadge = p.stock === 0 ? `<span class="stock-badge">Out of stock</span>` : "";

    return `
    <article class="product-card">
      <div class="product-thumb">
        ${p.discount ? `<span class="discount-badge">-\${p.discount}%</span>` : ""}
        ${stockBadge}
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="product-body">
        <span class="product-cat">${FMG.categoryById(p.category) ? FMG.categoryById(p.category).label : p.category}</span>
        <span class="product-name">${p.name}</span>
        <!-- Show the real seller name here -->
        <span class="product-biz">${businessName}</span>
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
            ${p.discount ? `<span class="price-was">${money(p.price)}</span>` : ""}
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

/* ---------------- auth: signup / login ---------------- */
let signupRole = "user";

function openAuthModal(mode) {
  const html = `
  <div class="modal-overlay" id="authOverlay">
    <div class="modal">
      <button class="modal-close" data-close>&times;</button>
      <div class="tabs">
        <button class="tab-btn ${mode === "login" ? "active" : ""}" data-tab="login">Log in</button>
        <button class="tab-btn ${mode === "signup" ? "active" : ""}" data-tab="signup">Sign up</button>
      </div>
      <div id="authTabContent"></div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("authOverlay");
  document.querySelectorAll("#authOverlay .tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#authOverlay .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderAuthTab(btn.dataset.tab);
    };
  });
  renderAuthTab(mode);
}

function renderAuthTab(tab) {
  const container = document.getElementById("authTabContent");
  if (tab === "login") {
    container.innerHTML = `
      <h2>Welcome back</h2>
      <p class="sub">Log in as a user, a business, or the site admin.</p>
      <div class="field"><label>Email, business name, or admin name</label><input id="loginId" placeholder="you@example.com or business name"></div>
      <div class="field"><label>Password</label><input id="loginPw" type="password" placeholder="••••••••"></div>
      <div id="loginError" class="error-text hidden"></div>
      <button class="btn btn-primary btn-block" onclick="handleLogin()">Log in</button>
      <p class="form-note">Admin demo: name "ADMIN GROUP A", password "KU MASAKA".<br>
      Business demo: masaka.threads@example.com / demo1234</p>
    `;
  } else {
    container.innerHTML = `
      <h2>Create your account</h2>
      <p class="sub">Join as a shopper, or register your business.</p>
      <div class="role-toggle">
        <button id="roleUserBtn" class="active" onclick="setSignupRole('user')">I'm a user</button>
        <button id="roleBizBtn" onclick="setSignupRole('business')">I'm a business</button>
      </div>
      <div id="signupFields"></div>
      <div id="signupError" class="error-text hidden"></div>
      <button class="btn btn-primary btn-block" onclick="handleSignup()">Create account</button>
    `;
    setSignupRole("user");
  }
}

function setSignupRole(role) {
  signupRole = role;
  document.getElementById("roleUserBtn").classList.toggle("active", role === "user");
  document.getElementById("roleBizBtn").classList.toggle("active", role === "business");
  const fields = document.getElementById("signupFields");
  if (role === "user") {
    fields.innerHTML = `
      <div class="field"><label>Full name</label><input id="suName" placeholder="Jane Nakato"></div>
      <div class="field"><label>Email</label><input id="suEmail" placeholder="you@example.com"></div>
      <div class="field"><label>Password</label><input id="suPw" type="password" placeholder="At least 6 characters"></div>`;
  } else {
    const trialOpen = FMG.isFreeTrialAvailable();
    fields.innerHTML = `
      <div class="field"><label>Business name</label><input id="suBizName" placeholder="e.g. Masaka Threads"></div>
      <div class="field"><label>Email</label><input id="suEmail" placeholder="business@example.com"></div>
      <div class="field"><label>Password</label><input id="suPw" type="password" placeholder="At least 6 characters"></div>
      <div class="field-row">
        <div class="field"><label>Category</label>
          <select id="suCategory">${FMG.categories.map(c => `<option value="${c.id}">${c.label}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Pickup location</label>
          <select id="suLocation">${FMG.locations.map(l => `<option value="${l.id}">${l.label}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>Short description</label><textarea id="suBio" placeholder="What does your business sell?"></textarea></div>
      <div class="${trialOpen ? "success-box" : "form-note"}">
        ${trialOpen
          ? "You qualify for the first 100 businesses offer: free listing for 6 months. After that, standard fees apply."
          : "The free-trial offer for the first 100 businesses has ended. Standard subscription fees apply from sign-up."}
      </div>`;
  }
}

function handleSignup() {
  const errorEl = document.getElementById("signupError");
  errorEl.classList.add("hidden");
  const email = document.getElementById("suEmail").value.trim().toLowerCase();
  const pw = document.getElementById("suPw").value;
  if (!email || !pw || pw.length < 6) {
    errorEl.textContent = "Please provide a valid email and a password of at least 6 characters.";
    errorEl.classList.remove("hidden");
    return;
  }
  const allEmails = [...FMG.getUsers(), ...FMG.getBusinesses()].map(x => x.email);
  if (allEmails.includes(email)) {
    errorEl.textContent = "An account with this email already exists. Try logging in instead.";
    errorEl.classList.remove("hidden");
    return;
  }

  if (signupRole === "user") {
    const name = document.getElementById("suName").value.trim() || "Shopper";
    const users = FMG.getUsers();
    const user = { id: FMG.uid("user"), role: "user", name, email, password: pw, joined: new Date().toISOString().slice(0, 10) };
    users.push(user);
    FMG.saveUsers(users);
    FMG.setSession({ type: "user", id: user.id });
    document.getElementById("authOverlay").remove();
    refreshHeaderAuthState();
  } else {
    const name = document.getElementById("suBizName").value.trim();
    if (!name) {
      errorEl.textContent = "Please enter a business name.";
      errorEl.classList.remove("hidden");
      return;
    }
    const category = document.getElementById("suCategory").value;
    const bizLocation = document.getElementById("suLocation").value;
    const bio = document.getElementById("suBio").value.trim();
    const gotTrial = FMG.registerBusinessTrialSlot();
    const joined = new Date();
    const trialEnds = new Date(joined);
    trialEnds.setMonth(trialEnds.getMonth() + FMG_FREE_TRIAL_MONTHS);
    const biz = {
      id: FMG.uid("biz"), role: "business", name, email, password: pw, category, location: bizLocation, bio,
      joined: joined.toISOString().slice(0, 10),
      freeTrial: gotTrial, trialEndsAt: gotTrial ? trialEnds.toISOString().slice(0, 10) : null,
      paymentMethods: FMG.emptyPaymentMethods()
    };
    const businesses = FMG.getBusinesses();
    businesses.push(biz);
    FMG.saveBusinesses(businesses);
    FMG.setSession({ type: "business", id: biz.id });
    window.location.href = "business-dashboard.html";
  }
}

function handleLogin() {
  const errorEl = document.getElementById("loginError");
  errorEl.classList.add("hidden");
  const id = document.getElementById("loginId").value.trim();
  const pw = document.getElementById("loginPw").value;

  if (id === FMG_ADMIN.name && pw === FMG_ADMIN.password) {
    FMG.setSession({ type: "admin" });
    window.location.href = "admin.html";
    return;
  }
  const email = id.toLowerCase();
  const biz = FMG.getBusinesses().find(b => (b.email === email || b.name.toLowerCase() === email) && b.password === pw);
  if (biz) {
    FMG.setSession({ type: "business", id: biz.id });
    window.location.href = "business-dashboard.html";
    return;
  }
  const user = FMG.getUsers().find(u => u.email === email && u.password === pw);
  if (user) {
    FMG.setSession({ type: "user", id: user.id });
    document.getElementById("authOverlay").remove();
    refreshHeaderAuthState();
    return;
  }
  errorEl.textContent = "We couldn't match those details. Check them or sign up.";
  errorEl.classList.remove("hidden");
}

function refreshHeaderAuthState() {
  const session = FMG.getSession();
  const slot = document.getElementById("navAuthSlot");
  if (!slot) return;
  const messagesBtn = document.getElementById("messagesOpenBtn");
  if (session && session.type === "user") {
    const user = FMG.getUsers().find(u => u.id === session.id);
    slot.innerHTML = `
      <span style="color:var(--gold);font-size:0.85rem;margin-right:6px;">Hi, ${user ? user.name.split(" ")[0] : "there"}</span>
      <button class="btn btn-outline btn-sm" onclick="logout()">Log out</button>`;
    if (messagesBtn) messagesBtn.classList.remove("hidden");
    renderMessagesBadge();
  } else {
    slot.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openAuthModal('login')">Log in</button>
      <button class="btn btn-primary btn-sm" onclick="openAuthModal('signup')">Sign up</button>`;
    if (messagesBtn) messagesBtn.classList.add("hidden");
  }
}

function logout() {
  FMG.clearSession();
  window.location.href = "index.html";
}

/* ---------------- cart ---------------- */
function addToCartGuarded(productId) {
  const session = FMG.getSession();
  if (!session || session.type !== "user") {
    openAuthModal("login");
    return;
  }
  addToCart(productId);
}

function addToCart(productId) {
  const cart = FMG.getCart();
  const existing = cart.find(c => c.productId === productId);
  if (existing) existing.qty += 1;
  else cart.push({ productId, qty: 1 });
  FMG.saveCart(cart);
  renderCartCount();
  notifyBusinessOfCartAdd(productId);
  toast("Added to cart.");
}

function renderCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = FMG.getCart().reduce((sum, c) => sum + c.qty, 0);
  el.textContent = count;
  el.classList.toggle("hidden", count === 0);
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById("cartDrawer");
  const dim = document.getElementById("cartDim");
  if (open) { renderCartDrawer(); drawer.classList.add("open"); dim.classList.remove("hidden"); }
  else { drawer.classList.remove("open"); dim.classList.add("hidden"); }
}

function renderCartDrawer() {
  const cart = FMG.getCart();
  const products = FMG.getProducts();
  const list = document.getElementById("cartItems");
  if (cart.length === 0) {
    list.innerHTML = `<p style="color:rgba(33,26,22,0.6);padding:20px 0;">Your cart is empty.</p>`;
  } else {
    list.innerHTML = cart.map(c => {
      const p = products.find(x => x.id === c.productId);
      if (!p) return "";
      const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
      return `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.name}">
        <div class="cart-item-info">
          <div class="name">${p.name}</div>
          <div class="meta">${money(finalPrice)} each</div>
          <div class="qty-controls">
            <button onclick="changeQty('${p.id}', -1)">−</button>
            <span>${c.qty}</span>
            <button onclick="changeQty('${p.id}', 1)">+</button>
          </div>
        </div>
        <div>
          <div style="font-weight:700;font-size:0.85rem;">${money(finalPrice * c.qty)}</div>
          <a class="remove-link" onclick="removeFromCart('${p.id}')">Remove</a>
        </div>
      </div>`;
    }).join("");
  }
  const total = cart.reduce((sum, c) => {
    const p = products.find(x => x.id === c.productId);
    if (!p) return sum;
    const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    return sum + finalPrice * c.qty;
  }, 0);
  document.getElementById("cartTotal").textContent = money(total);
}

function changeQty(productId, delta) {
  const cart = FMG.getCart();
  const item = cart.find(c => c.productId === productId);
  if (!item) return;
  item.qty += delta;
  const updated = item.qty <= 0 ? cart.filter(c => c.productId !== productId) : cart;
  FMG.saveCart(updated);
  renderCartDrawer();
  renderCartCount();
}

function removeFromCart(productId) {
  FMG.saveCart(FMG.getCart().filter(c => c.productId !== productId));
  renderCartDrawer();
  renderCartCount();
}

function openCheckoutModal() {
  const cart = FMG.getCart();
  if (cart.length === 0) return;
  const products = FMG.getProducts();
  const itemTotal = cart.reduce((sum, c) => {
    const p = products.find(x => x.id === c.productId);
    if (!p) return sum;
    const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    return sum + finalPrice * c.qty;
  }, 0);

  // Only offer a payment method every business represented in the cart actually accepts —
  // see FMG.commonOfferedMethods() in data.js. If there's no overlap, block checkout here
  // rather than let someone "pay" a business through a method it never switched on.
  const commonMethods = FMG.commonOfferedMethods(cart);
  if (commonMethods.length === 0) {
    const bizNames = [...new Set(cart.map(c => {
      const p = products.find(x => x.id === c.productId);
      const biz = p && FMG.businessById(p.bizId);
      return biz ? biz.name : null;
    }).filter(Boolean))];
    const html = `
    <div class="modal-overlay" id="checkoutOverlay">
      <div class="modal">
        <button class="modal-close" data-close>&times;</button>
        <h2>Can't check out these together</h2>
        <p class="sub">${bizNames.join(", ")} don't share a payment method you can pay with in one order.</p>
        <p>Please check out items from one business at a time, or ask a business to add a payment method
        you can both use from their dashboard.</p>
      </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", html);
    bindOverlayClose("checkoutOverlay");
    return;
  }

  const html = `
  <div class="modal-overlay" id="checkoutOverlay">
    <div class="modal">
      <button class="modal-close" data-close>&times;</button>
      <h2>Checkout</h2>
      <div class="field"><label>Delivery / pickup point</label>
        <select id="checkoutLocation" onchange="renderCheckoutTotals()">${FMG.locations.map(l => `<option value="${l.id}">${l.label}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Payment method</label>
        <select id="checkoutMethod" onchange="renderPaymentFields()">
          ${commonMethods.map(id => {
            const m = FMG.paymentMethods.find(x => x.id === id);
            return `<option value="${id}">${m.label}</option>`;
          }).join("")}
        </select>
      </div>
      <div id="paymentFields"></div>
      <p class="form-note" id="paymentAccountNote"></p>
      <div class="field" style="background:#f6f3ee;border-radius:4px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span>Items</span><span>${money(itemTotal)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:0.88rem;" id="checkoutDeliveryRow"><span>Delivery fee</span><span id="checkoutDeliveryFee">UGX 0</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:4px;"><span>Total</span><span id="checkoutGrandTotal">${money(itemTotal)}</span></div>
      </div>
      <div id="checkoutError" class="error-text hidden"></div>
      <button class="btn btn-primary btn-block" id="checkoutPayBtn" onclick="submitPayment(${itemTotal})">Pay</button>
      <p class="form-note">This is a working demo checkout. Connect a licensed MTN MoMo / Airtel Pay / Mastercard
      gateway on the server side before accepting real payments.</p>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("checkoutOverlay");
  renderPaymentFields();
  renderCheckoutTotals();
}

// Recomputes the delivery fee for the currently chosen pickup/delivery point (each product
// that offers delivery there contributes its own fee, capped at FMG.maxDeliveryFee) and
// keeps the on-screen total and the Pay button's amount in sync with it.
function renderCheckoutTotals() {
  const cart = FMG.getCart();
  const products = FMG.getProducts();
  const location = document.getElementById("checkoutLocation").value;
  const itemTotal = cart.reduce((sum, c) => {
    const p = products.find(x => x.id === c.productId);
    if (!p) return sum;
    const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
    return sum + finalPrice * c.qty;
  }, 0);
  const deliveryFee = FMG.cartDeliveryFee(cart, location);
  document.getElementById("checkoutDeliveryFee").textContent = money(deliveryFee);
  document.getElementById("checkoutDeliveryRow").style.display = deliveryFee > 0 ? "flex" : "none";
  document.getElementById("checkoutGrandTotal").textContent = money(itemTotal + deliveryFee);
  document.getElementById("checkoutPayBtn").textContent = "Pay " + money(itemTotal + deliveryFee);
  document.getElementById("checkoutPayBtn").setAttribute("onclick", `submitPayment(${itemTotal + deliveryFee})`);
}

function renderPaymentFields() {
  const method = document.getElementById("checkoutMethod").value;
  const accounts = FMG.getPaymentAccounts();
  const fields = document.getElementById("paymentFields");
  const note = document.getElementById("paymentAccountNote");
  if (method === "momo") {
    fields.innerHTML = `<div class="field"><label>MTN MoMo phone number</label><input id="payDetail" placeholder="07XXXXXXXX"></div>`;
    note.textContent = "You'll be prompted on your phone to approve this MoMo payment to the seller's account: " + (accounts.momo || "not set yet");
  } else if (method === "airtel") {
    fields.innerHTML = `<div class="field"><label>Airtel Pay phone number</label><input id="payDetail" placeholder="07XXXXXXXX"></div>`;
    note.textContent = "You'll be prompted on your phone to approve this Airtel Pay payment to the seller's account: " + (accounts.airtel || "not set yet");
  } else {
    fields.innerHTML = `
      <div class="field"><label>Card number</label><input id="payDetail" placeholder="4111 1111 1111 1111"></div>
      <div class="field-row">
        <div class="field"><label>Expiry</label><input placeholder="MM/YY"></div>
        <div class="field"><label>CVV</label><input placeholder="123"></div>
      </div>`;
    note.textContent = "Funds are collected to the seller's merchant account: " + (accounts.mastercard || "not set yet");
  }
}

function submitPayment(total) {
  const detail = document.getElementById("payDetail")?.value.trim();
  const errEl = document.getElementById("checkoutError");
  if (!detail) {
    errEl.textContent = "Please enter your payment details.";
    errEl.classList.remove("hidden");
    return;
  }
  const session = FMG.getSession();
  const deliveryLocation = document.getElementById("checkoutLocation").value;
  const cart = FMG.getCart();
  const products = FMG.getProducts();
  const deliveryFee = FMG.cartDeliveryFee(cart, deliveryLocation);

  const order = {
    id: FMG.uid("order"),
    userId: session.id,
    items: cart.map(c => ({ ...c })),
    total,
    deliveryFee,
    location: deliveryLocation,
    method: document.getElementById("checkoutMethod").value,
    createdAt: new Date().toISOString(),
    status: "paid (demo)"
  };
  const orders = FMG.getOrders();
  orders.push(order);
  FMG.saveOrders(orders);

  const updatedProducts = products.map(p => {
    const inCart = cart.find(c => c.productId === p.id);
    return inCart ? { ...p, stock: Math.max(0, p.stock - inCart.qty) } : p;
  });
  FMG.saveProducts(updatedProducts);
  FMG.saveCart([]);
  renderCartCount();
  document.getElementById("checkoutOverlay").remove();
  toggleCartDrawer(false);
  renderProducts();
  toast("Payment recorded — order placed for pickup/delivery at " + FMG.locationById(deliveryLocation).label + ".");
}

/* ---------------- general site feedback (to admin only) ---------------- */
function openFeedbackModal(target, targetName) {
  const html = `
  <div class="modal-overlay" id="feedbackOverlay">
    <div class="modal">
      <button class="modal-close" data-close>&times;</button>
      <h2>Send feedback to admin</h2>
      <p class="sub">Your message is delivered to the admin panel.</p>
      <div class="field"><label>Your name</label><input id="fbName" placeholder="Your name"></div>
      <div class="field"><label>Message</label><textarea id="fbMessage" placeholder="Type your message..."></textarea></div>
      <button class="btn btn-primary btn-block" onclick="submitFeedback('${target}','${targetName || ""}')">Send</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("feedbackOverlay");
}

function submitFeedback(target, targetName) {
  const name = document.getElementById("fbName").value.trim() || "Anonymous";
  const message = document.getElementById("fbMessage").value.trim();
  if (!message) return;
  const list = FMG.getFeedback();
  list.push({
    id: FMG.uid("fb"), from: target, targetName, name, message,
    createdAt: new Date().toISOString().slice(0, 10)
  });
  FMG.saveFeedback(list);
  document.getElementById("feedbackOverlay").remove();
  toast("Thanks — your message has been sent.");
}

/* ---------------- two-way messaging: shopper <-> business ----------------
   A "thread" is one running conversation between one signed-in shopper and
   one business. The business replies from their dashboard (see dashboard.js
   renderMessages()); when cloud sync is on, the reply reaches the shopper's
   browser in the background and lights up the Messages button here. */

function getOrCreateThread(userId, bizId) {
  const threads = FMG.getThreads();
  let thread = threads.find(t => t.userId === userId && t.bizId === bizId);
  if (!thread) {
    const user = FMG.getUsers().find(u => u.id === userId);
    const biz = FMG.businessById(bizId);
    thread = {
      id: FMG.uid("thread"), userId, bizId,
      userName: user ? user.name : "Shopper", bizName: biz ? biz.name : "Business",
      createdAt: new Date().toISOString(), messages: [],
      unreadForUser: false, unreadForBiz: false
    };
    threads.push(thread);
    FMG.saveThreads(threads);
  }
  return thread;
}

function myUnreadThreadCount() {
  const session = FMG.getSession();
  if (!session || session.type !== "user") return 0;
  return FMG.getThreads().filter(t => t.userId === session.id && t.unreadForUser).length;
}

function renderMessagesBadge() {
  const btn = document.getElementById("messagesOpenBtn");
  if (!btn) return;
  const count = myUnreadThreadCount();
  const badge = document.getElementById("messagesCount");
  if (count > 0) { badge.textContent = count; badge.classList.remove("hidden"); }
  else { badge.classList.add("hidden"); }
}

// "Message seller" on a product opens (or resumes) that shopper's thread with that business.
function openThreadWithBusiness(bizId) {
  const session = FMG.getSession();
  if (!session || session.type !== "user") { openAuthModal("login"); return; }
  const thread = getOrCreateThread(session.id, bizId);
  openThreadModal(thread.id);
}

function openMyMessagesModal() {
  const session = FMG.getSession();
  if (!session || session.type !== "user") { openAuthModal("login"); return; }
  const threads = FMG.getThreads().filter(t => t.userId === session.id)
    .sort((a, b) => new Date(b.messages.at(-1)?.at || b.createdAt) - new Date(a.messages.at(-1)?.at || a.createdAt));
  const html = `
  <div class="modal-overlay" id="myMessagesOverlay">
    <div class="modal">
      <button class="modal-close" data-close>&times;</button>
      <h2>Your messages</h2>
      <p class="sub">Conversations with businesses you've contacted.</p>
      <div id="myMessagesList">
        ${threads.length ? threads.map(t => {
          const last = t.messages.at(-1);
          return `<div class="cart-item" style="cursor:pointer;" onclick="document.getElementById('myMessagesOverlay').remove();openThreadModal('${t.id}')">
            <div class="cart-item-info">
              <div class="name">${t.bizName} ${t.unreadForUser ? '<span class="discount-badge" style="position:static;display:inline-block;margin-left:6px;">New</span>' : ""}</div>
              <div class="meta">${last ? (last.from === "business" ? "They said: " : "You said: ") + last.text.slice(0, 60) : "No messages yet"}</div>
            </div>
          </div>`;
        }).join("") : `<p style="color:rgba(33,26,22,0.6);">You haven't messaged any business yet — use "Message seller" on a product page.</p>`}
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("myMessagesOverlay");
}

function openThreadModal(threadId) {
  const thread = FMG.getThreads().find(t => t.id === threadId);
  if (!thread) return;
  // opening it marks the shopper's side as read
  if (thread.unreadForUser) {
    const threads = FMG.getThreads().map(t => t.id === threadId ? { ...t, unreadForUser: false } : t);
    FMG.saveThreads(threads);
    renderMessagesBadge();
  }
  const html = `
  <div class="modal-overlay" id="threadOverlay">
    <div class="modal">
      <button class="modal-close" data-close>&times;</button>
      <h2>${thread.bizName}</h2>
      <p class="sub">Your conversation with this business.</p>
      <div id="threadMessages" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>
      <div class="field"><textarea id="threadInput" placeholder="Type your message..." style="min-height:60px;"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="sendThreadMessage('${threadId}')">Send</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  bindOverlayClose("threadOverlay");
  renderThreadMessages(threadId);
}

function renderThreadMessages(threadId) {
  const thread = FMG.getThreads().find(t => t.id === threadId);
  const box = document.getElementById("threadMessages");
  if (!thread || !box) return;
  box.innerHTML = thread.messages.length
    ? thread.messages.map(m => `<div class="chat-msg ${m.from === "user" ? "user" : "bot"}" style="align-self:${m.from === "user" ? "flex-end" : "flex-start"};max-width:85%;">${m.text}</div>`).join("")
    : `<p class="form-note">Say hello — the business will see this on their dashboard and can reply here.</p>`;
  box.scrollTop = box.scrollHeight;
}

function sendThreadMessage(threadId) {
  const input = document.getElementById("threadInput");
  const text = input.value.trim();
  if (!text) return;
  const threads = FMG.getThreads();
  const idx = threads.findIndex(t => t.id === threadId);
  if (idx === -1) return;
  threads[idx].messages.push({ from: "user", text, at: new Date().toISOString() });
  threads[idx].unreadForBiz = true;
  FMG.saveThreads(threads);
  input.value = "";
  renderThreadMessages(threadId);
  toast("Message sent to " + threads[idx].bizName + ".");
}

/* ---------------- tiny toast ---------------- */
function toast(msg) {
  let el = document.getElementById("fmgToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "fmgToast";
    el.style.cssText = "position:fixed;bottom:24px;left:24px;background:#14110F;color:#FBF9F6;padding:12px 18px;border-radius:4px;z-index:300;border-left:4px solid #E8A93B;font-size:0.88rem;max-width:320px;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(window._fmgToastTimer);
  window._fmgToastTimer = setTimeout(() => { el.style.opacity = "0"; }, 3200);
}

/* ---------------- chatbot (rule-based demo assistant) ---------------- */
function initChatbot() {
  const toggle = document.getElementById("chatbotToggle");
  const panel = document.getElementById("chatbotPanel");
  if (!toggle || !panel) return;
  toggle.onclick = () => panel.classList.toggle("hidden");
  document.getElementById("chatbotCloseBtn").onclick = () => panel.classList.add("hidden");
  document.getElementById("chatbotSend").onclick = sendChatMessage;
  document.getElementById("chatbotInput").addEventListener("keydown", e => {
    if (e.key === "Enter") sendChatMessage();
  });
  document.querySelectorAll(".chatbot-quick button").forEach(b => {
    b.onclick = () => { document.getElementById("chatbotInput").value = b.textContent; sendChatMessage(); };
  });
}

function pushChatMsg(text, who) {
  const body = document.getElementById("chatbotBody");
  const div = document.createElement("div");
  div.className = "chat-msg " + who;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById("chatbotInput");
  const text = input.value.trim();
  if (!text) return;
  pushChatMsg(text, "user");
  input.value = "";
  setTimeout(() => pushChatMsg(botReply(text), "bot"), 400);
}

function botReply(text) {
  const t = text.toLowerCase();
  if (t.includes("delivery") || t.includes("pickup")) {
    return "We deliver to or offer pickup at: " + FMG.locations.map(l => l.label).join(", ") + ". Choose your point at checkout — some products add a small delivery fee (never more than UGX 10,000) shown before you pay.";
  }
  if (t.includes("pay") || t.includes("momo") || t.includes("airtel") || t.includes("card")) {
    return "You can pay with MTN MoMo, Airtel Pay or Mastercard — the checkout only shows the methods the seller you're buying from actually accepts.";
  }
  if (t.includes("discount") || t.includes("offer")) {
    return "Look for the yellow discount badge on a product card — that shows the current price cut from that business.";
  }
  if (t.includes("cart")) {
    return "Anything you add to cart is saved to your account and the seller is notified so they can prepare stock.";
  }
  if (t.includes("business") || t.includes("sign up") && t.includes("business")) {
    return "Registering a business is free for the first 100 sign-ups, for 6 months. After that, standard fees apply.";
  }
  if (t.includes("human") || t.includes("agent") || t.includes("talk to")) {
    return "I can pass your message on — use \"Message seller\" on a product page, and check the Messages button up top for their reply.";
  }
  return "I can help with delivery points, payments, discounts and your cart. What would you like to know?";
}

function notifyBusinessOfCartAdd(productId) {
  const p = FMG.getProducts().find(x => x.id === productId);
  if (!p) return;
  const notes = fmgLoad("fmg_biz_notifications", []);
  notes.unshift({ id: FMG.uid("note"), bizId: p.bizId, message: `A shopper added "${p.name}" to their cart.`, at: new Date().toISOString() });
  fmgSave("fmg_biz_notifications", notes.slice(0, 50));
}

/* ---------------- page bootstrap ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initConsent();
  renderCategoryBar();
  renderProducts();
  renderCartCount();
  refreshHeaderAuthState();
  initChatbot();

  document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("searchInput").value.trim();
    const cat = document.getElementById("searchCategory").value;
    const params = new URLSearchParams();
    if (cat) params.set("cat", cat);
    if (q) params.set("q", q);
    window.location.search = params.toString();
  });

  document.getElementById("cartOpenBtn").onclick = () => toggleCartDrawer(true);
  document.getElementById("cartCloseBtn").onclick = () => toggleCartDrawer(false);
  document.getElementById("cartDim").onclick = () => toggleCartDrawer(false);
  document.getElementById("checkoutBtn").onclick = () => {
    const session = FMG.getSession();
    if (!session || session.type !== "user") { toggleCartDrawer(false); openAuthModal("login"); return; }
    openCheckoutModal();
  };
  document.getElementById("footerFeedbackLink").onclick = (e) => { e.preventDefault(); openFeedbackModal("web"); };
  document.getElementById("footerTermsLink").onclick = (e) => { e.preventDefault(); openTermsModal(); };

  // When cloud sync is on (see js/firebase-config.js), products/businesses saved on
  // another device arrive here in the background — redraw the grid when they do.
  document.addEventListener("fmg:updated", (e) => {
    if (e.detail.key === "fmg_products" || e.detail.key === "fmg_businesses") {
      renderProducts();
    }
    if (e.detail.key === "fmg_threads") {
      const before = window._fmgLastUnread || 0;
      renderMessagesBadge();
      const after = myUnreadThreadCount();
      if (after > before) toast("You have a new reply from a business — check Messages.");
      window._fmgLastUnread = after;
    }
  });
});
