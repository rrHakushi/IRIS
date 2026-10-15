"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react"
import { useSession } from "next-auth/react"
import { elysia } from "@/lib/elysia"
import { useEncryption } from "@/context/encryption-context"
import {
  deriveVaultKey,
  encryptVaultData,
  decryptVaultData,
  encryptVaultObject,
  decryptVaultObject,
  setupPinUnlock,
  unlockWithPin as unlockWithPinCrypto,
} from "@/lib/pass-crypto"
import {
  getPinUnlockRecord,
  savePinUnlockRecord,
  deletePinUnlockRecord,
} from "@/lib/encryption-vault"
import type {
  DecryptedCipher,
  DecryptedCipherData,
  PassCipherType,
  PassRepromptType,
  PassSortOption,
} from "@/lib/pass-types"
import { toast } from "sonner"

export interface PassContextValue {
  isUnlocked: boolean
  isLoading: boolean
  error: string | null
  ciphers: DecryptedCipher[]
  selectedCipherId: string | null
  setSelectedCipherId: (id: string | null) => void
  activeFilter: string // "all" | "favorites" | "logins" | "notes" | "cards" | "ssh" | "identities" | "trash" | "generator"
  setActiveFilter: (filter: string) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  sortOption: PassSortOption
  setSortOption: (opt: PassSortOption) => void

  // Vault Actions
  unlockVault: (
    password: string
  ) => Promise<{ success: boolean; error?: string }>
  unlockWithPin: (
    pin: string
  ) => Promise<{ success: boolean; error?: string }>
  isPinUnlockAvailable: boolean
  setupPin: (pin: string) => Promise<{ success: boolean; error?: string }>
  disablePin: () => Promise<void>
  lockVault: () => void
  refreshData: () => Promise<void>

  // Security & Clipboard
  copySensitiveText: (text: string, label?: string) => Promise<void>
  autoLockTimeout: number // in minutes (0 = disabled)
  setAutoLockTimeout: (minutes: number) => void
  clipboardTimeout: number // in seconds
  setClipboardTimeout: (seconds: number) => void

  // Cipher CRUD
  createCipher: (data: {
    type: PassCipherType
    title: string
    favorite?: boolean
    reprompt?: PassRepromptType
    payload: DecryptedCipherData
  }) => Promise<DecryptedCipher | null>

  updateCipher: (
    id: string,
    data: {
      title?: string
      favorite?: boolean
      reprompt?: PassRepromptType
      payload?: DecryptedCipherData
    }
  ) => Promise<boolean>

  deleteCipher: (id: string, permanent?: boolean) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  restoreCipher: (id: string) => Promise<boolean>
  emptyTrash: () => Promise<boolean>
}

const PassContext = createContext<PassContextValue | null>(null)

const PIN_ATTEMPTS_KEY = "akaromi_pin_failed_attempts"
const MAX_PIN_ATTEMPTS = 5
const AUTO_LOCK_KEY = "iris:akaromi:autoLockTimeout"
const CLIPBOARD_TIMEOUT_KEY = "iris:akaromi:clipboardTimeout"
const SORT_KEY = "iris:akaromi:sortOption"

