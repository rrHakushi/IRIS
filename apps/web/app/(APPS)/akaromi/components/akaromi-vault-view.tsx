"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { usePass } from "@/context/pass-context"
import { PassCipherList } from "./pass-cipher-list"
import { PassCipherDetail } from "./pass-cipher-detail"
import { PassCipherModal } from "./pass-cipher-modal"
import { PassGeneratorDialog } from "./pass-generator-dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  IconLock,
  IconLockOpen,
  IconKey,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconSearch,
  IconX,
  IconUser,
  IconPencil,
  IconCreditCard,
  IconTerminal2,
  IconId,
  IconDots,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { AkaromiSubtype } from "@/lib/pass-types"

interface AkaromiVaultViewProps {
  filter?: string
}

export function AkaromiVaultView({ filter = "all" }: AkaromiVaultViewProps) {
  const {
    isUnlocked,
    activeFilter,
    setActiveFilter,
    ciphers,
    lockVault,
    unlockVault,
    unlockWithPin,
    isPinUnlockAvailable,
    refreshData,
    emptyTrash,
    selectedCipherId,
    searchQuery,
    setSearchQuery,
    copySensitiveText,
  } = usePass()

  // Sync route filter with activeFilter
  useEffect(() => {
    setActiveFilter(filter)
  }, [filter, setActiveFilter])

  // Hydration safety
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Modals / Drawer state
  const [modalOpen, setModalOpen] = useState(false)
  const [editCipherId, setEditCipherId] = useState<string | null>(null)
  const [modalInitialSubtype, setModalInitialSubtype] =
    useState<AkaromiSubtype>("login")
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Unlock state
  const [unlockMode, setUnlockMode] = useState<"pin" | "password">("pin")
  const [pin, setPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Auto-select PIN mode if available
  useEffect(() => {
    if (isPinUnlockAvailable) {
      setUnlockMode("pin")
    } else {
      setUnlockMode("password")
    }
  }, [isPinUnlockAvailable])

  // Handle PIN unlock
  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) return

    setIsUnlocking(true)
    setUnlockError(null)

    const result = await unlockWithPin(pin.trim())
    setIsUnlocking(false)

    if (result.success) {
      setPin("")
      toast.success("Vault unlocked")
    } else {
      setUnlockError(result.error || "Incorrect PIN. Please try again.")
    }
  }

  // Handle Password unlock
  const handleUnlockPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setIsUnlocking(true)
    setUnlockError(null)

    const result = await unlockVault(password)
    setIsUnlocking(false)

    if (result.success) {
      setPassword("")
      toast.success("Vault unlocked")
    } else {
      setUnlockError(result.error || "Incorrect account password. Please try again.")
    }
  }

  // Handle Vault Sync
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await refreshData()
      toast.success("Vault synced")
    } catch {
      toast.error("Failed to sync vault")
    } finally {
      setIsSyncing(false)
    }
  }

  // Pre-hydration placeholder
  if (!isMounted) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-10 animate-pulse items-center justify-center rounded-2xl bg-muted">
            <Image
              src="/iris-pass512left-ring.png"
              alt="Akaromi"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="animate-pulse text-xs text-muted-foreground">
            Loading vault...
          </span>
        </div>
      </div>
    )
  }

  // ========================================================
  // LOCKED SCREEN
  // ========================================================
  if (!isUnlocked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-background/50 p-6 backdrop-blur-xs">
        <div className="w-full max-w-sm space-y-6 rounded-3xl border border-border/80 bg-card/90 p-8 shadow-2xl backdrop-blur-md">
          {/* Locked Header */}
          <div className="space-y-1.5 text-center">
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Akaromi is locked
            </h1>
            <p className="text-xs text-muted-foreground">
              {isPinUnlockAvailable && unlockMode === "pin"
                ? "Enter your PIN to unlock your vault."
                : "Enter your account password to unlock your vault."}
            </p>
          </div>

          {/* Form */}
          {isPinUnlockAvailable && unlockMode === "pin" ? (
            <form onSubmit={handleUnlockPin} className="space-y-4">
              {unlockError && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <IconAlertCircle className="size-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoFocus
                    maxLength={12}
                    className="h-11 rounded-2xl pe-10 text-center font-mono text-base tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPin ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                isDisabled={isUnlocking || !pin.trim()}
                className="h-10 w-full cursor-pointer rounded-2xl text-xs font-semibold shadow-md"
              >
                <IconKey className="me-2 size-4" />
                {isUnlocking ? "Unlocking..." : "Unlock with PIN"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode("password")
                    setUnlockError(null)
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground underline underline-offset-4"
                >
                  Unlock with Account Password
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUnlockPassword} className="space-y-4">
              {unlockError && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <IconAlertCircle className="size-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Account password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="h-11 rounded-2xl pe-10 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                isDisabled={isUnlocking || !password.trim()}
                className="h-10 w-full cursor-pointer rounded-2xl text-xs font-semibold shadow-md"
              >
                <IconLockOpen className="me-2 size-4" />
                {isUnlocking ? "Decrypting..." : "Unlock Vault"}
              </Button>

              {isPinUnlockAvailable && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setUnlockMode("pin")
                      setUnlockError(null)
                    }}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground underline underline-offset-4"
                  >
                    Use PIN instead
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    )
  }

  // ========================================================
  // UNLOCKED MAIN VIEW (FIREFOX EXTENSION HEADER DESIGN)
  // ========================================================
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Top Header - Exact Firefox Extension Design */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-card/60 px-4 backdrop-blur-sm sm:px-6">
        {/* Search in all items Pill Input */}
        <div className="relative flex-1 max-w-xl">
          <IconSearch className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in all items..."
            className="h-9 w-full rounded-full border-border/60 bg-muted/40 ps-9.5 pe-8 text-xs transition-colors focus:bg-background focus:border-border"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>

        {/* Right Actions: Sync + (+) Create New Button */}
        <div className="flex items-center gap-2">
          {activeFilter === "trash" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (
                  confirm(
                    "Are you sure you want to permanently delete all items in the trash?"
                  )
                ) {
                  await emptyTrash()
                }
              }}
              isDisabled={
                ciphers.filter((c) => c.deletedAt !== null).length === 0
              }
              className="h-9 cursor-pointer gap-1.5 rounded-full px-3 text-xs shadow-xs"
            >
              <IconTrash className="size-3.5" />
              <span>Empty Trash</span>
            </Button>
          )}

          {/* Sync Pill Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-secondary/80 px-3.5 text-xs font-medium text-secondary-foreground shadow-2xs transition-colors hover:bg-secondary disabled:opacity-60"
            title="Sync Vault"
          >
            <IconRefresh className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          {/* (+) Add Button with Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:opacity-90 active:scale-95"
              aria-label="Add item"
              aria-haspopup="true"
              aria-expanded={addMenuOpen}
            >
              <IconPlus className="size-4.5" strokeWidth={2.5} />
            </button>

            {addMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAddMenuOpen(false)}
                />
                <div className="absolute end-0 top-11 z-50 w-48 rounded-2xl border border-border bg-popover p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    CREATE NEW
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setEditCipherId(null)
                      setModalInitialSubtype("login")
                      setModalOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconUser className="size-4 shrink-0 text-foreground" />
                    <span>Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setEditCipherId(null)
                      setModalInitialSubtype("note")
                      setModalOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconPencil className="size-4 shrink-0 text-foreground" />
                    <span>Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setEditCipherId(null)
                      setModalInitialSubtype("card")
                      setModalOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconCreditCard className="size-4 shrink-0 text-foreground" />
                    <span>Credit Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setEditCipherId(null)
                      setModalInitialSubtype("ssh")
                      setModalOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconTerminal2 className="size-4 shrink-0 text-foreground" />
                    <span>SSH Key</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setEditCipherId(null)
                      setModalInitialSubtype("identity")
                      setModalOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconId className="size-4 shrink-0 text-foreground" />
                    <span>Identity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setEditCipherId(null)
                      setModalInitialSubtype("other")
                      setModalOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconDots className="size-4 shrink-0 text-foreground" />
                    <span>Other</span>
                  </button>
                  <div className="my-1 border-t border-border/50" />
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setGeneratorOpen(true)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <IconKey className="size-4 shrink-0 text-foreground" />
                    <span>Password</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Lock Vault Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              lockVault()
              toast.info("Vault locked")
            }}
            className="size-9 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Lock vault"
          >
            <IconLock className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Dual-Pane Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Items List */}
        <div className="flex h-full w-full shrink-0 flex-col overflow-hidden border-e border-border sm:w-80 md:w-96 lg:w-[420px]">
          <PassCipherList
            onOpenNewCipher={(sub) => {
              setEditCipherId(null)
              if (sub) setModalInitialSubtype(sub)
              setModalOpen(true)
            }}
          />
        </div>

        {/* Right Column: Item Detail Pane */}
        <div className="hidden h-full flex-1 overflow-y-auto bg-card/10 sm:flex">
          <PassCipherDetail
            onEditCipher={(id) => {
              setEditCipherId(id)
              setModalOpen(true)
            }}
          />
        </div>
      </div>

      {/* Create / Edit Cipher Drawer */}
      <PassCipherModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editCipherId={editCipherId}
        initialSubtype={modalInitialSubtype}
      />

      {/* Password Generator Dialog */}
      <PassGeneratorDialog
        isOpen={generatorOpen}
        onOpenChange={setGeneratorOpen}
        onApplyPassword={(pwd) => {
          copySensitiveText(pwd, "Generated Password")
        }}
      />
    </div>
  )
}
