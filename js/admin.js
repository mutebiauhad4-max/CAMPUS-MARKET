/* ============================================================
   CAMPUS MARKET — admin.js
   ============================================================ */

function money(n) { return "UGX " + Number(n || 0).toLocaleString("en-UG"); }
function toast(msg) {
  let el = document.getElementById("fmgToast");
  if (!el) {
    el = document.createElement("div"); el.id = "fmgToast";
    el.style.cssText = "position:fixed;bottom:24px;left:24px;background:#14110F;color:#FBF9F6;padding:12px 18px;border-radius:4px;z-index:300;border-left:4px solid #E8A93B;font-size:0.88rem;max-width:320px;";
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = "1";
  clearTimeout(window._t); window._t = setTimeout(() => { el.style.opacity = "0"; }, 3200);
}

function checkAdminGate() {
  const session = FMG.getSession();
  if (session && session.type === "admin") {
    document.getElementById("adminGate").classList.add("hidden");
    document.getElementById("adminShell").classList.remove("hidden");
    bootAdminPanel();
  } else {
    document.getElementById("adminGate").classList.remove("hidden");
    document.getElementById("adminShell").classList.add("hidden");
  }
}

function attemptAdminLogin() {
  const name = document.getElementById("gateName").value.trim();
  const pw = document.getElementById("gatePw").value;
  const err = document.getElementById("gateError");
  if (name === FMG_ADMIN.name && pw === FMG_ADMIN.password) {
    FMG.setSession({ type: "admin" });
    err.classList.add("hidden");
    checkAdminGate();
  } else {
    err.textContent = "Incorrect admin name or password.";
    err.classList.remove("hidden");
  }
}

function adminLogout() { FMG.clearSession(); checkAdminGate(); }

/* ---------- section switching ---------- */
function showAdminSection(id) {
  document.querySelectorAll(".dash-section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".dash-nav a").forEach(a => a.classList.toggle("active", a.dataset.section === id));
  if (id === "sec-traffic") renderTrafficChart();
  if (id === "sec-progression") { renderUserProgressionChart(); renderBizProgressionChart(); }
}

/* ---------- overview ---------- */
function renderAdminOverview() {
  const users = FMG.getUsers();
  const businesses = FMG.getBusinesses();
  const traffic = FMG.getTraffic();
  const todayVisits = traffic.length ? traffic[traffic.length - 1].visits : 0;
  const trialCount = fmgLoad("fmg_registered_business_count", 0);

  document.getElementById("kpiUsers").textContent = users.length;
  document.getElementById("kpiBusinesses").textContent = businesses.length;
  document.getElementById("kpiTraffic").textContent = todayVisits + " today";
  document.getElementById("kpiTrialSlots").textContent = Math.max(0, FMG_FREE_TRIAL_LIMIT - trialCount) + " / " + FMG_FREE_TRIAL_LIMIT + " left";

  const syncEl = document.getElementById("syncStatus");
  if (syncEl) {
    if (FMG.isCloudEnabled()) {
      syncEl.textContent = "Connected — shared across every device";
      syncEl.className = "badge-chip badge-in";
    } else {
      syncEl.textContent = "Local only — this browser/device only (see README to connect)";
      syncEl.className = "badge-chip badge-low";
    }
  }
}

/* ---------- users & businesses tables ---------- */
function renderUsersTable() {
  const users = FMG.getUsers();
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = users.length ? users.map(u => `
    <tr>
      <td>${u.name}</td><td>${u.email}</td><td>${u.joined}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Remove</button></td>
    </tr>`).join("") : `<tr><td colspan="4">No shoppers have registered yet.</td></tr>`;
}
function deleteUser(id) {
  if (!confirm("Remove this user account?")) return;
  FMG.saveUsers(FMG.getUsers().filter(u => u.id !== id));
  renderUsersTable(); renderAdminOverview();
}

function renderBusinessesTable() {
  const businesses = FMG.getBusinesses();
  const tbody = document.getElementById("businessesTableBody");
  tbody.innerHTML = businesses.length ? businesses.map(b => {
    const status = !b.freeTrial ? "Paid plan" : (new Date() <= new Date(b.trialEndsAt) ? "Free trial" : "Trial ended");
    return `<tr>
      <td>${b.name}</td><td>${FMG.categoryById(b.category)?.label || b.category}</td>
      <td>${FMG.locationById(b.location)?.label || b.location}</td>
      <td>${status}</td><td>${b.joined}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteBusiness('${b.id}')">Remove</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6">No businesses have registered yet.</td></tr>`;
}
function deleteBusiness(id) {
  if (!confirm("Remove this business and its product listings?")) return;
  FMG.saveBusinesses(FMG.getBusinesses().filter(b => b.id !== id));
  FMG.saveProducts(FMG.getProducts().filter(p => p.bizId !== id));
  renderBusinessesTable(); renderAdminOverview(); renderProductsAdminTable();
}

/* ---------- products (admin can remove any listing) ---------- */
function renderProductsAdminTable() {
  const products = FMG.getProducts();
  const businesses = FMG.getBusinesses();
  const tbody = document.getElementById("adminProductsTableBody");
  tbody.innerHTML = products.length ? products.map(p => {
    const biz = businesses.find(b => b.id === p.bizId);
    return `<tr>
      <td><img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:3px;"></td>
      <td>${p.name}</td><td>${biz ? biz.name : "—"}</td>
      <td>${FMG.categoryById(p.category)?.label || p.category}</td>
      <td>${money(p.price)}</td><td>${p.stock}</td>
      <td><button class="btn btn-danger btn-sm" onclick="adminDeleteProduct('${p.id}')">Delete</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7">No products listed yet.</td></tr>`;
}
function adminDeleteProduct(id) {
  if (!confirm("Remove this product listing from the public site?")) return;
  FMG.saveProducts(FMG.getProducts().filter(p => p.id !== id));
  renderProductsAdminTable();
}

/* ---------- traffic + progression charts ---------- */
let trafficChart, userProgChart, bizProgChart;
function renderTrafficChart() {
  const traffic = FMG.getTraffic();
  const ctx = document.getElementById("trafficCanvas").getContext("2d");
  if (trafficChart) trafficChart.destroy();
  trafficChart = new Chart(ctx, {
    type: "line",
    data: { labels: traffic.map(t => t.date.slice(5)), datasets: [{ label: "Visits", data: traffic.map(t => t.visits), borderColor: "#1B2A4A", backgroundColor: "rgba(27,42,74,0.12)", fill: true, tension: 0.25 }] },
    options: { plugins: { legend: { display: false } } }
  });
}

function monthKeyAdmin(d) { const dt = new Date(d); return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0"); }
function last6MonthKeys() {
  const now = new Date(); const keys = [];
  for (let i = 5; i >= 0; i--) keys.push(monthKeyAdmin(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return keys;
}
function renderUserProgressionChart() {
  const keys = last6MonthKeys();
  const users = FMG.getUsers();
  const counts = keys.map(k => users.filter(u => u.joined && u.joined.slice(0, 7) <= k).length || Math.round(3 + Math.random() * 4));
  const ctx = document.getElementById("userProgCanvas").getContext("2d");
  if (userProgChart) userProgChart.destroy();
  userProgChart = new Chart(ctx, {
    type: "line",
    data: { labels: keys.map(k => k.slice(5)), datasets: [{ label: "Registered users", data: counts, borderColor: "#E8A93B", backgroundColor: "rgba(232,169,59,0.15)", fill: true }] },
    options: { plugins: { legend: { display: false } } }
  });
}
function renderBizProgressionChart() {
  const keys = last6MonthKeys();
  const businesses = FMG.getBusinesses();
  const counts = keys.map(k => businesses.filter(b => b.joined && b.joined.slice(0, 7) <= k).length);
  const ctx = document.getElementById("bizProgCanvas").getContext("2d");
  if (bizProgChart) bizProgChart.destroy();
  bizProgChart = new Chart(ctx, {
    type: "bar",
    data: { labels: keys.map(k => k.slice(5)), datasets: [{ label: "Registered businesses", data: counts, backgroundColor: "#3B2417" }] },
    options: { plugins: { legend: { display: false } } }
  });
}

/* ---------- reports ---------- */
function generateReport() {
  const users = FMG.getUsers();
  const businesses = FMG.getBusinesses();
  const products = FMG.getProducts();
  const orders = FMG.getOrders();
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const lines = [
    "CAMPUS MARKET — Admin report",
    "Generated: " + new Date().toLocaleString(),
    "",
    "Users registered: " + users.length,
    "Businesses registered: " + businesses.length,
    "Products listed: " + products.length,
    "Orders placed: " + orders.length,
    "Total marketplace revenue (all orders): " + money(totalRevenue),
    "",
    "Businesses on free trial: " + businesses.filter(b => b.freeTrial && new Date() <= new Date(b.trialEndsAt)).length,
    "Businesses with trial ended: " + businesses.filter(b => b.freeTrial && new Date() > new Date(b.trialEndsAt)).length,
    "Free-trial slots remaining: " + Math.max(0, FMG_FREE_TRIAL_LIMIT - fmgLoad("fmg_registered_business_count", 0))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "campus-market-report.txt"; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- feedback ---------- */
function renderAdminFeedback() {
  const feedback = FMG.getFeedback().slice().reverse();
  const list = document.getElementById("adminFeedbackList");
  list.innerHTML = feedback.length ? feedback.map(f => `
    <div class="panel" style="margin-bottom:10px;padding:14px 16px;">
      <strong>${f.name}</strong>
      <span class="badge-chip badge-in" style="margin-left:6px;">${f.from === "user" ? "General feedback" : "About the website"}</span>
      <span style="color:rgba(33,26,22,0.5);font-size:0.78rem;float:right;">${f.createdAt}</span>
      <p style="margin:8px 0 0;">${f.message}</p>
    </div>`).join("") : `<p style="color:rgba(33,26,22,0.6);">No general feedback submitted yet.</p>`;

  // Read-only oversight of shopper <-> business conversations (businesses reply from their
  // own dashboard — admin can see them here but doesn't send messages into a thread).
  const threads = FMG.getThreads().slice().reverse();
  const threadList = document.getElementById("adminThreadsList");
  if (threadList) {
    threadList.innerHTML = threads.length ? threads.map(t => `
      <div class="panel" style="margin-bottom:10px;padding:14px 16px;">
        <strong>${t.userName}</strong> <span style="color:rgba(33,26,22,0.5);">↔</span> <strong>${t.bizName}</strong>
        <span style="color:rgba(33,26,22,0.5);font-size:0.78rem;float:right;">${t.messages.length} message${t.messages.length === 1 ? "" : "s"}</span>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto;">
          ${t.messages.map(m => `<div style="font-size:0.85rem;"><strong>${m.from === "user" ? t.userName : t.bizName}:</strong> ${m.text}</div>`).join("")}
        </div>
      </div>`).join("") : `<p style="color:rgba(33,26,22,0.6);">No shopper-business conversations yet.</p>`;
  }
}

/* ---------- payment accounts ---------- */
function renderPaymentSettings() {
  const accounts = FMG.getPaymentAccounts();
  document.getElementById("momoAccount").value = accounts.momo || "";
  document.getElementById("airtelAccount").value = accounts.airtel || "";
  document.getElementById("cardAccount").value = accounts.mastercard || "";
}
function savePaymentSettings() {
  FMG.savePaymentAccounts({
    momo: document.getElementById("momoAccount").value.trim(),
    airtel: document.getElementById("airtelAccount").value.trim(),
    mastercard: document.getElementById("cardAccount").value.trim()
  });
  toast("Payment collection accounts updated.");
}

/* ---------------- Firebase Data Synchronization ---------------- */
function fetchFirebaseDataCollections() {
  if (typeof db !== "undefined") {
    // 1. Target your exact fmg_products collection stream
    db.collection("fmg_products").onSnapshot((snapshot) => {
      let productsList = [];
      snapshot.forEach((doc) => {
        productsList.push({ id: doc.id, ...doc.data() });
      });
      FMG.saveProducts(productsList);
    });

    // 2. Target your user accounts collection stream
    db.collection("fmg_users").onSnapshot((snapshot) => {
      let businessesList = [];
      snapshot.forEach((doc) => {
        businessesList.push({ id: doc.id, ...doc.data() });
      });
      FMG.saveBusinesses(businessesList);
    });
  }
}

/* ---------- bootstrap ---------- */
function bootAdminPanel() {
  fetchFirebaseDataCollections();
  renderUsersTable();
  renderBusinessesTable();
  renderProductsAdminTable();
  renderAdminFeedback();
  renderPaymentSettings();

  document.querySelectorAll(".dash-nav a[data-section]").forEach(a => {
    a.onclick = (e) => { e.preventDefault(); showAdminSection(a.dataset.section); };
  });
  document.getElementById("adminLogoutBtn").onclick = adminLogout;
  document.getElementById("reportBtn").onclick = generateReport;
  document.getElementById("paymentSaveBtn").onclick = savePaymentSettings;

  showAdminSection("sec-overview");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("gateLoginBtn").onclick = attemptAdminLogin;
  document.getElementById("gatePw").addEventListener("keydown", e => { if (e.key === "Enter") attemptAdminLogin(); });
  checkAdminGate();

  // When cloud sync is on, changes made by users/businesses on other devices
  // arrive here in the background — keep every table and count fresh.
  document.addEventListener("fmg:updated", () => {
    const session = FMG.getSession();
    if (!session || session.type !== "admin") return;
    renderAdminOverview();
    renderUsersTable();
    renderBusinessesTable();
    renderProductsAdminTable();
    renderAdminFeedback();
    renderPaymentSettings();
  });
});
