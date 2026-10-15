"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react"
import { useSession } from "next-auth/react"
import { elysia } from "@/lib/elysia"
import {
  getVaultRecord,
  saveVaultRecord,
  deleteVaultRecord,
  decryptPrivateKeyClient,
  calculateKeyFingerprint,
  saveSessionSecretKey,
  loadSessionSecretKey,
  clearSessionSecretKey,
} from "@/lib/encryption-vault"

export interface EncryptionContextValue {
  /** Whether the post-quantum encryption vault is active / unlocked in memory for this session. */
  isActive: boolean
  /** ML-KEM-768 public key (Base64) */
  publicKey: string | null
  /** Encrypted private key payload (salt:iv:authTag:cipher) */
  encryptedPrivateKey: string | null
  /** Unlocked raw secret key in memory */
  secretKey: Uint8Array | null
  /** Human-readable SHA-256 fingerprint of the public key */
  fingerprint: string | null
  /** Whether vault data is currently loading */
  isLoading: boolean
  /** Error message if an unlock or fetch operation failed */
  error: string | null
  /** Unlocks the post-quantum encryption vault using the account password */
  unlockVault: (
    password: string
  ) => Promise<{ success: boolean; error?: string }>
  /** Unlocks the vault directly with a decrypted raw secret key (e.g. from PIN unlock) */
  unlockWithSecretKey: (
    secretKey: Uint8Array
  ) => Promise<{ success: boolean; error?: string }>
  /** Locks the vault, wiping the decrypted key from memory */
  lockVault: () => void
  /** Refreshes encryption keys from the server */
  refreshVault: () => Promise<void>
}

const EncryptionContext = createContext<EncryptionContextValue>({
  isActive: false,
  publicKey: null,
  encryptedPrivateKey: null,
  secretKey: null,
  fingerprint: null,
  isLoading: false,
  error: null,
  unlockVault: async () => ({ success: false }),
  unlockWithSecretKey: async () => ({ success: false }),
  lockVault: () => {},
  refreshVault: async () => {},
})

// In-memory active decrypted private key (wiped on window close, reload, or explicit lock)
let inMemorySecretKey: Uint8Array | null = null

