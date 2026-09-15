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
  const [revealedAdditional, setRevealedAdditional] = useState<Record<string, boolean>>({})

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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-card/20 h-full">
        <div className="size-16 rounded-3xl bg-muted/40 flex items-center justify-center mb-4 text-muted-foreground/50">
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
        <p className="text-xs text-muted-foreground/80 max-w-xs mt-1">
          Select an item from the center list to view details, copy passwords, or generate TOTP codes.
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
    <div className="flex-1 flex flex-col min-w-0 bg-card/20 h-full overflow-y-auto">
      {/* Detail Header */}
      <div className="p-6 border-b border-border bg-card/40 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <CipherIcon item={item} size="lg" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground truncate">
                {item.title}
              </h2>
              {!isTrash && (
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className="text-muted-foreground hover:text-amber-500 transition-colors"
                >
                  {item.favorite ? (
                    <IconStarFilled className="size-4 text-amber-500" />
                  ) : (
                    <IconStar className="size-4" />
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[11px] rounded-md px-2 py-0">
                {item.type === "LOGIN" ? "Login" : "SSH Key"}
              </Badge>
              {folder && (
                <Badge
                  variant="outline"
                  className="text-[11px] rounded-md px-2 py-0 border-border text-muted-foreground gap-1"
                >
                  <IconFolder className="size-3" />
                  <span>{folder.name}</span>
                </Badge>
              )}
              {isTrash && (
                <Badge variant="destructive" className="text-[11px] rounded-md px-2 py-0">
                  In Trash
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {!isTrash ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditCipher(item.id)}
                className="rounded-xl border-border h-8 gap-1.5 text-xs"
              >
                <IconPencil className="size-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteCipher(item.id, false)}
                className="rounded-xl h-8 text-muted-foreground hover:text-destructive text-xs"
              >
                <IconTrash className="size-3.5 me-1" />
                <span>Trash</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreCipher(item.id)}
                className="rounded-xl border-border h-8 gap-1.5 text-xs text-emerald-500"
              >
                <IconRestore className="size-3.5" />
                <span>Restore</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteCipher(item.id, true)}
                className="rounded-xl h-8 text-xs"
              >
                <IconTrash className="size-3.5 me-1" />
                <span>Delete Forever</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Detail Body */}
      <div className="p-6 space-y-6">
        {/* LOGIN FIELDS */}
        {isLogin && loginData && (
          <>
            {/* Username Row */}
            {loginData.username && (
              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Username / Email
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground select-all font-mono">
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
              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Primary Password
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground font-mono select-all">
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
                      onClick={() => handleCopy(loginData.password, "Primary Password")}
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <IconCopy className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Passwords & Access Codes */}
            {loginData.additionalPasswords && loginData.additionalPasswords.length > 0 && (
              <div className="space-y-3">
                {loginData.additionalPasswords.map((ap) => {
                  const isRevealed = Boolean(revealedAdditional[ap.id])
                  return (
                    <div
                      key={ap.id}
                      className="rounded-2xl border border-border bg-card/60 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {ap.name || "Additional Password"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground font-mono select-all">
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
                            onClick={() => handleCopy(ap.value, ap.name || "Password")}
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
              <div className="rounded-2xl border border-border bg-[#d800a6]/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#d800a6] uppercase tracking-wider flex items-center gap-1.5">
                    <IconClock className="size-3.5" />
                    Authenticator
                  </span>

                  {/* Circular 30s Countdown Ring */}
                  <div className="relative size-6 flex items-center justify-center">
                    <svg className="size-6 -rotate-90">
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="stroke-muted fill-none"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="stroke-[#d800a6] fill-none transition-all duration-1000"
                        strokeWidth="2.5"
                        strokeDasharray={56.5}
                        strokeDashoffset={56.5 * (1 - totpSecondsRemaining / 30)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[9px] font-bold text-[#d800a6]">
                      {totpSecondsRemaining}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-baseline gap-4">
                    <span className="text-2xl font-bold font-mono tracking-widest text-foreground select-all">
                      {totpCode.slice(0, 3)} {totpCode.slice(3)}
                    </span>
                    {nextTotpCode && nextTotpCode !== "------" && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <span className="text-[10px] uppercase font-sans tracking-wider text-muted-foreground/60">Next:</span>
                        <span className="font-semibold text-foreground/80">{nextTotpCode.slice(0, 3)} {nextTotpCode.slice(3)}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(totpCode, "TOTP Code")}
                    className="rounded-xl border-[#d800a6]/30 text-[#d800a6] hover:bg-[#d800a6]/10 gap-1.5 h-8 text-xs"
                  >
                    <IconCopy className="size-3.5" />
                    <span>Copy Code</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Passkey Row */}
            {loginData.passkey && (
              <div className="rounded-2xl border border-border bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <IconFingerprint className="size-4" />
                    Passkey
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm("Are you sure you want to delete this passkey?")) return
                      const updatedData = { ...loginData }
                      delete updatedData.passkey
                      await updateCipher(item.id, {
                        title: item.title,
                        folderId: item.folderId,
                        payload: updatedData,
                      })
                      toast.success("Passkey deleted")
                    }}
                    className="text-destructive hover:text-destructive h-6 px-2 text-[11px]"
                  >
                    Delete Passkey
                  </Button>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {loginData.passkey.rpId}
                    </span>
                  </div>
                  {loginData.passkey.userName && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">User:</span>
                      <span className="text-foreground">{loginData.passkey.userName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* URIs */}
            {loginData.uris && loginData.uris.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Websites
                </span>
                <div className="space-y-2">
                  {loginData.uris.map((u, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="truncate text-foreground font-mono text-xs">{u.uri}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
                          href={u.uri.startsWith("http") ? u.uri : `https://${u.uri}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted"
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
              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Notes
                </span>
                <p className="text-sm text-foreground whitespace-pre-wrap font-sans">
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
            <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Fingerprint (SHA-256)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-foreground select-all truncate">
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
            <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Public Key (OpenSSH Format)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(sshData.publicKey, "Public Key")}
                  className="rounded-xl border-border h-7 text-xs gap-1"
                >
                  <IconCopy className="size-3.5" />
                  <span>Copy Public Key</span>
                </Button>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl font-mono text-xs text-foreground break-all max-h-32 overflow-y-auto select-all">
                {sshData.publicKey}
              </div>
            </div>

            {/* Private Key */}
            <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Private Key
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevealPrivateKey(!revealPrivateKey)}
                    className="size-7 text-muted-foreground hover:text-foreground rounded-lg"
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
                    className="rounded-xl border-border h-7 text-xs gap-1"
                  >
                    <IconDownload className="size-3.5" />
                    <span>Download</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(sshData.privateKey, "Private Key")}
                    className="rounded-xl border-border h-7 text-xs gap-1"
                  >
                    <IconCopy className="size-3.5" />
                    <span>Copy</span>
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl font-mono text-xs text-foreground break-all max-h-40 overflow-y-auto select-all">
                {revealPrivateKey
                  ? sshData.privateKey
                  : "••••••••••••••••••••••••••••••••••••••••••••••••••\n••••••••••••••••••••••••••••••••••••••••••••••••••\n••••••••••••••••••••••••••••••••••••••••••••••••••"}
              </div>
            </div>

            {/* Passphrase */}
            {sshData.passphrase && (
              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Key Passphrase
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-foreground select-all">
                    {sshData.passphrase}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(sshData.passphrase!, "Passphrase")}
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Notes */}
            {sshData.notes && (
              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Notes
                </span>
                <p className="text-sm text-foreground whitespace-pre-wrap font-sans">
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
