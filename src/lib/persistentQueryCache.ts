const DB_NAME = "pricetrack-query-cache";
const STORE_NAME = "queries";
const DB_VERSION = 1;

interface PersistedQuery<T> {
  key: string;
  updatedAt: number;
  data: T;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

export const LONG_LIVED_QUERY_OPTIONS = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
} as const;

export function persistentQueryKey(queryKey: readonly unknown[]) {
  return JSON.stringify(queryKey);
}

function openCacheDb() {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

export async function readPersistentQuery<T>(queryKey: readonly unknown[]) {
  const db = await openCacheDb();
  if (!db) return null;

  return new Promise<PersistedQuery<T> | null>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(persistentQueryKey(queryKey));

    request.onsuccess = () => resolve((request.result as PersistedQuery<T> | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function writePersistentQuery<T>(queryKey: readonly unknown[], data: T) {
  const db = await openCacheDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key: persistentQueryKey(queryKey), updatedAt: Date.now(), data });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function removePersistentQuery(queryKey: readonly unknown[]) {
  const db = await openCacheDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(persistentQueryKey(queryKey));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}
