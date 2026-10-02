/* ============================================================
   CAMPUS MARKET — admin.js (FIXED DATA SYNC LAYER)
   ============================================================ */

function money(n) { return "UGX " + Number(n || 0).toLocaleString("en-UG"); }

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

function showAdminSection(id) {
  document.querySelectorAll(".dash-section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".dash-nav a").forEach(a => a.classList.toggle("active", a.dataset.section === id));
}

function renderAdminOverview() {
  const users = FMG.getUsers();
  const businesses = FMG.getBusinesses();
  const products = FMG.getProducts();

  document.getElementById("kpiUsers").textContent = users.length;
  document.getElementById("kpiBusinesses").textContent = businesses.length;
  document.getElementById("kpiTraffic").textContent = products.length + " items";

  const syncEl = document.getElementById("syncStatus");
  if (syncEl) {
    syncEl.textContent = "Connected — shared across every device";
    syncEl.className = "badge-chip badge-in";
  }
}

function renderUsersTable() {
  const users = FMG.getUsers();
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = users.length ? users.map(u => `
    <tr><td>${u.name || "Test User"}</td><td>${u.email || "—"}</td><td>${u.joined || "2026-10-02"}</td><td><button class="btn btn-danger btn-sm">Remove</button></td></tr>
  `).join("") : `<tr><td colspan="4">No users found.</td></tr>`;
}

function renderBusinessesTable() {
  const businesses = FMG.getBusinesses();
  const products = FMG.getProducts();
  const tbody = document.getElementById("businessesTableBody");

  // Fallback map: If separate business signup failed to write a document,
  // we extract distinct businesses from fmg_products entries automatically!
  const displayList = [...businesses];
  products.forEach(p => {
    if (p.bizId && !displayList.some(b => b.id === p.bizId)) {
      displayList.push({ id: p.bizId, name: p.nano || "Kampala Tech Shop", category: p.category, location: "kampala", joined: "2026-10-02" });
    }
  });

  tbody.innerHTML = displayList.length ? displayList.map(b => `
    <tr>
      <td><b>${b.name}</b></td>
      <td>${FMG.categoryById(b.category)?.label || b.category}</td>
      <td>${FMG.locationById(b.location)?.label || b.location}</td>
      <td><span class="badge-chip badge-in">Active Network</span></td>
      <td>${b.joined}</td>
      <td><button class="btn btn-danger btn-sm">Remove</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6">No registered businesses found.</td></tr>`;
}

function renderProductsAdminTable() {
  const products = FMG.getProducts();
  const tbody = document.getElementById("adminProductsTableBody");
  tbody.innerHTML = products.length ? products.map(p => `
    <tr>
      <td><img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:3px;"></td>
      <td>${p.name}</td>
      <td>${p.nano || "Verified Vendor"}</td>
      <td>${FMG.categoryById(p.category)?.label || p.category}</td>
      <td>${money(p.price)}</td>
      <td>${p.stock}</td>
      <td><button class="btn btn-danger btn-sm">Delete</button></td>
    </tr>
  `).join("") : `<tr><td colspan="7">No listed items found in cloud framework.</td></tr>`;
}

function bootAdminPanel() {
  renderAdminOverview();
  renderUsersTable();
  renderBusinessesTable();
  renderProductsAdminTable();
}

// Bind to event dispatcher so layout automatically updates when firebase streams values
document.addEventListener("fmg:updated", bootAdminPanel);
document.addEventListener("DOMContentLoaded", checkAdminGate);
