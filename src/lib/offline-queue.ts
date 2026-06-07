/**
 * IndexedDB-backed queue for food log entries created while offline.
 * Entries are processed (synced) by the OfflineSync component when
 * the user comes back online.
 */

export interface QueuedFoodLog {
  id: string
  foodItemId: string
  mealSlot: string
  quantity: number
  date: string
  queuedAt: number
  /** Snapshot of the food item name for display while queued */
  foodItemName: string
}

const DB_NAME = 'trifuel-offline-v1'
const STORE = 'food-log-queue'
const DB_VERSION = 1

// ── DB open ────────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function enqueueLog(entry: Omit<QueuedFoodLog, 'id' | 'queuedAt'>): Promise<string> {
  const db = await openDB()
  const id = crypto.randomUUID()
  const record: QueuedFoodLog = { ...entry, id, queuedAt: Date.now() }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add(record)
    req.onsuccess = () => resolve(id)
    req.onerror = () => reject(req.error)
  })
}

export async function getQueuedLogs(): Promise<QueuedFoodLog[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () =>
      resolve((req.result as QueuedFoodLog[]).sort((a, b) => a.queuedAt - b.queuedAt))
    req.onerror = () => reject(req.error)
  })
}

export async function dequeueLog(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
