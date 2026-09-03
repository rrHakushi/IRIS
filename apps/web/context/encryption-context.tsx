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
  /** Whether the user has configured an independent encryption password differing from the account password */
  hasSeparateEncryptionPassword: boolean
  /** ML-KEM-768 public key (Base64) */
  publicKey: string | null
  /** Encrypted private key payload (salt:iv:authTag:cipher) */
  encryptedPrivateKey: string | null
  /** Human-readable SHA-256 fingerprint of the public key */
  fingerprint: string | null
  /** Whether vault data is currently loading */
  isLoading: boolean
  /** Error message if an unlock or fetch operation failed */
  error: string | null
  /** Unlocks the post-quantum encryption vault using the account or separate encryption password */
  unlockVault: (
    password: string
  ) => Promise<{ success: boolean; error?: string }>
  /** Locks the vault, wiping the decrypted key from memory */
  lockVault: () => void
  /** Changes or separates the encryption password */
  changeEncryptionPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>
  /** Refreshes encryption keys from the server */
  refreshVault: () => Promise<void>
}

const EncryptionContext = createContext<EncryptionContextValue>({
  isActive: false,
  hasSeparateEncryptionPassword: false,
  publicKey: null,
  encryptedPrivateKey: null,
  fingerprint: null,
  isLoading: false,
  error: null,
  unlockVault: async () => ({ success: false }),
  lockVault: () => {},
  changeEncryptionPassword: async () => ({ success: false }),
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

  const [isActive, setIsActive] = useState<boolean>(false)
  const [hasSeparateEncryptionPassword, setHasSeparateEncryptionPassword] =
    useState<boolean>(false)
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
      hasSeparateEncryptionPassword: boolean
    } | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. Check if we have an active session key in sessionStorage
        const sessionSecret = loadSessionSecretKey(userId || undefined)
        if (sessionSecret) {
          inMemorySecretKey = sessionSecret
          setIsActive(true)
        }

        // 2. Check local IndexedDB cache first if user is available and not forcing server
        if (!forceServer && userId) {
          const cached = await getVaultRecord(userId)
          if (cached) {
            setPublicKey(cached.publicKey)
            setEncryptedPrivateKey(cached.encryptedPrivateKey)
            setFingerprint(calculateKeyFingerprint(cached.publicKey))
            if (cached.hasSeparateEncryptionPassword !== undefined) {
              setHasSeparateEncryptionPassword(
                Boolean(cached.hasSeparateEncryptionPassword)
              )
            }
            if (inMemorySecretKey) {
              setIsActive(true)
            }
          }
        }

        // 3. Fetch latest from server
        const { data, error: apiError } =
          await elysia.users.me.encryption.get({
            fetch: { credentials: "include" },
          })

        if (!apiError && data?.success && data.publicKey) {
          const resolvedUserId = data.userId || userId || null
          const hasSep = Boolean(data.hasSeparateEncryptionPassword)
          setPublicKey(data.publicKey)
          setEncryptedPrivateKey(data.encryptedPrivateKey)
          setFingerprint(calculateKeyFingerprint(data.publicKey))
          setHasSeparateEncryptionPassword(hasSep)

          // Save to IndexedDB if userId is known
          if (resolvedUserId) {
            await saveVaultRecord({
              userId: resolvedUserId,
              publicKey: data.publicKey,
              encryptedPrivateKey: data.encryptedPrivateKey || "",
              algorithm: "ML-KEM-768",
              hasSeparateEncryptionPassword: hasSep,
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
            hasSeparateEncryptionPassword: hasSep,
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
    [userId, hasSeparateEncryptionPassword]
  )

  useEffect(() => {
    // Check if session secret key is in sessionStorage
    const sessionSecret = loadSessionSecretKey(userId || undefined)
    if (sessionSecret) {
      inMemorySecretKey = sessionSecret
      setIsActive(true)
    }

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
    let separate = hasSeparateEncryptionPassword
    let targetUserId = userId

    if (!payload || !targetUserId) {
      // Attempt to refetch keys from server
      const fetched = await fetchKeys(true)
      if (fetched) {
        payload = fetched.encryptedPrivateKey
        pubKey = fetched.publicKey
        separate = fetched.hasSeparateEncryptionPassword
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
      setIsActive(true)

      saveSessionSecretKey(targetUserId || "active", decryptedSecret)

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
      const msg = separate
        ? "Incorrect encryption password. Note: a separate encryption password is configured for this account."
        : "Incorrect password. Please verify and try again."
      setError(msg)
      setIsActive(false)
      inMemorySecretKey = null
      clearSessionSecretKey(targetUserId || undefined)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
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
    inMemorySecretKey = null
    setIsActive(false)
    setError(null)
  }, [userId])

  /**
   * Changes or separates the encryption password on the server and updates local vault.
   */
  const changeEncryptionPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: apiError } =
        await elysia.users.me.encryption.post(
          {
            currentPassword,
            newEncryptionPassword: newPassword,
          },
          {
            fetch: { credentials: "include" },
          }
        )

      if (apiError || !data?.success) {
        const msg =
          typeof apiError?.value === "object" &&
          apiError.value &&
          "message" in apiError.value
            ? String((apiError.value as { message: unknown }).message)
            : "Failed to update encryption password."
        setError(msg)
        return { success: false, error: msg }
      }

      // Re-fetch updated encrypted private key from server
      await fetchKeys(true)

      // Auto-unlock with the new password
      await unlockVault(newPassword)

      return { success: true }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error updating encryption password"
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <EncryptionContext.Provider
      value={{
        isActive,
        hasSeparateEncryptionPassword,
        publicKey,
        encryptedPrivateKey,
        fingerprint,
        isLoading,
        error,
        unlockVault,
        lockVault,
        changeEncryptionPassword,
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
