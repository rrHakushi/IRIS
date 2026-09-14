"use client"

import React, { useState, useRef } from "react"
import { useEncryption } from "@/context/encryption-context"
import { elysia } from "@/lib/elysia"
import {
  deriveVaultKey,
  encryptVaultData,
  encryptVaultObject,
  decryptVaultData,
  decryptVaultObject,
} from "@/lib/pass-crypto"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  IconUpload,
  IconDownload,
  IconCheck,
  IconAlertCircle,
  IconLockOpen,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { SettingsTabProps } from "../types"

export function PassSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const encryption = useEncryption()

  // Unlock form state
  const [unlockPassword, setUnlockPassword] = useState("")
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Import / Export state
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importSummary, setImportSummary] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockPassword.trim()) return

    setIsUnlocking(true)
    setUnlockError(null)

    const res = await encryption.unlockVault(unlockPassword)
    setIsUnlocking(false)

    if (res.success) {
      setUnlockPassword("")
      toast.success("Vault unlocked successfully")
    } else {
      setUnlockError(
        res.error ||
          (encryption.hasSeparateEncryptionPassword
            ? "Incorrect decryption password. Please try again."
            : "Incorrect account password. Please try again.")
      )
    }
  }

  // Export Decrypted Passwords JSON
  const handleExport = async () => {
    if (!encryption.isActive || !encryption.secretKey) {
      toast.error("Please unlock your vault first")
      return
    }

    setIsExporting(true)
    try {
      const vaultKey = deriveVaultKey(encryption.secretKey)
      const res = await (elysia.pass.vault.export as any).get()

      if (!res?.data) {
        throw new Error("Failed to fetch vault backup")
      }

      const rawFolders = res.data.folders || []
      const rawCiphers = res.data.ciphers || []

      // Decrypt items locally in memory
      const decryptedFolders = rawFolders.map((f: any) => {
        try {
          return { id: f.id, name: decryptVaultData(f.encryptedName, vaultKey) }
        } catch {
          return { id: f.id, name: "[Decryption Error]" }
        }
      })

      const decryptedItems = rawCiphers.map((c: any) => {
        try {
          const title = decryptVaultData(c.encryptedTitle, vaultKey)
          const data = decryptVaultObject<any>(c.encryptedData, vaultKey)
          return {
            id: c.id,
            type: c.type,
            title,
            folderId: c.folderId,
            favorite: c.favorite,
            data,
            createdAt: c.createdAt,
          }
        } catch {
          return null
        }
      }).filter(Boolean)

      const exportPayload = {
        encrypted: false,
        version: "1.0",
        exportDate: new Date().toISOString(),
        folders: decryptedFolders,
        items: decryptedItems,
      }

      const jsonStr = JSON.stringify(exportPayload, null, 2)
      const blob = new Blob([jsonStr], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `iris-pass-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Vault exported successfully")
    } catch (err: any) {
      toast.error("Export failed: " + (err?.message || "Unknown error"))
    } finally {
      setIsExporting(false)
    }
  }

  // Import JSON / CSV Passwords
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!encryption.isActive || !encryption.secretKey) {
      toast.error("Please unlock your vault first")
      return
    }

    setIsImporting(true)
    setImportSummary(null)

    try {
      const vaultKey = deriveVaultKey(encryption.secretKey)
      const text = await file.text()
      let parsed: any

      try {
        parsed = JSON.parse(text)
      } catch {
        toast.error("Please provide a valid JSON export (Bitwarden or IRIS Pass format)")
        setIsImporting(false)
        return
      }

      const rawItems: any[] = parsed.items || []
      const rawFolders: any[] = parsed.folders || []

      // Batch payloads to encrypt locally
      const foldersToImport: { tempId: string; encryptedName: string }[] = []
      const ciphersToImport: {
        tempFolderId?: string | null
        type: "LOGIN" | "SSH_KEY"
        encryptedTitle: string
        encryptedData: string
        favorite?: boolean
        reprompt?: "NONE" | "REQUIRE_MASTER_PASSWORD"
      }[] = []

      for (const f of rawFolders) {
        if (f.name) {
          foldersToImport.push({
            tempId: f.id || String(Math.random()),
            encryptedName: encryptVaultData(f.name, vaultKey),
          })
        }
      }

      for (const item of rawItems) {
        const title = item.name || item.title || "Untitled"
        const favorite = Boolean(item.favorite)

        if (item.type === 1 || item.type === "LOGIN" || item.login || item.data?.username) {
          const loginPayload = {
            username: item.login?.username || item.data?.username || "",
            password: item.login?.password || item.data?.password || "",
            uris: item.login?.uris
              ? item.login.uris.map((u: any) => ({ uri: u.uri, match: u.match ?? 0 }))
              : item.data?.uris || [],
            totpSecret: item.login?.totp || item.data?.totpSecret || "",
            notes: item.notes || item.data?.notes || "",
          }

          ciphersToImport.push({
            type: "LOGIN",
            tempFolderId: item.folderId ?? null,
            encryptedTitle: encryptVaultData(title, vaultKey),
            encryptedData: encryptVaultObject(loginPayload, vaultKey),
            favorite,
            reprompt: "NONE",
          })
        }
      }

      // Send to Elysia batch import endpoint
      const res = await (elysia.pass.vault.import as any).post({
        folders: foldersToImport,
        ciphers: ciphersToImport,
      })

      if (res?.data?.success) {
        const msg = `Successfully imported ${res.data.importedCiphersCount} items and ${res.data.importedFoldersCount} folders.`
        setImportSummary(msg)
        toast.success(msg)
      } else {
        throw new Error(res?.error?.value || "Import failed")
      }
    } catch (err: any) {
      toast.error("Import failed: " + (err?.message || "Invalid file format"))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-foreground font-heading">
          IRIS Pass Settings
        </h2>
      </div>

      {/* If locked, render unlock prompt */}
      {!encryption.isActive && (
        <form
          onSubmit={handleUnlock}
          className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs"
        >
          {unlockError && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive border border-destructive/20">
              <IconAlertCircle className="size-4 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="settings-pass-unlock"
              className="text-xs font-medium text-foreground"
            >
              {encryption.hasSeparateEncryptionPassword
                ? "Decryption Password"
                : "Account Password"}
            </Label>
            <div className="relative">
              <Input
                id="settings-pass-unlock"
                type={showUnlockPassword ? "text" : "password"}
                placeholder="Enter password to unlock..."
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="pe-10 rounded-xl text-xs h-9"
              />
              <button
                type="button"
                onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showUnlockPassword ? "Hide password" : "Show password"}
              >
                {showUnlockPassword ? (
                  <IconEyeOff className="size-4" />
                ) : (
                  <IconEye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isUnlocking || !unlockPassword.trim()}
            className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs h-9 font-semibold cursor-pointer"
          >
            <IconLockOpen className="size-3.5 me-1.5" />
            {isUnlocking ? "Unlocking Vault..." : "Unlock Vault to Manage Passwords"}
          </Button>
        </form>
      )}

      {/* Import / Export Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Import */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 flex flex-col justify-between shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <IconUpload className="size-4 text-rose-500" />
              <h3 className="text-xs font-bold text-foreground">Import Passwords</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Import credentials from Bitwarden JSON or IRIS Pass backup. Credentials are encrypted client-side before syncing.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="settings-vault-file-import"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!encryption.isActive || isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl text-xs gap-1.5 h-9 cursor-pointer"
            >
              <IconUpload className="size-3.5" />
              {isImporting ? "Importing..." : "Choose File to Import"}
            </Button>
          </div>
        </div>

        {/* Export */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 flex flex-col justify-between shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <IconDownload className="size-4 text-rose-500" />
              <h3 className="text-xs font-bold text-foreground">Export Passwords</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Export an unencrypted JSON backup of all logins and credentials. Store this file in an encrypted volume.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={!encryption.isActive || isExporting}
            onClick={handleExport}
            className="w-full rounded-xl text-xs gap-1.5 h-9 cursor-pointer"
          >
            <IconDownload className="size-3.5" />
            {isExporting ? "Exporting..." : "Export Unencrypted JSON"}
          </Button>
        </div>
      </div>

      {importSummary && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <IconCheck className="size-4 shrink-0" />
          <span>{importSummary}</span>
        </div>
      )}
    </div>
  )
}
