/* ============================================================
   CAMPUS MARKET — data.js
   Shared data layer. By default everything is stored in the
   browser via localStorage, which is enough to demo the site on
   one device but is never shared between devices or browsers.

   If js/firebase-config.js has FMG_CLOUD_ENABLED set to true, this
   file also mirrors products, businesses, users, orders and
   feedback to a free shared Firestore database in the background,
   so every device sees the same marketplace. See firebase-config.js
   for the 5-minute setup. Every other file only ever calls the FMG
   object below — none of them know or care whether the data behind
   it is local-only or cloud-synced.
   ============================================================ */

const FMG_ADMIN = { name: "ADMIN GROUP A", password: "KU MASAKA" };

const FMG_CATEGORIES = [
  { id: "electronics", label: "Electronics", icon: "electronics" },
  { id: "fashion", label: "Fashion", icon: "fashion" },
  { id: "office", label: "Office", icon: "office" },
  { id: "machinery", label: "Machinery", icon: "machinery" },
  { id: "home", label: "Home & Living", icon: "home" },
  { id: "agriculture", label: "Agriculture", icon: "agriculture" }
];

const FMG_LOCATIONS = [
  { id: "masaka", label: "Masaka", lat: -0.3372, lng: 31.7345 },
  { id: "ssembabule", label: "Ssembabule", lat: -0.0904, lng: 31.4534 },
  { id: "kampala", label: "Kampala", lat: 0.3476, lng: 32.5825 },
  { id: "gayaza", label: "Gayaza", lat: 0.4907, lng: 32.6167 },
  { id: "kyotera", label: "Kyotera", lat: -0.6193, lng: 31.5253 },
  { id: "kumasaka", label: "Kampala University Masaka", lat: -0.3406, lng: 31.7331 }
];

const FMG_FREE_TRIAL_LIMIT = 100;
const FMG_FREE_TRIAL_MONTHS = 6;
const FMG_MAX_DELIVERY_FEE = 10000; // UGX — hard cap a business can charge for delivery to any one point

const FMG_PAYMENT_METHODS = [
  { id: "momo", label: "MTN MoMo Pay", field: "number", fieldLabel: "MoMo phone number" },
  { id: "airtel", label: "Airtel Pay", field: "number", fieldLabel: "Airtel phone number" },
  { id: "mastercard", label: "Mastercard", field: "merchantId", fieldLabel: "Merchant ID" }
];

function fmgEmptyPaymentMethods() {
  return {
    momo: { enabled: false, number: "" },
    airtel: { enabled: false, number: "" },
    mastercard: { enabled: false, merchantId: "" }
  };
}

/* ---------- tiny local "database" helpers ---------- */

function fmgLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function fmgSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage full or unavailable:", e);
  }
}
function fmgId(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- optional cloud sync (Firestore) ----------
   Off by default. Turned on by setting FMG_CLOUD_ENABLED = true in
   js/firebase-config.js, which is loaded before this file. Everything
   here fails silently back to local-only mode if that file is missing,
   the flag is off, or the Firebase scripts didn't load — the site
   never breaks because of this layer. */

let fmgDB = null;
let fmgCloudReady = false;

function fmgNotifyUpdated(key) {
  document.dispatchEvent(new CustomEvent("fmg:updated", { detail: { key } }));
}

function fmgWatchList(collectionName, localKey) {
  fmgDB.collection(collectionName).onSnapshot(
    snap => {
      const items = snap.docs.map(d => d.data());
      fmgSave(localKey, items);
      fmgNotifyUpdated(localKey);
    },
    err => console.error("Cloud sync (read) failed for", collectionName, err)
  );
}

function fmgWatchMeta(docId, localKey, fallback) {
  fmgDB.collection("fmg_meta").doc(docId).onSnapshot(
    doc => {
      const value = doc.exists ? doc.data().value : fallback;
      fmgSave(localKey, value);
      fmgNotifyUpdated(localKey);
    },
    err => console.error("Cloud sync (read) failed for", docId, err)
  );
}

function fmgSyncListToCloud(collectionName, previousList, newList) {
  if (!fmgCloudReady) return;
  const prevIds = new Set(previousList.map(x => x.id));
  const newIds = new Set(newList.map(x => x.id));
  newList.forEach(item => {
    fmgDB.collection(collectionName).doc(String(item.id)).set(item)
      .catch(err => console.error("Cloud sync (write) failed for", collectionName, item.id, err));
  });
  prevIds.forEach(id => {
    if (!newIds.has(id)) {
      fmgDB.collection(collectionName).doc(String(id)).delete()
        .catch(err => console.error("Cloud sync (delete) failed for", collectionName, id, err));
    }
  });
}

function fmgSaveSynced(collectionName, localKey, list) {
  const previous = fmgLoad(localKey, []);
  fmgSave(localKey, list);
  fmgSyncListToCloud(collectionName, previous, list);
}

function fmgSyncMetaToCloud(docId, value) {
  if (!fmgCloudReady) return;
  fmgDB.collection("fmg_meta").doc(docId).set({ value })
    .catch(err => console.error("Cloud sync (write) failed for", docId, err));
}

function fmgInitCloud() {
  if (typeof FMG_CLOUD_ENABLED === "undefined" || !FMG_CLOUD_ENABLED) return;
  if (typeof firebase === "undefined") {
    console.warn("FMG_CLOUD_ENABLED is true but the Firebase scripts didn't load — " +
      "check your internet connection and script tags. Running in local-only mode for now.");
    return;
  }
  try {
    firebase.initializeApp(FMG_FIREBASE_CONFIG);
    fmgDB = firebase.firestore();
    fmgCloudReady = true;
    fmgWatchList("fmg_products", "fmg_products");
    fmgWatchList("fmg_businesses", "fmg_businesses");
    fmgWatchList("fmg_users", "fmg_users");
    fmgWatchList("fmg_orders", "fmg_orders");
    fmgWatchList("fmg_feedback", "fmg_feedback");
    fmgWatchList("fmg_threads", "fmg_threads");
    fmgWatchMeta("payment_accounts", "fmg_payment_accounts", {});
    fmgWatchMeta("registered_business_count", "fmg_registered_business_count", 0);
  } catch (e) {
    console.error("Could not start cloud sync — check FMG_FIREBASE_CONFIG. Falling back to local-only mode:", e);
    fmgCloudReady = false;
  }
}

/* ---------- placeholder art (no external image hosting needed) ----------
   Businesses upload real photos (stored as compressed data URLs — see
   js/main.js compressImage()). Until a photo is uploaded, or for the demo
   catalogue, we render a light, on-brand SVG tile so the grid never shows
   broken images and never depends on outside servers. */
function fmgPlaceholder(category, seedText) {
  const palettes = {
    electronics: ["#1B2A4A", "#E8A93B"],
    fashion: ["#3B2417", "#E8A93B"],
    office: ["#14110F", "#C7CBD1"],
    machinery: ["#2B2016", "#E8A93B"],
    home: ["#3B2417", "#FBF9F6"],
    agriculture: ["#1B2A4A", "#8FAE6B"]
  };
  const [bg, fg] = palettes[category] || ["#14110F", "#E8A93B"];
  const initials = (seedText || category).trim().slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${bg}"/>
    <circle cx="330" cy="40" r="90" fill="${fg}" opacity="0.12"/>
    <circle cx="40" cy="270" r="110" fill="${fg}" opacity="0.1"/>
    <text x="200" y="168" font-family="Georgia, serif" font-size="72" fill="${fg}" text-anchor="middle" opacity="0.9">${initials}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/* ---------- seed content (first run only) ---------- */

function fmgSeed() {
  if (typeof FMG_CLOUD_ENABLED !== "undefined" && FMG_CLOUD_ENABLED) return; // cloud mode starts empty — real sign-ups only
  if (fmgLoad("fmg_seeded", false)) return;

  const businesses = [
    { id: "biz_kasese_electro", name: "Kasese Electro Hub", email: "kasese.electro@example.com", password: "demo1234",
      category: "electronics", location: "kampala", bio: "Phones, accessories and home electronics at fair prices.",
      joined: "2026-02-11", freeTrial: true, trialEndsAt: "2026-08-11",
      paymentMethods: { momo: { enabled: true, number: "+256 701 222 333" }, airtel: { enabled: false, number: "" },
                         mastercard: { enabled: true, merchantId: "KEH-MC-001" } } },
    { id: "biz_masaka_threads", name: "Masaka Threads", email: "masaka.threads@example.com", password: "demo1234",
      category: "fashion", location: "masaka", bio: "Locally tailored fashion for men, women and children.",
      joined: "2026-03-02", freeTrial: true, trialEndsAt: "2026-09-02",
      paymentMethods: { momo: { enabled: true, number: "+256 772 444 555" }, airtel: { enabled: true, number: "+256 752 444 555" },
                         mastercard: { enabled: false, merchantId: "" } } },
    { id: "biz_gayaza_office", name: "Gayaza Office Supplies", email: "gayaza.office@example.com", password: "demo1234",
      category: "office", location: "gayaza", bio: "Stationery, furniture and printing supplies for every office.",
      joined: "2026-04-18", freeTrial: true, trialEndsAt: "2026-10-18",
      paymentMethods: { momo: { enabled: true, number: "+256 703 666 777" }, airtel: { enabled: false, number: "" },
                         mastercard: { enabled: true, merchantId: "GOS-MC-014" } } },
    { id: "biz_kyotera_agro", name: "Kyotera Agro Machines", email: "kyotera.agro@example.com", password: "demo1234",
      category: "machinery", location: "kyotera", bio: "Farm machinery, irrigation tools and spare parts.",
      joined: "2026-01-27", freeTrial: true, trialEndsAt: "2026-07-27",
      paymentMethods: { momo: { enabled: true, number: "+256 782 888 999" }, airtel: { enabled: true, number: "+256 754 888 999" },
                         mastercard: { enabled: false, merchantId: "" } } }
  ];

  // Demo delivery/pickup coverage per seeded business (matches the "Delivery & pickup" section) —
  // gives the checkout flow real fee data to compute against in a fresh demo.
  const bizLocations = {
    biz_kasese_electro: ["kampala", "gayaza"],
    biz_masaka_threads: ["masaka", "kumasaka", "ssembabule"],
    biz_gayaza_office: ["gayaza", "kampala"],
    biz_kyotera_agro: ["kyotera", "masaka"]
  };
  Object.entries(bizLocations).forEach(([bizId, locs]) => fmgSave("fmg_biz_locations_" + bizId, locs));

  const products = [
    { name: "Dual-SIM Smartphone", category: "electronics", bizId: "biz_kasese_electro", price: 620000, discount: 10, stock: 24,
      desc: "6.5\" display, 128GB storage, dual camera. Great value entry smartphone.",
      deliveryEnabled: true, deliveryFees: { kampala: 5000, gayaza: 7000 } },
    { name: "Bluetooth Speaker", category: "electronics", bizId: "biz_kasese_electro", price: 95000, discount: 0, stock: 40,
      desc: "Portable speaker with 12-hour battery life and deep bass.",
      deliveryEnabled: true, deliveryFees: { kampala: 3000, gayaza: 4000 } },
    { name: "Solar Charging Kit", category: "electronics", bizId: "biz_kasese_electro", price: 180000, discount: 15, stock: 12,
      desc: "Solar panel with two USB ports, ideal for areas with unreliable power.",
      deliveryEnabled: false, deliveryFees: {} },
    { name: "Men's Tailored Suit", category: "fashion", bizId: "biz_masaka_threads", price: 260000, discount: 0, stock: 8,
      desc: "Made-to-measure two-piece suit, locally tailored in Masaka.",
      deliveryEnabled: true, deliveryFees: { masaka: 2000, kumasaka: 2000, ssembabule: 6000 } },
    { name: "Ankara Print Dress", category: "fashion", bizId: "biz_masaka_threads", price: 85000, discount: 20, stock: 15,
      desc: "Vibrant Ankara print, available in multiple sizes.",
      deliveryEnabled: true, deliveryFees: { masaka: 2000, kumasaka: 2000, ssembabule: 6000 } },
    { name: "Kids School Uniform Set", category: "fashion", bizId: "biz_masaka_threads", price: 45000, discount: 0, stock: 30,
      desc: "Durable school uniform set, sizes for ages 5 to 14.",
      deliveryEnabled: false, deliveryFees: {} },
    { name: "Office Desk (1.2m)", category: "office", bizId: "biz_gayaza_office", price: 310000, discount: 5, stock: 10,
      desc: "Sturdy wood-finish office desk with drawer storage.",
      deliveryEnabled: true, deliveryFees: { gayaza: 8000, kampala: 10000 } },
    { name: "Ream of A4 Paper (5-pack)", category: "office", bizId: "biz_gayaza_office", price: 60000, discount: 0, stock: 100,
      desc: "High quality 80gsm printing paper, five reams.",
      deliveryEnabled: true, deliveryFees: { gayaza: 2000, kampala: 4000 } },
    { name: "Ergonomic Office Chair", category: "office", bizId: "biz_gayaza_office", price: 220000, discount: 12, stock: 18,
      desc: "Adjustable height, lumbar support, mesh back.",
      deliveryEnabled: false, deliveryFees: {} },
    { name: "Water Pump (2 inch)", category: "machinery", bizId: "biz_kyotera_agro", price: 540000, discount: 0, stock: 6,
      desc: "Petrol-powered water pump for irrigation, 2-inch outlet.",
      deliveryEnabled: false, deliveryFees: {} },
    { name: "Maize Milling Machine", category: "machinery", bizId: "biz_kyotera_agro", price: 2400000, discount: 8, stock: 3,
      desc: "Diesel-powered milling machine, 200kg/hour capacity.",
      deliveryEnabled: false, deliveryFees: {} },
    { name: "Hand Hoe Set (10-pack)", category: "machinery", bizId: "biz_kyotera_agro", price: 150000, discount: 0, stock: 25,
      desc: "Ten durable hand hoes for farm and garden work.",
      deliveryEnabled: true, deliveryFees: { kyotera: 3000, masaka: 6000 } }
  ];

  const seededBiz = businesses.map(b => ({ ...b, role: "business" }));
  const seededProducts = products.map(p => ({
    id: fmgId("prod"),
    name: p.name,
    category: p.category,
    bizId: p.bizId,
    price: p.price,
    discount: p.discount,
    stock: p.stock,
    desc: p.desc,
    deliveryEnabled: !!p.deliveryEnabled,
    deliveryFees: p.deliveryFees || {},
    image: fmgPlaceholder(p.category, p.name),
    createdAt: new Date().toISOString(),
    views: Math.floor(Math.random() * 300) + 20
  }));

  fmgSave("fmg_businesses", seededBiz);
  fmgSave("fmg_products", seededProducts);
  fmgSave("fmg_users", []);
  fmgSave("fmg_orders", []);
  fmgSave("fmg_cart", []);
  fmgSave("fmg_threads", []);
  fmgSave("fmg_feedback", [
    { id: fmgId("fb"), from: "user", name: "Grace N.", message: "I love how easy it is to find fashion items from Masaka sellers!", createdAt: "2026-05-02" }
  ]);
  fmgSave("fmg_traffic", fmgGenerateTraffic());
  fmgSave("fmg_payment_accounts", { momo: "+256 700 000 000 (GROUP A KU MASAKA)", airtel: "+256 750 000 000 (GROUP A KU MASAKA)", mastercard: "Merchant ID: KUM-2026-FMG-001" });
  fmgSave("fmg_registered_business_count", businesses.length);
  fmgSave("fmg_seeded", true);
}

function fmgGenerateTraffic() {
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), visits: Math.floor(Math.random() * 400) + 150 });
  }
  return days;
}

