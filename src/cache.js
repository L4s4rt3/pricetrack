const DB_NAME = 'pricetrack-cache'
const DB_VERSION = 1
const STORE = 'precios'
const META = 'meta'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveToCache(data) {
  const db = await openDB()
  // Batch insert in chunks to avoid memory spikes
  const CHUNK = 5000
  for (let i = 0; i < data.length; i += CHUNK) {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const chunk = data.slice(i, i + CHUNK)
    // Clear store on first chunk
    if (i === 0) await store.clear()
    for (const row of chunk) store.put(row)
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }
  const metaTx = db.transaction(META, 'readwrite')
  metaTx.objectStore(META).put({ key: 'count', value: data.length })
  metaTx.objectStore(META).put({ key: 'updated', value: Date.now() })
  await new Promise((resolve, reject) => {
    metaTx.oncomplete = resolve
    metaTx.onerror = () => reject(metaTx.error)
  })
  db.close()
}

export async function loadFromCache() {
  const db = await openDB()
  const data = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return data.length ? data : null
}

export async function getCachedCount() {
  try {
    const db = await openDB()
    const val = await new Promise((resolve, reject) => {
      const tx = db.transaction(META, 'readonly')
      const req = tx.objectStore(META).get('count')
      req.onsuccess = () => resolve(req.result?.value ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return val
  } catch { return null }
}

export async function getCachedTimestamp() {
  try {
    const db = await openDB()
    const val = await new Promise((resolve, reject) => {
      const tx = db.transaction(META, 'readonly')
      const req = tx.objectStore(META).get('updated')
      req.onsuccess = () => resolve(req.result?.value ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return val
  } catch { return null }
}

export async function clearCache() {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  await tx.objectStore(STORE).clear()
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  const metaTx = db.transaction(META, 'readwrite')
  await metaTx.objectStore(META).clear()
  await new Promise((resolve, reject) => {
    metaTx.oncomplete = resolve
    metaTx.onerror = () => reject(metaTx.error)
  })
  db.close()
}
