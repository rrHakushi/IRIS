/**
 * IRIS Pass — IndexedDB Storage Engine
 * Stores sensitive credentials, encrypted ciphers, PIN unlock metadata, and session tokens
 * in an isolated IndexedDB database under the extension's privileged origin.
 * Web pages & external scripts have zero access to this storage.
 */

; (function (root) {
  const DB_NAME = "iris_pass_db"
  const DB_VERSION = 1
  const STORE_NAME = "vault_store"

  let dbPromise = null

  function getDB() {
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this environment"))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" })
        }
      }

      request.onsuccess = (event) => {
        const db = event.target.result
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }

      request.onerror = (event) => {
        console.error("[IRIS Storage] IndexedDB open error:", event.target.error)
        reject(event.target.error)
      }
    })

    return dbPromise
  }

  const IrisStorage = {
    /**
     * Get one, multiple, or all values from IndexedDB
     * @param {string|string[]|null} [keys]
     * @returns {Promise<Record<string, any>>}
     */
    async get(keys) {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const result = {}

        if (!keys) {
          // Get all records
          const req = store.getAll()
          req.onsuccess = () => {
            const rows = req.result || []
            for (const row of rows) {
              result[row.key] = row.value
            }
            resolve(result)
          }
          req.onerror = () => reject(req.error)
          return
        }

        const keyList = Array.isArray(keys) ? keys : [keys]
        if (keyList.length === 0) {
          resolve({})
          return
        }

        let completed = 0
        for (const k of keyList) {
          const req = store.get(k)
          req.onsuccess = () => {
            if (req.result && req.result.value !== undefined) {
              result[k] = req.result.value
            }
            completed++
            if (completed === keyList.length) {
              resolve(result)
            }
          }
          req.onerror = () => {
            completed++
            if (completed === keyList.length) {
              resolve(result)
            }
          }
        }
      })
    },

    /**
     * Set one or multiple key-value pairs into IndexedDB
     * @param {Record<string, any>} items
     * @returns {Promise<void>}
     */
    async set(items) {
      if (!items || typeof items !== "object") return
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)

        for (const [key, value] of Object.entries(items)) {
          store.put({ key, value })
        }
      })
    },

    /**
     * Remove one or multiple keys from IndexedDB
     * @param {string|string[]} keys
     * @returns {Promise<void>}
     */
    async remove(keys) {
      if (!keys) return
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)

        const keyList = Array.isArray(keys) ? keys : [keys]
        for (const k of keyList) {
          store.delete(k)
        }
      })
    },

    /**
     * Clear all records in the vault store
     * @returns {Promise<void>}
     */
    async clear() {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)
        const req = store.clear()
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    },
  }

  // Export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = IrisStorage
  } else {
    root.IrisStorage = IrisStorage
  }
})(typeof globalThis !== "undefined" ? globalThis : this)
