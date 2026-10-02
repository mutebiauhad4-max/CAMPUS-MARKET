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
      
      // Critical Fix: Force global engine exposure to point directly to updated arrays
      if (typeof FMG !== "undefined") {
        if (localKey === "fmg_products") FMG._products = items;
        if (localKey === "fmg_businesses") FMG._businesses = items;
        if (localKey === "fmg_users") FMG._users = items;
        if (localKey === "fmg_orders") FMG._orders = items;
      }
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
    console.warn("FMG_CLOUD_ENABLED is true but the Firebase scripts didn't load — running in local mode.");
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
    console.error("Could not start cloud sync — check FMG_FIREBASE_CONFIG:", e);
    fmgCloudReady = false;
  }
}