export function PassProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const userId = session?.user?.id || "default_user"
  const encryption = useEncryption()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ciphers, setCiphers] = useState<DecryptedCipher[]>([])

  const [selectedCipherId, setSelectedCipherId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortOption, setSortOptionState] = useState<PassSortOption>("title_asc")

  // PIN state
  const [isPinUnlockAvailable, setIsPinUnlockAvailable] = useState<boolean>(false)

  // Settings
  const [autoLockTimeout, setAutoLockTimeoutState] = useState<number>(15) // 15 mins default
  const [clipboardTimeout, setClipboardTimeoutState] = useState<number>(30) // 30s default

  // Clipboard cleanup timer ref
  const clipboardTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedAutoLock = localStorage.getItem(AUTO_LOCK_KEY)
      if (savedAutoLock !== null) {
        setAutoLockTimeoutState(Number(savedAutoLock))
      }
      const savedClip = localStorage.getItem(CLIPBOARD_TIMEOUT_KEY)
      if (savedClip !== null) {
        setClipboardTimeoutState(Number(savedClip))
      }
      const savedSort = localStorage.getItem(SORT_KEY) as PassSortOption
      if (savedSort) {
        setSortOptionState(savedSort)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const setAutoLockTimeout = useCallback((minutes: number) => {
    setAutoLockTimeoutState(minutes)
    try {
      localStorage.setItem(AUTO_LOCK_KEY, String(minutes))
    } catch {}
  }, [])

  const setClipboardTimeout = useCallback((seconds: number) => {
    setClipboardTimeoutState(seconds)
    try {
      localStorage.setItem(CLIPBOARD_TIMEOUT_KEY, String(seconds))
    } catch {}
  }, [])

  const setSortOption = useCallback((opt: PassSortOption) => {
    setSortOptionState(opt)
    try {
      localStorage.setItem(SORT_KEY, opt)
    } catch {}
  }, [])

  const [isAkaromiLocked, setIsAkaromiLocked] = useState<boolean>(false)

  // Check if PIN unlock is available in IndexedDB
  const checkPinAvailability = useCallback(async () => {
    if (!userId) return
    try {
      const record = await getPinUnlockRecord(userId)
      const hasPin = Boolean(record)
      setIsPinUnlockAvailable(hasPin)
      if (hasPin) {
        setIsAkaromiLocked(true)
      }
    } catch {
      setIsPinUnlockAvailable(false)
    }
  }, [userId])

  useEffect(() => {
    checkPinAvailability()
  }, [checkPinAvailability])

  // Compute derived VaultKey from unlocked secretKey
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null)

  useEffect(() => {
    if (encryption.isActive && encryption.secretKey && !isAkaromiLocked) {
      try {
        const key = deriveVaultKey(encryption.secretKey)
        setVaultKey(key)
      } catch (err) {
        console.error("[PassContext] Failed to derive vault key:", err)
        setVaultKey(null)
      }
    } else if (isAkaromiLocked) {
      setVaultKey(null)
    }
  }, [encryption.isActive, encryption.secretKey, isAkaromiLocked])

  const isUnlocked = Boolean(vaultKey && !isAkaromiLocked)

  const isFetchingRef = useRef(false)
  const hasLoadedForVaultKeyRef = useRef<boolean>(false)

  // Fetch and decrypt ciphers
  const loadVaultData = useCallback(async () => {
    if (!vaultKey || isFetchingRef.current) return

    isFetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all ciphers in a single request (active and trash)
      const ciphersRes = await elysia.akaromi.ciphers.get()
      const rawCiphers = (ciphersRes?.data as any)?.ciphers || []

      const decryptedCiphers: DecryptedCipher[] = []
      for (const c of rawCiphers) {
        try {
          const title = decryptVaultData(c.encryptedTitle, vaultKey)
          const data = decryptVaultObject<DecryptedCipherData>(c.encryptedData, vaultKey)
          // Ensure itemType is normalized
          if (!data.itemType) {
            data.itemType = c.type === "SSH_KEY" ? "ssh" : "login"
          }
          decryptedCiphers.push({
            id: c.id,
            type: c.type,
            title,
            favorite: c.favorite,
            reprompt: c.reprompt,
            data,
            deletedAt: c.deletedAt,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })
        } catch {
          // Skip corrupt or un-decryptable ciphers
        }
      }

      setCiphers(decryptedCiphers)
      hasLoadedForVaultKeyRef.current = true
    } catch (err: any) {
      console.error("[PassContext] Load data error:", err)
      setError(err?.message || "Failed to load vault items")
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [vaultKey])

  // Automatically load data ONCE when vault unlocks or changes
  useEffect(() => {
    if (isUnlocked && vaultKey) {
      if (!hasLoadedForVaultKeyRef.current) {
        loadVaultData()
      }
    } else if (!isUnlocked) {
      hasLoadedForVaultKeyRef.current = false
      setCiphers([])
      setSelectedCipherId(null)
    }
  }, [isUnlocked, vaultKey, loadVaultData])

  // Sync on tab visibility change (throttled to at least 30s apart)
  const lastVisibilitySyncRef = useRef<number>(Date.now())
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isUnlocked) {
        const now = Date.now()
        if (now - lastVisibilitySyncRef.current > 30000) {
          lastVisibilitySyncRef.current = now
          loadVaultData()
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [isUnlocked, loadVaultData])

  const unlockVault = async (password: string) => {
    const result = await encryption.unlockVault(password)
    if (result.success) {
      try {
        sessionStorage.removeItem(PIN_ATTEMPTS_KEY)
      } catch {}
      setIsAkaromiLocked(false)
      await checkPinAvailability()
    }
    return result
  }

  const lockVault = useCallback(() => {
    setIsAkaromiLocked(true)
    setVaultKey(null)
    setCiphers([])
    setSelectedCipherId(null)
    if (clipboardTimerRef.current) {
      clearTimeout(clipboardTimerRef.current)
      clipboardTimerRef.current = null
    }
  }, [])

  // Inactivity Auto-Lock
  useEffect(() => {
    if (!isUnlocked || autoLockTimeout <= 0) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        lockVault()
        toast.info("Vault locked due to inactivity")
      }, autoLockTimeout * 60 * 1000)
    }

    resetTimer()

    const events = ["mousemove", "keydown", "touchstart", "pointerdown", "click", "scroll"]
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }))

    return () => {
      clearTimeout(timeoutId)
      events.forEach((ev) => window.removeEventListener(ev, resetTimer))
    }
  }, [isUnlocked, autoLockTimeout, lockVault])

  // PIN Unlock Implementation
  const unlockWithPin = async (
    pin: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId) {
      return { success: false, error: "No active user session" }
    }

    try {
      const failedCount = Number(sessionStorage.getItem(PIN_ATTEMPTS_KEY) || "0")
      if (failedCount >= MAX_PIN_ATTEMPTS) {
        await deletePinUnlockRecord(userId)
        setIsPinUnlockAvailable(false)
        return {
          success: false,
          error: "Too many failed attempts. PIN unlock disabled. Enter your account password.",
        }
      }

      const pinRecord = await getPinUnlockRecord(userId)
      if (!pinRecord) {
        return { success: false, error: "PIN unlock not configured on this device." }
      }

      const secretKey = unlockWithPinCrypto(pin, pinRecord)
      sessionStorage.removeItem(PIN_ATTEMPTS_KEY)

      const unlockRes = await encryption.unlockWithSecretKey(secretKey)
      if (!unlockRes.success) {
        return { success: false, error: unlockRes.error || "Failed to initialize vault" }
      }

      setIsAkaromiLocked(false)
      const derived = deriveVaultKey(secretKey)
      setVaultKey(derived)
      return { success: true }
    } catch (err: any) {
      const currentFailed = Number(sessionStorage.getItem(PIN_ATTEMPTS_KEY) || "0") + 1
      sessionStorage.setItem(PIN_ATTEMPTS_KEY, String(currentFailed))
      const remaining = MAX_PIN_ATTEMPTS - currentFailed

      if (remaining <= 0) {
        await deletePinUnlockRecord(userId)
        setIsPinUnlockAvailable(false)
        return {
          success: false,
          error: "Maximum failed attempts exceeded. PIN unlock reset. Please unlock with account password.",
        }
      }

      return {
        success: false,
        error: `Incorrect PIN (${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining)`,
      }
    }
  }

  // Setup PIN Unlock
  const setupPin = async (
    pin: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!encryption.secretKey || !userId) {
      return { success: false, error: "Vault must be unlocked with account password first" }
    }
    if (!pin || pin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" }
    }

    try {
      const pinData = setupPinUnlock(pin, encryption.secretKey)
      await savePinUnlockRecord(userId, pinData)
      setIsPinUnlockAvailable(true)
      sessionStorage.removeItem(PIN_ATTEMPTS_KEY)
      toast.success("PIN unlock configured")
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to setup PIN" }
    }
  }

  // Disable PIN Unlock
  const disablePin = async (): Promise<void> => {
    if (!userId) return
    try {
      await deletePinUnlockRecord(userId)
      setIsPinUnlockAvailable(false)
      sessionStorage.removeItem(PIN_ATTEMPTS_KEY)
      toast.success("PIN unlock disabled")
    } catch (err: any) {
      toast.error("Failed to disable PIN unlock")
    }
  }

  // Sensitive Clipboard Copy with Auto-Clear Timer
  const copySensitiveText = useCallback(
    async (text: string, label = "Password") => {
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`, {
          description: `Will automatically clear in ${clipboardTimeout}s`,
        })

        if (clipboardTimerRef.current) {
          clearTimeout(clipboardTimerRef.current)
        }

        clipboardTimerRef.current = setTimeout(async () => {
          try {
            const currentClip = await navigator.clipboard.readText()
            if (currentClip === text) {
              await navigator.clipboard.writeText("")
              toast.info("Clipboard cleared for security")
            }
          } catch {
            navigator.clipboard.writeText("").catch(() => {})
          }
        }, clipboardTimeout * 1000)
      } catch {
        toast.error("Failed to copy to clipboard")
      }
    },
    [clipboardTimeout]
  )

  const refreshData = async () => {
    await loadVaultData()
  }

  // Create Cipher
  const createCipher = async (data: {
    type: PassCipherType
    title: string
    favorite?: boolean
    reprompt?: PassRepromptType
    payload: DecryptedCipherData
  }): Promise<DecryptedCipher | null> => {
    if (!vaultKey) return null

    try {
      const itemSubtype = (data.payload as any).itemType || (data.type === "SSH_KEY" ? "ssh" : "login")
      const backendType: PassCipherType = itemSubtype === "ssh" ? "SSH_KEY" : "LOGIN"

      const encryptedTitle = encryptVaultData(data.title, vaultKey)
      const encryptedData = encryptVaultObject(data.payload, vaultKey)

      const res = await elysia.akaromi.ciphers.post({
        type: backendType,
        encryptedTitle,
        encryptedData,
        favorite: data.favorite ?? false,
        reprompt: data.reprompt ?? "NONE",
      })

      if (res?.data?.success && (res.data as any).cipher) {
        const c = (res.data as any).cipher
        const createdItem: DecryptedCipher = {
          id: c.id,
          type: c.type,
          title: data.title,
          favorite: c.favorite,
          reprompt: c.reprompt,
          data: data.payload,
          deletedAt: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }
        setCiphers((prev) => [createdItem, ...prev])
        setSelectedCipherId(createdItem.id)
        toast.success("Item saved to vault")
        return createdItem
      }
      return null
    } catch (err: any) {
      toast.error(err?.message || "Failed to create vault item")
      return null
    }
  }

  // Update Cipher (STRICT ZERO PASSWORD HISTORY)
  const updateCipher = async (
    id: string,
    data: {
      title?: string
      favorite?: boolean
      reprompt?: PassRepromptType
      payload?: DecryptedCipherData
    }
  ): Promise<boolean> => {
    if (!vaultKey) return false

    try {
      const body: any = {}
      if (data.title !== undefined) {
        body.encryptedTitle = encryptVaultData(data.title, vaultKey)
      }
      if (data.payload !== undefined) {
        body.encryptedData = encryptVaultObject(data.payload, vaultKey)
      }
      if (data.favorite !== undefined) {
        body.favorite = data.favorite
      }
      if (data.reprompt !== undefined) {
        body.reprompt = data.reprompt
      }

      const res = await elysia.akaromi.ciphers({ cipherId: id }).put(body)

      if (res?.data?.success && (res.data as any).cipher) {
        const updatedCipher = (res.data as any).cipher
        setCiphers((prev) =>
          prev.map((item) => {
            if (item.id === id) {
              return {
                ...item,
                title: data.title !== undefined ? data.title : item.title,
                favorite:
                  data.favorite !== undefined ? data.favorite : item.favorite,
                reprompt:
                  data.reprompt !== undefined ? data.reprompt : item.reprompt,
                data: data.payload !== undefined ? data.payload : item.data,
                updatedAt: updatedCipher.updatedAt,
              }
            }
            return item
          })
        )
        toast.success("Item updated")
        return true
      }
      return false
    } catch (err: any) {
      toast.error(err?.message || "Failed to update vault item")
      return false
    }
  }

  // Delete Cipher (trash or permanent)
  const deleteCipher = async (
    id: string,
    permanent = false
  ): Promise<boolean> => {
    try {
      const res = await elysia.akaromi.ciphers({ cipherId: id }).delete({
        query: { permanent },
      })

      if (res?.data?.success) {
        if (permanent) {
          setCiphers((prev) => prev.filter((c) => c.id !== id))
        } else {
          setCiphers((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c
            )
          )
        }
        if (selectedCipherId === id) {
          setSelectedCipherId(null)
        }
        toast.success(permanent ? "Item deleted permanently" : "Moved to Trash")
        return true
      }
      return false
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete item")
      return false
    }
  }

  // Toggle Favorite
  const toggleFavorite = async (id: string): Promise<boolean> => {
    const item = ciphers.find((c) => c.id === id)
    if (!item) return false

    const newFav = !item.favorite

    try {
      const res = await elysia.akaromi.ciphers({ cipherId: id }).patch({
        favorite: newFav,
      })

      if (res?.data?.success) {
        setCiphers((prev) =>
          prev.map((c) => (c.id === id ? { ...c, favorite: newFav } : c))
        )
        return true
      }
      return false
    } catch (err: any) {
      toast.error("Failed to update favorite")
      return false
    }
  }

  // Restore Cipher
  const restoreCipher = async (id: string): Promise<boolean> => {
    try {
      const res = await elysia.akaromi.ciphers({
        cipherId: id,
      }).restore.post()
      if (res?.data?.success) {
        setCiphers((prev) =>
          prev.map((c) => (c.id === id ? { ...c, deletedAt: null } : c))
        )
        toast.success("Item restored from Trash")
        return true
      }
      return false
    } catch (err: any) {
      toast.error("Failed to restore item")
      return false
    }
  }

  // Empty Trash
  const emptyTrash = async (): Promise<boolean> => {
    try {
      const res = await elysia.akaromi.ciphers.trash.delete()
      if (res?.data?.success) {
        setCiphers((prev) => prev.filter((c) => c.deletedAt === null))
        toast.success("Trash emptied")
        return true
      }
      return false
    } catch (err: any) {
      toast.error("Failed to empty trash")
      return false
    }
  }

  return (
    <PassContext.Provider
      value={{
        isUnlocked,
        isLoading,
        error,
        ciphers,
        selectedCipherId,
        setSelectedCipherId,
        activeFilter,
        setActiveFilter,
        searchQuery,
        setSearchQuery,
        sortOption,
        setSortOption,
        unlockVault,
        unlockWithPin,
        isPinUnlockAvailable,
        setupPin,
        disablePin,
        lockVault,
        refreshData,
        copySensitiveText,
        autoLockTimeout,
        setAutoLockTimeout,
        clipboardTimeout,
        setClipboardTimeout,
        createCipher,
        updateCipher,
        deleteCipher,
        toggleFavorite,
        restoreCipher,
        emptyTrash,
      }}
    >
      {children}
    </PassContext.Provider>
  )
}

export function usePass() {
  const context = useContext(PassContext)
  if (!context) {
    throw new Error("usePass must be used within a PassProvider")
  }
  return context
}
