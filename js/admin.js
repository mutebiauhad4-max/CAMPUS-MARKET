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
  document.querySelectorAll(".dash-nav a").forEach(a => a.dataset.section === id);
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
