/* ============================================================
   CAMPUS MARKET — data.js (FIXED BINDING EDITION)
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
const FMG_MAX_DELIVERY_FEE = 10000;

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
    console.error("Storage full:", e);
  }
}

function fmgId(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let fmgDB = null;
let fmgCloudReady = false;

function fmgNotifyUpdated(key) {
  document.dispatchEvent(new CustomEvent("fmg:updated", { detail: { key } }));
  if (typeof bootAdminPanel === "function") { bootAdminPanel(); }
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
    fmgDB.collection(collectionName).doc(String(item.id || item.bizId)).set(item)
      .catch(err => console.error("Cloud sync write error:", collectionName, err));
  });
  prevIds.forEach(id => {
    if (!newIds.has(id)) {
      fmgDB.collection(collectionName).doc(String(id)).delete()
        .catch(err => console.error("Cloud sync delete error:", collectionName, err));
    }
  });
}

function fmgSaveSynced(collectionName, localKey, list) {
  const previous = fmgLoad(localKey, []);
  fmgSave(localKey, list);
  fmgSyncListToCloud(collectionName, previous, list);
}

const FMG = {
  categories: FMG_CATEGORIES,
  isCloudEnabled: () => fmgCloudReady,
  getSession: () => fmgLoad("fmg_session", null),
  setSession: (s) => fmgSave("fmg_session", s),
  clearSession: () => localStorage.removeItem("fmg_session"),
  getProducts: () => fmgLoad("fmg_products", []),
  saveProducts: (list) => fmgSaveSynced("fmg_products", "fmg_products", list),
  getBusinesses: () => fmgLoad("fmg_businesses", []),
  saveBusinesses: (list) => fmgSaveSynced("fmg_businesses", "fmg_businesses", list),
  getUsers: () => fmgLoad("fmg_users", []),
  saveUsers: (list) => fmgSaveSynced("fmg_users", "fmg_users", list),
  getOrders: () => fmgLoad("fmg_orders", []),
  getTraffic: () => fmgLoad("fmg_traffic", []),
  categoryById: (id) => FMG_CATEGORIES.find(c => c.id === id),
  locationById: (id) => FMG_LOCATIONS.find(l => l.id === id),
  businessById: (id) => fmgLoad("fmg_businesses", []).find(b => b.id === id)
};

function fmgInitCloud() {
  if (typeof FMG_CLOUD_ENABLED === "undefined" || !FMG_CLOUD_ENABLED) return;
  try {
    if (!firebase.apps.length) { firebase.initializeApp(FMG_FIREBASE_CONFIG); }
    fmgDB = firebase.firestore();
    fmgCloudReady = true;
    fmgWatchList("fmg_products", "fmg_products");
    fmgWatchList("fmg_businesses", "fmg_businesses");
    fmgWatchList("fmg_users", "fmg_users");
    fmgWatchList("fmg_orders", "fmg_orders");
    fmgWatchMeta("payment_accounts", "fmg_payment_accounts", {});
    fmgWatchMeta("traffic_stats", "fmg_traffic", []);
  } catch (e) {
    console.error("Cloud setup crashed:", e);
    fmgCloudReady = false;
  }
}
document.addEventListener("DOMContentLoaded", fmgInitCloud);
