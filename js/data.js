/* ============================================================
   CAMPUS MARKET — data.js (FIXED BUNDLE)
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

/* ---------- optional cloud sync (Firestore) ---------- */

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
      // Force recalculation for meta metrics counters
      if (localKey === "fmg_businesses") {
        fmgSave("fmg_registered_business_count", items.length);
        fmgNotifyUpdated("fmg_registered_business_count");
      }
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
    console.warn("FMG_CLOUD_ENABLED is true but the Firebase scripts didn't load.");
    return;
  }
  try {
    // Only initialize if no apps are active yet to prevent configuration crashing
    if (!firebase.apps.length) {
      firebase.initializeApp(FMG_FIREBASE_CONFIG);
    }
    fmgDB = firebase.firestore();
    fmgCloudReady = true;
    
    // Begin listening to real-time streams
    fmgWatchList("fmg_products", "fmg_products");
    fmgWatchList("fmg_businesses", "fmg_businesses");
    fmgWatchList("fmg_users", "fmg_users");
    fmgWatchList("fmg_orders", "fmg_orders");
    fmgWatchList("fmg_feedback", "fmg_feedback");
    fmgWatchList("fmg_threads", "fmg_threads");
    fmgWatchMeta("payment_accounts", "fmg_payment_accounts", {});
    fmgWatchMeta("registered_business_count", "fmg_registered_business_count", 0);
    
    console.log("🔥 Firebase Pipeline Successfully Locked & Syncing.");
  } catch (e) {
    console.error("Could not start cloud sync:", e);
    fmgCloudReady = false;
  }
}

/* ---------- placeholder art ---------- */
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
  if (typeof FMG_CLOUD_ENABLED !== "undefined" && FMG_CLOUD_ENABLED) return; 
  if (fmgLoad("fmg_seeded", false)) return;

  const businesses = [
    { id: "biz_kasese_electro", name: "Kasese Electro Hub", email: "kasese.electro@example.com", password: "demo1234",
      category: "electronics", location: "kampala", bio: "Phones, accessories and home electronics at fair prices.",
      joined: "2026-02-11", freeTrial: true, trialEndsAt: "2026-08-11",
      paymentMethods: fmgEmptyPaymentMethods() }
  ];
  fmgSave("fmg_businesses", businesses);
  fmgSave("fmg_seeded", true);
}

// CRITICAL FIX: Automatically execute the cloud engine setup on script bundle entry
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", fmgInitCloud);
} else {
  fmgInitCloud();
}
