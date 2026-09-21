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
import { elysia } from "@/lib/elysia"
import { useEncryption } from "@/context/encryption-context"
import {
  deriveVaultKey,
  encryptVaultData,
  decryptVaultData,
  encryptVaultObject,
  decryptVaultObject,
} from "@/lib/pass-crypto"
import type {
  DecryptedCipher,
  DecryptedFolder,
  DecryptedLoginData,
  DecryptedSshKeyData,
  PassCipherType,
  PassRepromptType,
} from "@/lib/pass-types"
import { toast } from "sonner"

export interface PassContextValue {
  isUnlocked: boolean
  isLoading: boolean
  error: string | null
  ciphers: DecryptedCipher[]
  folders: DecryptedFolder[]
  selectedCipherId: string | null
  setSelectedCipherId: (id: string | null) => void
  activeFilter: string // "all" | "favorites" | "logins" | "ssh" | "trash" | folderId
  setActiveFilter: (filter: string) => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Vault Actions
  unlockVault: (
    password: string
  ) => Promise<{ success: boolean; error?: string }>
  lockVault: () => void
  refreshData: () => Promise<void>

  // Cipher CRUD
  createCipher: (data: {
    type: PassCipherType
    title: string
    folderId?: string | null
    favorite?: boolean
    reprompt?: PassRepromptType
    payload: DecryptedLoginData | DecryptedSshKeyData
  }) => Promise<DecryptedCipher | null>

  updateCipher: (
    id: string,
    data: {
      title?: string
      folderId?: string | null
      favorite?: boolean
      reprompt?: PassRepromptType
      payload?: DecryptedLoginData | DecryptedSshKeyData
    }
  ) => Promise<boolean>

  deleteCipher: (id: string, permanent?: boolean) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  restoreCipher: (id: string) => Promise<boolean>
  emptyTrash: () => Promise<boolean>

  // Folder CRUD
  createFolder: (
    name: string,
    parentId?: string | null
  ) => Promise<DecryptedFolder | null>
  updateFolder: (id: string, name: string) => Promise<boolean>
  deleteFolder: (id: string) => Promise<boolean>
}

const PassContext = createContext<PassContextValue | null>(null)