/* ---------- accessors used by the rest of the app ---------- */

const FMG = {
  categories: FMG_CATEGORIES,
  locations: FMG_LOCATIONS,

  getProducts() { return fmgLoad("fmg_products", []); },
  saveProducts(list) { fmgSaveSynced("fmg_products", "fmg_products", list); },

  getBusinesses() { return fmgLoad("fmg_businesses", []); },
  saveBusinesses(list) { fmgSaveSynced("fmg_businesses", "fmg_businesses", list); },

  getUsers() { return fmgLoad("fmg_users", []); },
  saveUsers(list) { fmgSaveSynced("fmg_users", "fmg_users", list); },

  getOrders() { return fmgLoad("fmg_orders", []); },
  saveOrders(list) { fmgSaveSynced("fmg_orders", "fmg_orders", list); },

  getCart() { return fmgLoad("fmg_cart", []); },
  saveCart(list) { fmgSave("fmg_cart", list); },

  getFeedback() { return fmgLoad("fmg_feedback", []); },
  saveFeedback(list) { fmgSaveSynced("fmg_feedback", "fmg_feedback", list); },

  getThreads() { return fmgLoad("fmg_threads", []); },
  saveThreads(list) { fmgSaveSynced("fmg_threads", "fmg_threads", list); },

  getTraffic() { return fmgLoad("fmg_traffic", []); },

  getPaymentAccounts() { return fmgLoad("fmg_payment_accounts", {}); },
  savePaymentAccounts(v) { fmgSave("fmg_payment_accounts", v); fmgSyncMetaToCloud("payment_accounts", v); },

  getSession() { return fmgLoad("fmg_session", null); },
  setSession(v) { fmgSave("fmg_session", v); },
  clearSession() { localStorage.removeItem("fmg_session"); },

  getConsent() { return fmgLoad("fmg_consent", null); },
  setConsent(v) { fmgSave("fmg_consent", v); },

  businessById(id) { return this.getBusinesses().find(b => b.id === id); },
  locationById(id) { return FMG_LOCATIONS.find(l => l.id === id); },
  categoryById(id) { return FMG_CATEGORIES.find(c => c.id === id); },

  paymentMethods: FMG_PAYMENT_METHODS,
  emptyPaymentMethods: fmgEmptyPaymentMethods,
  maxDeliveryFee: FMG_MAX_DELIVERY_FEE,

  // Payment methods a single business actually has switched on AND filled in an account for.
  businessOfferedMethods(biz) {
    const pm = (biz && biz.paymentMethods) || fmgEmptyPaymentMethods();
    return FMG_PAYMENT_METHODS.filter(m => {
      const entry = pm[m.id] || {};
      return entry.enabled && String(entry[m.field] || "").trim().length > 0;
    }).map(m => m.id);
  },

  // The payment methods every business represented in this cart can accept in common —
  // a shopper can only check out together if there is at least one shared method.
  commonOfferedMethods(cart) {
    const products = this.getProducts();
    const businesses = this.getBusinesses();
    const bizIds = new Set();
    cart.forEach(c => {
      const p = products.find(x => x.id === c.productId);
      if (p) bizIds.add(p.bizId);
    });
    if (bizIds.size === 0) return [];
    let common = null;
    bizIds.forEach(id => {
      const biz = businesses.find(b => b.id === id);
      const offered = new Set(this.businessOfferedMethods(biz));
      common = common === null ? offered : new Set([...common].filter(m => offered.has(m)));
    });
    return FMG_PAYMENT_METHODS.filter(m => common && common.has(m.id)).map(m => m.id);
  },

  // Delivery fee for one product to one location, clamped to the platform cap either way.
  productDeliveryFee(product, locationId) {
    if (!product || !product.deliveryEnabled || !locationId) return 0;
    const fee = (product.deliveryFees || {})[locationId];
    if (!fee || fee <= 0) return 0;
    return Math.min(fee, FMG_MAX_DELIVERY_FEE);
  },

  // Total delivery fee for a cart at one chosen location: once per distinct product, not per unit.
  cartDeliveryFee(cart, locationId) {
    const products = this.getProducts();
    let total = 0;
    cart.forEach(c => {
      const p = products.find(x => x.id === c.productId);
      total += this.productDeliveryFee(p, locationId);
    });
    return total;
  },

  placeholder: fmgPlaceholder,
  uid: fmgId,

  isCloudEnabled() { return fmgCloudReady; },

  isFreeTrialAvailable() {
    return fmgLoad("fmg_registered_business_count", 0) < FMG_FREE_TRIAL_LIMIT;
  },
  registerBusinessTrialSlot() {
    const n = fmgLoad("fmg_registered_business_count", 0);
    const next = n + 1;
    fmgSave("fmg_registered_business_count", next);
    fmgSyncMetaToCloud("registered_business_count", next);
    return n < FMG_FREE_TRIAL_LIMIT;
  }
};

fmgSeed();
fmgInitCloud();

// Automatically expose business profiles matching by registration text names
FMG.businessById = function(bizId) {
  const businesses = this.getBusinesses();
  const foundBiz = businesses.find(b => b.id === bizId || b.bizId === bizId);
  return {
    id: bizId,
    name: foundBiz ? (foundBiz.name || foundBiz.businessName || "Unnamed Store") : "Loading Store...",
    location: foundBiz ? (foundBiz.location || "general") : "general"
  };
};
