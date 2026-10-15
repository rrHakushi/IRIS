/**
 * Akaromi for Firefox — Background Vault Cryptography & Sync Engine
 */

/**
 * Decrypts raw encrypted ciphers and folders from local storage cache
 * (Ultra fast, zero API network calls)
 */
async function decryptCachedVault(vaultKey) {
  const sData = await storage.get([
    "cachedEncryptedCiphers",
    "cachedEncryptedFolders",
  ])
  const rawCiphers = sData.cachedEncryptedCiphers || []
  const rawFolders = sData.cachedEncryptedFolders || []

  if (rawCiphers.length === 0) {
    // Missing local cache — attempt sync if possible
    try {
      await syncVault({ force: true })
    } catch {}
    return
  }

  const decryptedList = []
  for (const c of rawCiphers) {
    try {
      const title = await IrisCrypto.decryptVaultData(
        c.encryptedTitle,
        vaultKey
      )
      const data = await IrisCrypto.decryptVaultObject(
        c.encryptedData,
        vaultKey
      )
      decryptedList.push({
        id: c.id,
        type: c.type,
        title,
        favorite: c.favorite,
        folderId: c.folderId,
        reprompt: c.reprompt,
        data,
        deletedAt: c.deletedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })
    } catch (err) {
      console.warn("[Akaromi] Skipped un-decryptable cached cipher:", c.id)
    }
  }
  inMemoryCiphers = decryptedList

  const decryptedFolders = []
  for (const f of rawFolders) {
    try {
      const name = await IrisCrypto.decryptVaultData(
        f.encryptedName,
        vaultKey
      )
      decryptedFolders.push({ id: f.id, name })
    } catch {
      decryptedFolders.push({ id: f.id, name: "[Folder]" })
    }
  }
  inMemoryFolders = decryptedFolders

  updateBadge()
}

/**
 * Sync vault data from backend (hourly or on explicit "Sync Now" trigger)
 */
async function syncVault(options = {}) {
  const { force = false } = options
  if (!inMemoryVaultKey) return { success: false, error: "Vault is locked" }

  const sData = await storage.get(["lastSyncTimestamp"])
  const lastSync = sData.lastSyncTimestamp || 0

  if (!force && lastSync && Date.now() - lastSync < ONE_HOUR_MS) {
    // Fresh enough — just ensure memory is decrypted
    if (inMemoryCiphers.length === 0) {
      await decryptCachedVault(inMemoryVaultKey)
    }
    return {
      success: true,
      fromCache: true,
      lastSyncTimestamp: lastSync,
      cipherCount: inMemoryCiphers.length,
      folderCount: inMemoryFolders.length,
    }
  }

  try {
    const ciphersRes = await IrisApi.fetchCiphers()
    const rawCiphers = ciphersRes?.ciphers || ciphersRes?.data?.ciphers || []

    let rawFolders = []
    try {
      const foldersRes = await IrisApi.fetchFolders()
      rawFolders = foldersRes?.folders || foldersRes?.data?.folders || []
    } catch (e) {
      console.warn("[Akaromi] Failed to fetch folders:", e)
    }

    const now = Date.now()
    await storage.set({
      cachedEncryptedCiphers: rawCiphers,
      cachedEncryptedFolders: rawFolders,
      lastSyncTimestamp: now,
    })

    // Decrypt into memory
    const decryptedList = []
    for (const c of rawCiphers) {
      try {
        const title = await IrisCrypto.decryptVaultData(
          c.encryptedTitle,
          inMemoryVaultKey
        )
        const data = await IrisCrypto.decryptVaultObject(
          c.encryptedData,
          inMemoryVaultKey
        )
        decryptedList.push({
          id: c.id,
          type: c.type,
          title,
          favorite: c.favorite,
          folderId: c.folderId,
          reprompt: c.reprompt,
          data,
          deletedAt: c.deletedAt,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })
      } catch (err) {
        console.warn("[Akaromi] Skipped un-decryptable cipher:", c.id)
      }
    }
    inMemoryCiphers = decryptedList

    const decryptedFolders = []
    for (const f of rawFolders) {
      try {
        const name = await IrisCrypto.decryptVaultData(
          f.encryptedName,
          inMemoryVaultKey
        )
        decryptedFolders.push({ id: f.id, name })
      } catch {
        decryptedFolders.push({ id: f.id, name: "[Folder]" })
      }
    }
    inMemoryFolders = decryptedFolders

    updateBadge()

    return {
      success: true,
      fromCache: false,
      lastSyncTimestamp: now,
      cipherCount: inMemoryCiphers.length,
      folderCount: inMemoryFolders.length,
    }
  } catch (err) {
    console.error("[Akaromi] Sync error:", err)
    // Fallback to local cache if network fails: directly decrypt cached ciphers without calling syncVault again
    if (inMemoryCiphers.length === 0 && inMemoryVaultKey) {
      try {
        const sData = await storage.get(["cachedEncryptedCiphers", "cachedEncryptedFolders"])
        const rawCiphers = sData.cachedEncryptedCiphers || []
        const decryptedList = []
        for (const c of rawCiphers) {
          try {
            const title = await IrisCrypto.decryptVaultData(c.encryptedTitle, inMemoryVaultKey)
            const data = await IrisCrypto.decryptVaultObject(c.encryptedData, inMemoryVaultKey)
            decryptedList.push({ id: c.id, type: c.type, title, favorite: c.favorite, folderId: c.folderId, reprompt: c.reprompt, data, deletedAt: c.deletedAt, createdAt: c.createdAt, updatedAt: c.updatedAt })
          } catch {}
        }
        inMemoryCiphers = decryptedList
      } catch {}
    }
    throw err
  }
}

/**
 * Helper: decrypt master secret key using password, then derive vault key and decrypt ciphers
 */
async function unlockWithPassword(password) {
  const encData = await IrisApi.fetchEncryptionKeys()
  if (!encData?.publicKey || !encData?.encryptedPrivateKey) {
    throw new Error(
      "No encryption keys configured on this account yet. Please unlock or set up your vault on the web first."
    )
  }

  // 1. Decrypt post-quantum master private key using password (scrypt + AES-256-GCM)
  let secretKeyBytes
  try {
    secretKeyBytes = IrisCrypto.decryptPrivateKey(
      encData.encryptedPrivateKey,
      password
    )
  } catch (err) {
    console.error("[Akaromi] Key decryption failed:", err)
    throw new Error("Incorrect account password")
  }

  // 2. Derive vault key from master secret key (HKDF-SHA256)
  inMemoryVaultKey = IrisCrypto.deriveVaultKey(secretKeyBytes)

  if (ext.storage?.session) {
    await ext.storage.session.set({
      vaultKeyHex: IrisCrypto.bytesToHex(inMemoryVaultKey),
      lastActive: Date.now(),
    })
  }

  // 3. Sync or decrypt vault items
  await syncVault({ force: false })
  await resetAutoLock()
}