export function PassProvider({ children }: { children: React.ReactNode }) {
  const encryption = useEncryption()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ciphers, setCiphers] = useState<DecryptedCipher[]>([])
  const [folders, setFolders] = useState<DecryptedFolder[]>([])

  const [selectedCipherId, setSelectedCipherId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Compute derived VaultKey from unlocked secretKey
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null)

  useEffect(() => {
    if (encryption.isActive && encryption.secretKey) {
      try {
        const key = deriveVaultKey(encryption.secretKey)
        setVaultKey(key)
      } catch (err) {
        console.error("[PassContext] Failed to derive vault key:", err)
        setVaultKey(null)
      }
    } else {
      setVaultKey(null)
    }
  }, [encryption.isActive, encryption.secretKey])

  const isUnlocked = Boolean(vaultKey && encryption.isActive)

  const isFetchingRef = useRef(false)
  const hasLoadedForVaultKeyRef = useRef<boolean>(false)

  // Fetch and decrypt ciphers and folders
  const loadVaultData = useCallback(async () => {
    if (!vaultKey || isFetchingRef.current) return

    isFetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      // 1. Fetch encrypted folders
      const foldersRes = await (elysia.pass.vault.folders as any).get()
      const rawFolders = foldersRes?.data?.folders || []

      const decryptedFolders: DecryptedFolder[] = []
      for (const f of rawFolders) {
        try {
          const name = decryptVaultData(f.encryptedName, vaultKey)
          decryptedFolders.push({
            id: f.id,
            name,
            parentId: f.parentId,
            cipherCount: f.cipherCount,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })
        } catch {
          decryptedFolders.push({
            id: f.id,
            name: "[Decryption Error]",
            parentId: f.parentId,
            cipherCount: f.cipherCount,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })
        }
      }
      setFolders(decryptedFolders)

      // 2. Fetch all ciphers in a single request (active and trash)
      const ciphersRes = await (elysia.pass.vault.ciphers as any).get()
      const rawCiphers = ciphersRes?.data?.ciphers || []

      const decryptedCiphers: DecryptedCipher[] = []
      for (const c of rawCiphers) {
        try {
          const title = decryptVaultData(c.encryptedTitle, vaultKey)
          const data = decryptVaultObject<any>(c.encryptedData, vaultKey)
          decryptedCiphers.push({
            id: c.id,
            type: c.type,
            title,
            favorite: c.favorite,
            reprompt: c.reprompt,
            folderId: c.folderId,
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
      setFolders([])
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
    return encryption.unlockVault(password)
  }

  const lockVault = () => {
    encryption.lockVault()
    setCiphers([])
    setFolders([])
    setSelectedCipherId(null)
  }

  const refreshData = async () => {
    await loadVaultData()
  }

  // Create Cipher
  const createCipher = async (data: {
    type: PassCipherType
    title: string
    folderId?: string | null
    favorite?: boolean
    reprompt?: PassRepromptType
    payload: DecryptedLoginData | DecryptedSshKeyData
  }): Promise<DecryptedCipher | null> => {
    if (!vaultKey) return null

    try {
      const encryptedTitle = encryptVaultData(data.title, vaultKey)
      const encryptedData = encryptVaultObject(data.payload, vaultKey)

      const res = await (elysia.pass.vault.ciphers as any).post({
        type: data.type,
        encryptedTitle,
        encryptedData,
        folderId: data.folderId ?? null,
        favorite: data.favorite ?? false,
        reprompt: data.reprompt ?? "NONE",
      })

      if (res?.data?.success && res.data.cipher) {
        const c = res.data.cipher
        const createdItem: DecryptedCipher = {
          id: c.id,
          type: c.type,
          title: data.title,
          favorite: c.favorite,
          reprompt: c.reprompt,
          folderId: c.folderId,
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
      folderId?: string | null
      favorite?: boolean
      reprompt?: PassRepromptType
      payload?: DecryptedLoginData | DecryptedSshKeyData
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
      if (data.folderId !== undefined) {
        body.folderId = data.folderId
      }
      if (data.favorite !== undefined) {
        body.favorite = data.favorite
      }
      if (data.reprompt !== undefined) {
        body.reprompt = data.reprompt
      }

      const res = await (elysia.pass.vault.ciphers as any)({ id }).put(body)

      if (res?.data?.success && res.data.cipher) {
        const updatedCipher = res.data.cipher
        setCiphers((prev) =>
          prev.map((item) => {
            if (item.id === id) {
              return {
                ...item,
                title: data.title !== undefined ? data.title : item.title,
                folderId:
                  data.folderId !== undefined ? data.folderId : item.folderId,
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
      const res = await (elysia.pass.vault.ciphers as any)({ id }).delete({
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
      const res = await (elysia.pass.vault.ciphers as any)({
        id,
      }).favorite.patch({
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
      const res = await (elysia.pass.vault.ciphers as any)({
        id,
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
      const res = await (elysia.pass.vault.ciphers as any).trash.empty.delete()
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

  // Create Folder
  const createFolder = async (
    name: string,
    parentId?: string | null
  ): Promise<DecryptedFolder | null> => {
    if (!vaultKey) return null

    try {
      const encryptedName = encryptVaultData(name, vaultKey)
      const res = await (elysia.pass.vault.folders as any).post({
        encryptedName,
        parentId: parentId ?? null,
      })

      if (res?.data?.success && res.data.folder) {
        const f = res.data.folder
        const newFolder: DecryptedFolder = {
          id: f.id,
          name,
          parentId: f.parentId,
          cipherCount: 0,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        }
        setFolders((prev) => [...prev, newFolder])
        toast.success("Folder created")
        return newFolder
      }
      return null
    } catch (err: any) {
      toast.error("Failed to create folder")
      return null
    }
  }

  // Update Folder
  const updateFolder = async (id: string, name: string): Promise<boolean> => {
    if (!vaultKey) return false

    try {
      const encryptedName = encryptVaultData(name, vaultKey)
      const res = await (elysia.pass.vault.folders as any)({ id }).put({
        encryptedName,
      })

      if (res?.data?.success) {
        setFolders((prev) =>
          prev.map((f) => (f.id === id ? { ...f, name } : f))
        )
        toast.success("Folder renamed")
        return true
      }
      return false
    } catch (err: any) {
      toast.error("Failed to rename folder")
      return false
    }
  }

  // Delete Folder
  const deleteFolder = async (id: string): Promise<boolean> => {
    try {
      const res = await (elysia.pass.vault.folders as any)({ id }).delete()
      if (res?.data?.success) {
        setFolders((prev) => prev.filter((f) => f.id !== id))
        // Unassign from local ciphers
        setCiphers((prev) =>
          prev.map((c) => (c.folderId === id ? { ...c, folderId: null } : c))
        )
        if (activeFilter === id) {
          setActiveFilter("all")
        }
        toast.success("Folder deleted")
        return true
      }
      return false
    } catch (err: any) {
      toast.error("Failed to delete folder")
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
        folders,
        selectedCipherId,
        setSelectedCipherId,
        activeFilter,
        setActiveFilter,
        searchQuery,
        setSearchQuery,
        unlockVault,
        lockVault,
        refreshData,
        createCipher,
        updateCipher,
        deleteCipher,
        toggleFavorite,
        restoreCipher,
        emptyTrash,
        createFolder,
        updateFolder,
        deleteFolder,
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