export function EncryptionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null)
  const [isActive, setIsActive] = useState<boolean>(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState<string | null>(
    null
  )
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const initialFetchDone = useRef<string | null>(null)

  // Fetch encryption keys from server or IndexedDB
  const fetchKeys = useCallback(
    async (
      forceServer = false
    ): Promise<{
      userId: string | null
      publicKey: string | null
      encryptedPrivateKey: string | null
    } | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. Check if we have an active session key in encrypted session storage
        const sessionSecret = await loadSessionSecretKey(userId || undefined)
        if (sessionSecret) {
          inMemorySecretKey = sessionSecret
          setSecretKey(sessionSecret)
          setIsActive(true)
        }

        // 2. Check local IndexedDB cache first if user is available and not forcing server
        if (!forceServer && userId) {
          const cached = await getVaultRecord(userId)
          if (cached) {
            setPublicKey(cached.publicKey)
            setEncryptedPrivateKey(cached.encryptedPrivateKey)
            setFingerprint(calculateKeyFingerprint(cached.publicKey))
            if (inMemorySecretKey) {
              setIsActive(true)
            }
          }
        }

        // 3. Fetch latest from server
        const { data, error: apiError } = await elysia.akaromi.encryption.keys.get({
          fetch: { credentials: "include" },
        })

        if (!apiError && data?.success && data.publicKey) {
          const resolvedUserId = data.userId || userId || null
          setPublicKey(data.publicKey)
          setEncryptedPrivateKey(data.encryptedPrivateKey)
          setFingerprint(calculateKeyFingerprint(data.publicKey))

          // Save to IndexedDB if userId is known
          if (resolvedUserId) {
            await saveVaultRecord({
              userId: resolvedUserId,
              publicKey: data.publicKey,
              encryptedPrivateKey: data.encryptedPrivateKey || "",
              algorithm: "ML-KEM-768",
              lastUnlockedAt: inMemorySecretKey ? Date.now() : null,
              updatedAt: Date.now(),
            })
          }

          if (inMemorySecretKey) {
            setIsActive(true)
          }

          return {
            userId: resolvedUserId,
            publicKey: data.publicKey,
            encryptedPrivateKey: data.encryptedPrivateKey ?? null,
          }
        }
        return null
      } catch (err: unknown) {
        console.warn(
          "[EncryptionContext] Failed to fetch encryption vault:",
          err
        )
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    // Check if encrypted session secret key is in session storage
    loadSessionSecretKey(userId || undefined).then((sessionSecret) => {
      if (sessionSecret) {
        inMemorySecretKey = sessionSecret
        setSecretKey(sessionSecret)
        setIsActive(true)
      }
    })

    if (status === "authenticated" && userId) {
      if (initialFetchDone.current !== userId) {
        initialFetchDone.current = userId
        fetchKeys()
      }
    } else if (status === "unauthenticated") {
      if (initialFetchDone.current) {
        clearSessionSecretKey()
        initialFetchDone.current = null
        setIsActive(false)
        setPublicKey(null)
        setEncryptedPrivateKey(null)
        setFingerprint(null)
        if (inMemorySecretKey) {
          try {
            crypto.getRandomValues(inMemorySecretKey)
          } catch {
            inMemorySecretKey.fill(0)
          }
        }
        inMemorySecretKey = null
      }
    }
  }, [status, userId, fetchKeys])

  /**
   * Unlocks the vault by decrypting the private key with the user's password.
   */
  const unlockVault = async (
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    let payload = encryptedPrivateKey
    let pubKey = publicKey
    let targetUserId = userId

    if (!payload || !targetUserId) {
      // Attempt to refetch keys from server
      const fetched = await fetchKeys(true)
      if (fetched) {
        payload = fetched.encryptedPrivateKey
        pubKey = fetched.publicKey
        if (fetched.userId) {
          targetUserId = fetched.userId
        }
      }
    }

    if (!payload) {
      const err = "No encryption keys found for this account."
      setError(err)
      return { success: false, error: err }
    }

    setIsLoading(true)
    setError(null)

    try {
      const decryptedSecret = await decryptPrivateKeyClient(payload, password)
      inMemorySecretKey = decryptedSecret
      setSecretKey(decryptedSecret)
      setIsActive(true)

      await saveSessionSecretKey(targetUserId || "active", decryptedSecret)

      if (pubKey && targetUserId) {
        await saveVaultRecord({
          userId: targetUserId,
          publicKey: pubKey,
          encryptedPrivateKey: payload,
          algorithm: "ML-KEM-768",
          lastUnlockedAt: Date.now(),
          updatedAt: Date.now(),
        })
      }

      return { success: true }
    } catch (err: unknown) {
      const msg = "Incorrect account password. Please verify and try again."
      setError(msg)
      setIsActive(false)
      if (inMemorySecretKey) {
        try {
          crypto.getRandomValues(inMemorySecretKey)
        } catch {
          inMemorySecretKey.fill(0)
        }
      }
      inMemorySecretKey = null
      await clearSessionSecretKey(targetUserId || undefined)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Unlocks the vault directly using an in-memory decrypted secret key (e.g. from local PIN unlock).
   */
  const unlockWithSecretKey = async (
    unlockedKey: Uint8Array
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      inMemorySecretKey = unlockedKey
      setSecretKey(unlockedKey)
      setIsActive(true)
      await saveSessionSecretKey(userId || "active", unlockedKey)
      return { success: true }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to activate vault with secret key",
      }
    }
  }

  /**
   * Locks the vault immediately, removing private key material from memory and session storage.
   */
  const lockVault = useCallback(() => {
    if (userId) {
      clearSessionSecretKey(userId)
    } else {
      clearSessionSecretKey()
    }
    if (inMemorySecretKey) {
      try {
        crypto.getRandomValues(inMemorySecretKey)
      } catch {
        inMemorySecretKey.fill(0)
      }
    }
    inMemorySecretKey = null
    setSecretKey(null)
    setIsActive(false)
    setError(null)
  }, [userId])

  return (
    <EncryptionContext.Provider
      value={{
        isActive,
        publicKey,
        encryptedPrivateKey,
        secretKey: secretKey || inMemorySecretKey,
        fingerprint,
        isLoading,
        error,
        unlockVault,
        unlockWithSecretKey,
        lockVault,
        refreshVault: async () => {
          await fetchKeys(true)
        },
      }}
    >
      {children}
    </EncryptionContext.Provider>
  )
}

export function useEncryption() {
  const context = useContext(EncryptionContext)
  if (!context) {
    throw new Error("useEncryption must be used within an EncryptionProvider")
  }
  return context
}
