"use client"

import React, { useState, useRef, useEffect } from "react"
import { useSession } from "@/context/session-context"
import { useEncryption } from "@/context/encryption-context"
import { elysia } from "@/lib/elysia"
import {
  deriveVaultKey,
  encryptVaultData,
  encryptVaultObject,
  decryptVaultData,
  decryptVaultObject,
  setupPinUnlock,
} from "@/lib/pass-crypto"
import {
  getPinUnlockRecord,
  savePinUnlockRecord,
  deletePinUnlockRecord,
} from "@/lib/encryption-vault"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconUpload,
  IconDownload,
  IconCheck,
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconKey,
  IconShieldLock,
  IconClock,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { SettingsTabProps } from "../types"

const AUTO_LOCK_KEY = "iris:akaromi:autoLockTimeout"
const CLIPBOARD_TIMEOUT_KEY = "iris:akaromi:clipboardTimeout"

export function PassSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const { data: session } = useSession()
  const userId = session?.user?.id || "default_user"
  const encryption = useEncryption()


  // Inactivity & Clipboard Settings
  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(15)
  const [clipboardTimeout, setClipboardTimeout] = useState<number>(30)

  // PIN Unlock state
  const [isPinActive, setIsPinActive] = useState<boolean>(false)
  const [showPinSetup, setShowPinSetup] = useState<boolean>(false)
  const [newPin, setNewPin] = useState<string>("")
  const [confirmPin, setConfirmPin] = useState<string>("")
  const [showPinValue, setShowPinValue] = useState<boolean>(false)
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false)

  // Import / Export state
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importSummary, setImportSummary] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load preferences from localStorage and check PIN availability
  useEffect(() => {
    try {
      const savedAutoLock = localStorage.getItem(AUTO_LOCK_KEY)
      if (savedAutoLock !== null) {
        setAutoLockTimeout(Number(savedAutoLock))
      }
      const savedClip = localStorage.getItem(CLIPBOARD_TIMEOUT_KEY)
      if (savedClip !== null) {
        setClipboardTimeout(Number(savedClip))
      }
    } catch {}

    if (userId) {
      getPinUnlockRecord(userId)
        .then((record) => setIsPinActive(Boolean(record)))
        .catch(() => setIsPinActive(false))
    }
  }, [userId])

  const handleAutoLockChange = (minutes: number) => {
    setAutoLockTimeout(minutes)
    try {
      localStorage.setItem(AUTO_LOCK_KEY, String(minutes))
      toast.success(
        minutes === 0
          ? "Auto-lock disabled"
          : `Auto-lock set to ${minutes} ${minutes === 1 ? "minute" : "minutes"}`
      )
    } catch {}
  }

  const handleClipboardTimeoutChange = (seconds: number) => {
    setClipboardTimeout(seconds)
    try {
      localStorage.setItem(CLIPBOARD_TIMEOUT_KEY, String(seconds))
      toast.success(
        seconds === 0
          ? "Clipboard auto-clear disabled"
          : `Clipboard will clear after ${seconds} seconds`
      )
    } catch {}
  }


  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPin || newPin.length < 4) {
      toast.error("PIN must be at least 4 digits")
      return
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match")
      return
    }
    if (!encryption.isActive || !encryption.secretKey) {
      toast.error("Vault must be unlocked with account password first")
      return
    }

    setIsSavingPin(true)
    try {
      const pinData = setupPinUnlock(newPin, encryption.secretKey)
      await savePinUnlockRecord(userId, pinData)
      setIsPinActive(true)
      setShowPinSetup(false)
      setNewPin("")
      setConfirmPin("")
      toast.success("PIN unlock configured successfully")
    } catch (err: any) {
      toast.error(err?.message || "Failed to configure PIN")
    } finally {
      setIsSavingPin(false)
    }
  }

  const handleDisablePin = async () => {
    if (!confirm("Are you sure you want to disable PIN unlock on this device?")) {
      return
    }
    try {
      await deletePinUnlockRecord(userId)
      setIsPinActive(false)
      toast.success("PIN unlock disabled")
    } catch {
      toast.error("Failed to disable PIN unlock")
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
      const res = await elysia.akaromi.export.get()

      if (!res?.data) {
        throw new Error("Failed to fetch vault backup")
      }

      const rawCiphers = res.data.ciphers || []

      const decryptedItems = rawCiphers
        .map((c: any) => {
          try {
            const title = decryptVaultData(c.encryptedTitle, vaultKey)
            const data = decryptVaultObject<any>(c.encryptedData, vaultKey)
            return {
              id: c.id,
              type: c.type,
              title,
              favorite: c.favorite,
              data,
              createdAt: c.createdAt,
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)

      const exportPayload = {
        encrypted: false,
        version: "1.0",
        exportDate: new Date().toISOString(),
        folders: [],
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
        toast.error(
          "Please provide a valid JSON export (Bitwarden or Akaromi format)"
        )
        setIsImporting(false)
        return
      }

      const rawItems: any[] = parsed.items || []

      // Batch payloads to encrypt locally
      const ciphersToImport: {
        tempFolderId?: string | null
        type: "LOGIN" | "SSH_KEY"
        encryptedTitle: string
        encryptedData: string
        favorite?: boolean
        reprompt?: "NONE" | "REQUIRE_MASTER_PASSWORD"
      }[] = []

      for (const item of rawItems) {
        const title = item.name || item.title || "Untitled"
        const favorite = Boolean(item.favorite)

        if (
          item.type === 1 ||
          item.type === "LOGIN" ||
          item.login ||
          item.data?.username
        ) {
          const loginPayload = {
            username: item.login?.username || item.data?.username || "",
            password: item.login?.password || item.data?.password || "",
            uris: item.login?.uris
              ? item.login.uris.map((u: any) => ({
                  uri: u.uri,
                  match: u.match ?? "BASE_DOMAIN",
                }))
              : item.data?.uris || [],
            totpSecret: item.login?.totp || item.data?.totpSecret || "",
            notes: item.notes || item.data?.notes || "",
          }

          ciphersToImport.push({
            type: "LOGIN",
            tempFolderId: null,
            encryptedTitle: encryptVaultData(title, vaultKey),
            encryptedData: encryptVaultObject(loginPayload, vaultKey),
            favorite,
            reprompt: "NONE",
          })
        }
      }

      // Send to Elysia batch import endpoint
      const res = await elysia.akaromi.import.post({
        ciphers: ciphersToImport,
      })

      if (res?.data?.success) {
        const msg = `Successfully imported ${res.data.importedCiphersCount} items.`
        setImportSummary(msg)
        toast.success(msg)
      } else {
        const errorVal = res?.error?.value
        const errorMsg =
          typeof errorVal === "string"
            ? errorVal
            : (errorVal as any)?.detail ||
              (errorVal as any)?.message ||
              "Import failed"
        throw new Error(errorMsg)
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

      {/* Security & Vault Preferences */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <IconShieldLock className="size-5 text-foreground" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Security & Vault Preferences
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Configure auto-lock timers, clipboard protection, and device PIN unlock.
            </p>
          </div>
        </div>

        {/* Inactivity Auto-Lock */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-1 border-b border-border/40">
          <div>
            <Label className="text-xs font-semibold text-foreground">
              Inactivity Auto-Lock
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Automatically locks your vault when no activity is detected.
            </p>
          </div>
          <select
            value={autoLockTimeout}
            onChange={(e) => handleAutoLockChange(Number(e.target.value))}
            className="h-8 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden"
          >
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes (Default)</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={0}>Never (Disabled)</option>
          </select>
        </div>

        {/* Clipboard Auto-Clear */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-1 border-b border-border/40">
          <div>
            <Label className="text-xs font-semibold text-foreground">
              Clipboard Auto-Clear
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Wipes copied passwords and 2FA codes from your clipboard for privacy.
            </p>
          </div>
          <select
            value={clipboardTimeout}
            onChange={(e) => handleClipboardTimeoutChange(Number(e.target.value))}
            className="h-8 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden"
          >
            <option value={10}>10 seconds</option>
            <option value={20}>20 seconds</option>
            <option value={30}>30 seconds (Default)</option>
            <option value={60}>60 seconds</option>
            <option value={0}>Never (Disabled)</option>
          </select>
        </div>

        {/* PIN Unlock Setup */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-foreground">
                  PIN Unlock
                </Label>
                <Badge
                  variant="outline"
                  className={
                    isPinActive
                      ? "text-[10px] text-foreground"
                      : "text-[10px] text-muted-foreground"
                  }
                >
                  {isPinActive ? "Active on this device" : "Not configured"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Unlock your vault with a quick 4-12 digit PIN on this browser.
                Rate-limited with automatic lockout after 5 failed attempts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isPinActive ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={!encryption.isActive}
                    onClick={() => setShowPinSetup(!showPinSetup)}
                    className="h-8 rounded-xl text-xs"
                  >
                    Change PIN
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisablePin}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Disable PIN
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={!encryption.isActive}
                  onClick={() => setShowPinSetup(!showPinSetup)}
                  className="h-8 gap-1.5 rounded-xl text-xs"
                >
                  <IconKey className="size-3.5 text-foreground" />
                  <span>Configure PIN</span>
                </Button>
              )}
            </div>
          </div>

          {!encryption.isActive && (
            <p className="text-[11px] text-muted-foreground">
              * Unlock your vault above using your account password to configure or update your PIN.
            </p>
          )}

          {/* Inline PIN Setup Form */}
          {showPinSetup && encryption.isActive && (
            <form
              onSubmit={handleSavePin}
              className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4"
            >
              <span className="text-xs font-bold text-foreground">
                {isPinActive ? "Change Vault PIN" : "Set New Vault PIN"}
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    New PIN (4-12 digits)
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPinValue ? "text" : "password"}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="••••"
                      maxLength={12}
                      className="h-8 rounded-xl pe-8 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinValue(!showPinValue)}
                      className="absolute inset-y-0 end-0 flex items-center pe-2 text-muted-foreground hover:text-foreground"
                    >
                      {showPinValue ? (
                        <IconEyeOff className="size-3.5" />
                      ) : (
                        <IconEye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Confirm PIN
                  </Label>
                  <Input
                    type={showPinValue ? "text" : "password"}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••"
                    maxLength={12}
                    className="h-8 rounded-xl font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPinSetup(false)}
                  className="h-7 rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isDisabled={isSavingPin || !newPin || newPin.length < 4}
                  className="h-7 rounded-lg text-xs font-semibold shadow-xs"
                >
                  {isSavingPin ? "Saving..." : "Save PIN"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Import / Export Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Import */}
        <div className="flex flex-col justify-between space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <IconUpload className="size-4 text-foreground" />
              <h3 className="text-xs font-bold text-foreground">
                Import Passwords
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Import credentials from Bitwarden JSON or Akaromi backup.
              Credentials are encrypted client-side before syncing.
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
              isDisabled={!encryption.isActive || isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-full cursor-pointer gap-1.5 rounded-xl text-xs"
            >
              <IconUpload className="size-3.5" />
              {isImporting ? "Importing..." : "Choose File to Import"}
            </Button>
          </div>
        </div>

        {/* Export */}
        <div className="flex flex-col justify-between space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <IconDownload className="size-4 text-foreground" />
              <h3 className="text-xs font-bold text-foreground">
                Export Passwords
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Export an unencrypted JSON backup of all logins and credentials.
              Store this file in a secure encrypted volume.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            isDisabled={!encryption.isActive || isExporting}
            onClick={handleExport}
            className="h-9 w-full cursor-pointer gap-1.5 rounded-xl text-xs"
          >
            <IconDownload className="size-3.5" />
            {isExporting ? "Exporting..." : "Export Unencrypted JSON"}
          </Button>
        </div>
      </div>

      {importSummary && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 p-3 text-xs text-foreground">
          <IconCheck className="size-4 shrink-0" />
          <span>{importSummary}</span>
        </div>
      )}
    </div>
  )
}
