"use client"

import React, { useState, useEffect } from "react"
import { usePass } from "@/context/pass-context"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import Image from "next/image"
import {
  IconKey,
  IconTerminal2,
  IconStar,
  IconStarFilled,
  IconPencil,
  IconTrash,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconDownload,
  IconFolder,
  IconRestore,
  IconClock,
  IconFingerprint,
} from "@tabler/icons-react"
import { generateTotpCode, getTotpRemainingSeconds } from "@/lib/pass-totp"
import { toast } from "sonner"
import type { DecryptedLoginData, DecryptedSshKeyData } from "@/lib/pass-types"
import { CipherIcon } from "./pass-cipher-icon"

export function PassCipherDetail({
  onEditCipher,
}: {
  onEditCipher: (id: string) => void
}) {
  const {
    ciphers,
    folders,
    selectedCipherId,
    deleteCipher,
    restoreCipher,
    toggleFavorite,
    updateCipher,
  } = usePass()

  const [revealPassword, setRevealPassword] = useState(false)
  const [revealPrivateKey, setRevealPrivateKey] = useState(false)
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30)
  const [totpCode, setTotpCode] = useState("")
  const [nextTotpCode, setNextTotpCode] = useState("")
  const [revealedAdditional, setRevealedAdditional] = useState<
    Record<string, boolean>
  >({})

  const item = ciphers.find((c) => c.id === selectedCipherId)
  const folder = folders.find((f) => f.id === item?.folderId)

  // Live TOTP countdown timer
  useEffect(() => {
    if (!item || item.type !== "LOGIN") return
    const d = item.data as DecryptedLoginData
    if (!d.totpSecret) return

    const updateTotp = () => {
      const now = Date.now()
      setTotpCode(generateTotpCode(d.totpSecret!, now))
      const nextPeriodMs = (Math.floor(now / 1000 / 30) + 1) * 30 * 1000 + 1000
      setNextTotpCode(generateTotpCode(d.totpSecret!, nextPeriodMs))
      setTotpSecondsRemaining(getTotpRemainingSeconds(now))
    }

    updateTotp()
    const interval = setInterval(updateTotp, 1000)
    return () => clearInterval(interval)
  }, [item])

  if (!item) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-card/20 p-8 text-center text-muted-foreground">
        <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-muted/40 text-muted-foreground/50">
          <Image
            src="/iris-pass512left-ring.png"
            alt="IRIS Pass"
            width={36}
            height={36}
            className="opacity-40"
          />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          No Credential Selected
        </h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
          Select an item from the center list to view details, copy passwords,
          or generate TOTP codes.
        </p>
      </div>
    )
  }

  const isTrash = item.deletedAt !== null
  const isLogin = item.type === "LOGIN"
  const loginData = isLogin ? (item.data as DecryptedLoginData) : null
  const sshData = !isLogin ? (item.data as DecryptedSshKeyData) : null

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const handleDownloadPrivateKey = (pemContent: string, title: string) => {
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_id`
    const blob = new Blob([pemContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Private key downloaded")
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-card/20">
      {/* Detail Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border bg-card/40 p-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <CipherIcon item={item} size="lg" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-foreground">
                {item.title}
              </h2>
              {!isTrash && (
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className="text-muted-foreground transition-colors hover:text-amber-500"
                >
                  {item.favorite ? (
                    <IconStarFilled className="size-4 text-amber-500" />
                  ) : (
                    <IconStar className="size-4" />
                  )}
                </button>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-md px-2 py-0 text-[11px]"
              >
                {item.type === "LOGIN" ? "Login" : "SSH Key"}
              </Badge>
              {folder && (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-md border-border px-2 py-0 text-[11px] text-muted-foreground"
                >
                  <IconFolder className="size-3" />
                  <span>{folder.name}</span>
                </Badge>
              )}
              {isTrash && (
                <Badge
                  variant="destructive"
                  className="rounded-md px-2 py-0 text-[11px]"
                >
                  In Trash
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {!isTrash ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditCipher(item.id)}
                className="h-8 gap-1.5 rounded-xl border-border text-xs"
              >
                <IconPencil className="size-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteCipher(item.id, false)}
                className="h-8 rounded-xl text-xs text-muted-foreground hover:text-destructive"
              >
                <IconTrash className="me-1 size-3.5" />
                <span>Trash</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreCipher(item.id)}
                className="h-8 gap-1.5 rounded-xl border-border text-xs text-emerald-500"
              >
                <IconRestore className="size-3.5" />
                <span>Restore</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteCipher(item.id, true)}
                className="h-8 rounded-xl text-xs"
              >
                <IconTrash className="me-1 size-3.5" />
                <span>Delete Forever</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Detail Body */}
      <div className="space-y-6 p-6">
        {/* LOGIN FIELDS */}
        {isLogin && loginData && (
          <>
            {/* Username Row */}
            {loginData.username && (
              <div className="space-y-1.5 rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Username / Email
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-foreground select-all">
                    {loginData.username}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(loginData.username, "Username")}
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Password Row */}
            {loginData.password && (
              <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Primary Password
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-foreground select-all">
                    {revealPassword
                      ? loginData.password
                      : "••••••••••••••••••••"}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevealPassword(!revealPassword)}
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      {revealPassword ? (
                        <IconEyeOff className="size-4" />
                      ) : (
                        <IconEye className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleCopy(loginData.password, "Primary Password")
                      }
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <IconCopy className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Passwords & Access Codes */}
            {loginData.additionalPasswords &&
              loginData.additionalPasswords.length > 0 && (
                <div className="space-y-3">
                  {loginData.additionalPasswords.map((ap) => {
                    const isRevealed = Boolean(revealedAdditional[ap.id])
                    return (
                      <div
                        key={ap.id}
                        className="space-y-2 rounded-2xl border border-border bg-card/60 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            {ap.name || "Additional Password"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-medium text-foreground select-all">
                            {isRevealed ? ap.value : "••••••••••••••••••••"}
                          </span>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setRevealedAdditional((prev) => ({
                                  ...prev,
                                  [ap.id]: !prev[ap.id],
                                }))
                              }
                              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                              aria-label="Toggle password visibility"
                            >
                              {isRevealed ? (
                                <IconEyeOff className="size-4" />
                              ) : (
                                <IconEye className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCopy(ap.value, ap.name || "Password")
                              }
                              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                              aria-label="Copy password"
                            >
                              <IconCopy className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            {/* TOTP Authenticator Row */}
            {loginData.totpSecret && (
              <div className="space-y-2 rounded-2xl border border-border bg-[#d800a6]/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[#d800a6] uppercase">
                    <IconClock className="size-3.5" />
                    Authenticator
                  </span>

                  {/* Circular 30s Countdown Ring */}
                  <div className="relative flex size-6 items-center justify-center">
                    <svg className="size-6 -rotate-90">
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="fill-none stroke-muted"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="fill-none stroke-[#d800a6] transition-all duration-1000"
                        strokeWidth="2.5"
                        strokeDasharray={56.5}
                        strokeDashoffset={
                          56.5 * (1 - totpSecondsRemaining / 30)
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[9px] font-bold text-[#d800a6]">
                      {totpSecondsRemaining}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-2xl font-bold tracking-widest text-foreground select-all">
                      {totpCode.slice(0, 3)} {totpCode.slice(3)}
                    </span>
                    {nextTotpCode && nextTotpCode !== "------" && (
                      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <span className="font-sans text-[10px] tracking-wider text-muted-foreground/60 uppercase">
                          Next:
                        </span>
                        <span className="font-semibold text-foreground/80">
                          {nextTotpCode.slice(0, 3)} {nextTotpCode.slice(3)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(totpCode, "TOTP Code")}
                    className="h-8 gap-1.5 rounded-xl border-[#d800a6]/30 text-xs text-[#d800a6] hover:bg-[#d800a6]/10"
                  >
                    <IconCopy className="size-3.5" />
                    <span>Copy Code</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Passkey Row */}
            {loginData.passkey && (
              <div className="space-y-2 rounded-2xl border border-border bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                    <IconFingerprint className="size-4" />
                    Passkey
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Are you sure you want to delete this passkey?"
                        )
                      )
                        return
                      const updatedData = { ...loginData }
                      delete updatedData.passkey
                      await updateCipher(item.id, {
                        title: item.title,
                        folderId: item.folderId,
                        payload: updatedData,
                      })
                      toast.success("Passkey deleted")
                    }}
                    className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                  >
                    Delete Passkey
                  </Button>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {loginData.passkey.rpId}
                    </span>
                  </div>
                  {loginData.passkey.userName && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">User:</span>
                      <span className="text-foreground">
                        {loginData.passkey.userName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* URIs */}
            {loginData.uris && loginData.uris.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Websites
                </span>
                <div className="space-y-2">
                  {loginData.uris.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-xs text-foreground">
                          {u.uri}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(u.uri, "URI")}
                          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                          aria-label="Copy URL"
                        >
                          <IconCopy className="size-4" />
                        </Button>
                        <a
                          href={
                            u.uri.startsWith("http")
                              ? u.uri
                              : `https://${u.uri}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                          aria-label="Open URL"
                        >
                          <IconExternalLink className="size-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {loginData.notes && (
              <div className="space-y-1.5 rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Notes
                </span>
                <p className="font-sans text-sm whitespace-pre-wrap text-foreground">
                  {loginData.notes}
                </p>
              </div>
            )}
          </>
        )}

        {/* SSH KEY FIELDS */}
        {!isLogin && sshData && (
          <>
            {/* Algorithm & Fingerprint */}
            <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Fingerprint (SHA-256)
              </span>
              <div className="flex items-center justify-between">
                <span className="truncate font-mono text-xs text-foreground select-all">
                  {sshData.fingerprint}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(sshData.fingerprint, "Fingerprint")}
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            </div>

            {/* OpenSSH Public Key */}
            <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Public Key (OpenSSH Format)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(sshData.publicKey, "Public Key")}
                  className="h-7 gap-1 rounded-xl border-border text-xs"
                >
                  <IconCopy className="size-3.5" />
                  <span>Copy Public Key</span>
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto rounded-xl bg-muted/40 p-3 font-mono text-xs break-all text-foreground select-all">
                {sshData.publicKey}
              </div>
            </div>

            {/* Private Key */}
            <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Private Key
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevealPrivateKey(!revealPrivateKey)}
                    className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {revealPrivateKey ? (
                      <IconEyeOff className="size-3.5" />
                    ) : (
                      <IconEye className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDownloadPrivateKey(sshData.privateKey, item.title)
                    }
                    className="h-7 gap-1 rounded-xl border-border text-xs"
                  >
                    <IconDownload className="size-3.5" />
                    <span>Download</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopy(sshData.privateKey, "Private Key")
                    }
                    className="h-7 gap-1 rounded-xl border-border text-xs"
                  >
                    <IconCopy className="size-3.5" />
                    <span>Copy</span>
                  </Button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-xl bg-muted/40 p-3 font-mono text-xs break-all text-foreground select-all">
                {revealPrivateKey
                  ? sshData.privateKey
                  : "••••••••••••••••••••••••••••••••••••••••••••••••••\n••••••••••••••••••••••••••••••••••••••••••••••••••\n••••••••••••••••••••••••••••••••••••••••••••••••••"}
              </div>
            </div>

            {/* Passphrase */}
            {sshData.passphrase && (
              <div className="space-y-1.5 rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Key Passphrase
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-foreground select-all">
                    {sshData.passphrase}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(sshData.passphrase!, "Passphrase")
                    }
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Notes */}
            {sshData.notes && (
              <div className="space-y-1.5 rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Notes
                </span>
                <p className="font-sans text-sm whitespace-pre-wrap text-foreground">
                  {sshData.notes}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
