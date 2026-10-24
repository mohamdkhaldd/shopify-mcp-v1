// The database file lives in the app's own storage on the tablet (IndexedDB),
// saved a second after any change and right away when the app goes to the
// background. Uninstalling the app deletes it — the cloud copy (sync) stays.
// One file per program: "main" (التأجير, also the activation) and "operations" (التشغيل).
const IDB_NAME = "albunyan-rental";
const IDB_STORE = "db";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSaved(key = "main"): Promise<Uint8Array | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function save(bytes: Uint8Array, key = "main"): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
