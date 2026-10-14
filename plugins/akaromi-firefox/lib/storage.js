/**
 * IRIS Pass — Resilient Multi-Tier Storage Engine
 * Stores sensitive credentials, encrypted ciphers, PIN unlock metadata, and session tokens
 * in browser.storage.local under the extension's privileged origin.
 *
 * Fully compatible with standard and Firefox Private Browsing windows without SecurityError.
 * Web pages & external scripts have zero access to this storage.
 */

;(function (root) {
  const ext = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null
  const memoryCache = new Map()
  let hasMigratedFromIndexedDB = false

  /**
   * Helper to attempt one-time legacy IndexedDB migration to browser.storage.local
   */
  async function checkAndMigrateLegacyIndexedDB() {
    if (hasMigratedFromIndexedDB) return
    hasMigratedFromIndexedDB = true

    if (typeof indexedDB === "undefined") return
    try {
      const DB_NAME = "iris_pass_db"
      const STORE_NAME = "vault_store"

      await new Promise((resolve) => {
        let req
        try {
          req = indexedDB.open(DB_NAME, 1)
        } catch {
          return resolve()
        }

        req.onerror = () => resolve()
        req.onsuccess = (e) => {
          try {
            const db = e.target.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.close()
              return resolve()
            }

            const tx = db.transaction(STORE_NAME, "readonly")
            const store = tx.objectStore(STORE_NAME)
            const getAllReq = store.getAll()

            getAllReq.onsuccess = async () => {
              const rows = getAllReq.result || []
              if (rows.length > 0 && ext?.storage?.local) {
                const migrated = {}
                for (const row of rows) {
                  if (row && row.key && row.value !== undefined) {
                    migrated[row.key] = row.value
                  }
                }
                try {
                  await ext.storage.local.set(migrated)
                  console.log(`[IRIS Storage] Successfully migrated ${rows.length} records from IndexedDB to browser.storage.local`)
                } catch (saveErr) {
                  console.warn("[IRIS Storage] Migration save error:", saveErr)
                }
              }
              db.close()
              resolve()
            }
            getAllReq.onerror = () => {
              db.close()
              resolve()
            }
          } catch {
            resolve()
          }
        }
      })
    } catch {
      // Ignore migration errors in private or restricted contexts
    }
  }

  // Trigger migration in background
  checkAndMigrateLegacyIndexedDB().catch(() => {})

  const IrisStorage = {
    /**
     * Get one, multiple, or all values from persistent storage
     * @param {string|string[]|null} [keys]
     * @returns {Promise<Record<string, any>>}
     */
    async get(keys) {
      // 1. Try browser.storage.local (Primary Engine)
      if (ext?.storage?.local) {
        try {
          if (!keys) {
            const data = await ext.storage.local.get(null)
            return data || {}
          }
          const keyList = Array.isArray(keys) ? keys : [keys]
          if (keyList.length === 0) return {}
          const data = await ext.storage.local.get(keyList)
          return data || {}
        } catch (err) {
          console.warn("[IRIS Storage] storage.local.get error, falling back to memory:", err)
        }
      }

      // 2. Fallback to in-memory cache
      const result = {}
      if (!keys) {
        memoryCache.forEach((val, k) => {
          result[k] = val
        })
        return result
      }
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const k of keyList) {
        if (memoryCache.has(k)) {
          result[k] = memoryCache.get(k)
        }
      }
      return result
    },

    /**
     * Set one or multiple key-value pairs into persistent storage
     * @param {Record<string, any>} items
     * @returns {Promise<void>}
     */
    async set(items) {
      if (!items || typeof items !== "object") return

      // Update in-memory mirror
      for (const [k, v] of Object.entries(items)) {
        memoryCache.set(k, v)
      }

      if (ext?.storage?.local) {
        try {
          await ext.storage.local.set(items)
          return
        } catch (err) {
          console.warn("[IRIS Storage] storage.local.set error:", err)
        }
      }
    },

    /**
     * Remove one or multiple keys from storage
     * @param {string|string[]} keys
     * @returns {Promise<void>}
     */
    async remove(keys) {
      if (!keys) return
      const keyList = Array.isArray(keys) ? keys : [keys]

      for (const k of keyList) {
        memoryCache.delete(k)
      }

      if (ext?.storage?.local) {
        try {
          await ext.storage.local.remove(keyList)
          return
        } catch (err) {
          console.warn("[IRIS Storage] storage.local.remove error:", err)
        }
      }
    },

    /**
     * Clear all records in storage
     * @returns {Promise<void>}
     */
    async clear() {
      memoryCache.clear()
      if (ext?.storage?.local) {
        try {
          await ext.storage.local.clear()
          return
        } catch (err) {
          console.warn("[IRIS Storage] storage.local.clear error:", err)
        }
      }
    },
  }

  // Export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = IrisStorage
  } else {
    root.IrisStorage = IrisStorage
  }
})(typeof globalThis !== "undefined" ? globalThis : this)
