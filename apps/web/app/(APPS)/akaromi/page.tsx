"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { usePass } from "@/context/pass-context"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconLock,
  IconLockOpen,
  IconKey,
  IconShieldLock,
  IconCreditCard,
  IconNote,
  IconTerminal2,
  IconId,
  IconStar,
  IconSparkles,
  IconPlus,
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconRefresh,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { CipherIcon } from "./components/pass-cipher-icon"
import { PassCipherModal } from "./components/pass-cipher-modal"
import { PassGeneratorDialog } from "./components/pass-generator-dialog"
import { calculatePasswordEntropy } from "@/lib/pass-generator"
import type { AkaromiSubtype, DecryptedLoginData } from "@/lib/pass-types"

export default function AkaromiDashboardPage() {
  const router = useRouter()
  const {
    isUnlocked,
    isLoading,
    ciphers,
    lockVault,
    unlockVault,
    unlockWithPin,
    isPinUnlockAvailable,
    refreshData,
    copySensitiveText,
    setSelectedCipherId,
  } = usePass()

  // Hydration safety
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialSubtype, setModalInitialSubtype] = useState<AkaromiSubtype>("login")
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

  useEffect(() => {
    if (isPinUnlockAvailable) {
      setUnlockMode("pin")
    } else {
      setUnlockMode("password")
    }
  }, [isPinUnlockAvailable])

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

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await refreshData()
      toast.success("Vault synchronized")
    } catch {
      toast.error("Failed to sync vault")
    } finally {
      setIsSyncing(false)
    }
  }

  // Active ciphers (exclude deleted/trash)
  const activeCiphers = useMemo(() => {
    return ciphers.filter((c) => c.deletedAt === null)
  }, [ciphers])

  // Counts by subtype
  const counts = useMemo(() => {
    let logins = 0
    let notes = 0
    let cards = 0
    let ssh = 0
    let identities = 0
    let favorites = 0
    let weakPasswords = 0

    for (const c of activeCiphers) {
      if (c.favorite) favorites++
      const subtype = c.data?.itemType || (c.type === "SSH_KEY" ? "ssh" : "login")

      if (subtype === "login") {
        logins++
        const pwd = (c.data as DecryptedLoginData)?.password
        if (pwd) {
          const score = calculatePasswordEntropy(pwd)
          if (score.entropyBits < 40) weakPasswords++
        }
      } else if (subtype === "note") {
        notes++
      } else if (subtype === "card") {
        cards++
      } else if (subtype === "ssh") {
        ssh++
      } else if (subtype === "identity") {
        identities++
      }
    }

    return {
      total: activeCiphers.length,
      logins,
      notes,
      cards,
      ssh,
      identities,
      favorites,
      weakPasswords,
    }
  }, [activeCiphers])

  // Recent items
  const recentItems = useMemo(() => {
    return [...activeCiphers]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  }, [activeCiphers])

  // Favorite items
  const favoriteItems = useMemo(() => {
    return activeCiphers.filter((c) => c.favorite).slice(0, 5)
  }, [activeCiphers])

  if (!isMounted) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Image
            src="/iris-pass512left-ring.png"
            alt="Akaromi"
            width={16}
            height={16}
            className="animate-pulse object-contain"
          />
          <span>Loading Akaromi...</span>
        </div>
      </div>
    )
  }

  // LOCKED STATE
  if (!isUnlocked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 rounded-3xl border border-border/80 bg-card/60 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 shadow-inner">
              <IconLock className="size-7 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Akaromi Vault
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Unlock your encrypted vault to access your credentials, notes, and cards.
            </p>
          </div>

          {unlockError && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <IconAlertCircle className="size-4 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          {unlockMode === "pin" ? (
            <form onSubmit={handleUnlockPin} className="space-y-4">
              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    placeholder="Enter PIN..."
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoFocus
                    className="h-12 rounded-2xl text-center text-lg tracking-widest pe-10"
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
                <IconLockOpen className="me-2 size-4" />
                {isUnlocking ? "Decrypting..." : "Unlock with PIN"}
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
                  Use Master Password instead
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUnlockPassword} className="space-y-4">
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

  // UNLOCKED DASHBOARD
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Top Header & Quick Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Dashboard
              </h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold uppercase tracking-wider">
                Vault Unlocked
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Overview of your secure passwords, encrypted notes, and sensitive records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              isDisabled={isSyncing}
              className="h-9 gap-1.5 rounded-full px-3 text-xs"
            >
              <IconRefresh className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setGeneratorOpen(true)}
              className="h-9 gap-1.5 rounded-full px-3 text-xs"
            >
              <IconSparkles className="size-3.5" />
              <span>Generator</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setModalInitialSubtype("login")
                setModalOpen(true)
              }}
              className="h-9 gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-xs"
            >
              <IconPlus className="size-4" strokeWidth={2.5} />
              <span>New Item</span>
            </Button>

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
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href="/akaromi/vault"
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">All Items</span>
              <IconShieldLock className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{counts.total}</div>
          </Link>

          <Link
            href="/akaromi/vault/logins"
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Logins</span>
              <IconKey className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{counts.logins}</div>
          </Link>

          <Link
            href="/akaromi/vault/notes"
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Notes</span>
              <IconNote className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{counts.notes}</div>
          </Link>

          <Link
            href="/akaromi/vault/cards"
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Cards</span>
              <IconCreditCard className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{counts.cards}</div>
          </Link>

          <Link
            href="/akaromi/vault/favorites"
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Favorites</span>
              <IconStar className="size-4 text-amber-500/80 group-hover:text-amber-500 transition-colors" />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{counts.favorites}</div>
          </Link>

          <Link
            href="/akaromi/vault/ssh"
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-border hover:bg-card hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">SSH Keys</span>
              <IconTerminal2 className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{counts.ssh}</div>
          </Link>
        </div>

        {/* Dual Column: Favorites & Recent Items */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Favorites Section */}
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconStar className="size-4 text-amber-500" />
                <h2 className="text-sm font-bold text-foreground">Favorite Logins</h2>
              </div>
              <Link
                href="/akaromi/vault/favorites"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>View all</span>
                <IconArrowRight className="size-3" />
              </Link>
            </div>

            {favoriteItems.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                <span>No favorite items starred yet</span>
                <span className="mt-1 text-[11px] text-muted-foreground/80">Star important logins in your vault for fast access</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {favoriteItems.map((item) => {
                  const login = item.data as DecryptedLoginData
                  const username = login?.username || login?.email || ""
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedCipherId(item.id)
                        router.push("/akaromi/vault")
                      }}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/80 p-3 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CipherIcon item={item} size="md" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {item.title}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {username || "No username"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {username && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySensitiveText(username, "Username")}
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label="Copy Username"
                          >
                            <IconCopy className="size-3.5" />
                          </Button>
                        )}
                        {login?.password && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySensitiveText(login.password, "Password")}
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label="Copy Password"
                          >
                            <IconKey className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Items Section */}
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconShieldLock className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Recently Modified</h2>
              </div>
              <Link
                href="/akaromi/vault"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Open Vault</span>
                <IconArrowRight className="size-3" />
              </Link>
            </div>

            {recentItems.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                <span>No items stored in your vault yet</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentItems.map((item) => {
                  const login = item.data as DecryptedLoginData
                  const username = login?.username || login?.email || ""
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedCipherId(item.id)
                        router.push("/akaromi/vault")
                      }}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/80 p-3 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CipherIcon item={item} size="md" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {item.title}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {username || item.type.toLowerCase()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {username && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySensitiveText(username, "Username")}
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label="Copy Username"
                          >
                            <IconCopy className="size-3.5" />
                          </Button>
                        )}
                        {login?.password && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySensitiveText(login.password, "Password")}
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label="Copy Password"
                          >
                            <IconKey className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Cipher Drawer */}
      <PassCipherModal
        open={modalOpen}
        onOpenChange={setModalOpen}
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
