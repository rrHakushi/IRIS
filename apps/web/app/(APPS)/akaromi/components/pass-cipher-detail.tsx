"use client"

import React, { useState, useEffect, useMemo } from "react"
import { usePass } from "@/context/pass-context"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconKey,
  IconNote,
  IconCreditCard,
  IconTerminal2,
  IconId,
  IconFileText,
  IconStar,
  IconStarFilled,
  IconPencil,
  IconTrash,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconDownload,
  IconRestore,
  IconFingerprint,
  IconShieldCheck,
  IconClock,
  IconSparkles,
} from "@tabler/icons-react"
import { generateTotpCode, getTotpRemainingSeconds } from "@/lib/pass-totp"
import { calculatePasswordEntropy } from "@/lib/pass-generator"
import { extractDomain } from "@/lib/pass-matching"
import { toast } from "sonner"
import type {
  DecryptedLoginData,
  DecryptedNoteData,
  DecryptedCardData,
  DecryptedSshKeyData,
  DecryptedIdentityData,
  DecryptedOtherData,
} from "@/lib/pass-types"
import { CipherIcon } from "./pass-cipher-icon"

export function PassCipherDetail({
  onEditCipher,
}: {
  onEditCipher: (id: string) => void
}) {
  const {
    ciphers,
    selectedCipherId,
    deleteCipher,
    restoreCipher,
    toggleFavorite,
    copySensitiveText,
  } = usePass()

  const [revealPassword, setRevealPassword] = useState(false)
  const [revealPrivateKey, setRevealPrivateKey] = useState(false)
  const [revealCardNumber, setRevealCardNumber] = useState(false)
  const [revealCardCvv, setRevealCardCvv] = useState(false)
  const [revealCardPin, setRevealCardPin] = useState(false)
  const [revealedAdditional, setRevealedAdditional] = useState<
    Record<string, boolean>
  >({})
  const [revealedCustom, setRevealedCustom] = useState<Record<number, boolean>>(
    {}
  )

  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30)
  const [totpCode, setTotpCode] = useState("")
  const [nextTotpCode, setNextTotpCode] = useState("")

  const item = ciphers.find((c) => c.id === selectedCipherId)

  // Reset reveals on item switch
  useEffect(() => {
    setRevealPassword(false)
    setRevealPrivateKey(false)
    setRevealCardNumber(false)
    setRevealCardCvv(false)
    setRevealCardPin(false)
    setRevealedAdditional({})
    setRevealedCustom({})
  }, [selectedCipherId])

  // Live TOTP countdown timer
  useEffect(() => {
    if (!item) return
    const subtype =
      item.data?.itemType || (item.type === "SSH_KEY" ? "ssh" : "login")
    if (subtype !== "login") return

    const d = item.data as DecryptedLoginData
    if (!d?.totpSecret) return

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
    return <div className="hidden h-full flex-1 sm:block" />
  }

  const isTrash = item.deletedAt !== null
  const subtype =
    item.data?.itemType || (item.type === "SSH_KEY" ? "ssh" : "login")

  const loginData = subtype === "login" ? (item.data as DecryptedLoginData) : null
  const noteData = subtype === "note" ? (item.data as DecryptedNoteData) : null
  const cardData = subtype === "card" ? (item.data as DecryptedCardData) : null
  const sshData = subtype === "ssh" ? (item.data as DecryptedSshKeyData) : null
  const identityData =
    subtype === "identity" ? (item.data as DecryptedIdentityData) : null
  const otherData =
    subtype === "other" ? (item.data as DecryptedOtherData) : null

  // Password entropy score
  const pwdEntropy = loginData?.password
    ? calculatePasswordEntropy(loginData.password)
    : null

  // Card brand
  const cardBrand = cardData?.cardNumber
    ? (() => {
        const raw = cardData.cardNumber.replace(/\D/g, "")
        if (raw.startsWith("4")) return "Visa"
        if (/^5[1-5]/.test(raw) || /^2[2-7]/.test(raw)) return "Mastercard"
        if (/^3[47]/.test(raw)) return "Amex"
        if (/^6(?:011|5)/.test(raw)) return "Discover"
        return "Card"
      })()
    : null

  // Download SSH private key PEM file
  const handleDownloadPrivateKey = (pemContent: string, itemTitle: string) => {
    const filename = `${itemTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}_id`
    const blob = new Blob([pemContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Private key downloaded")
  }

  // Primary URL or domain
  const primaryDomain = loginData?.uris?.[0]?.uri
    ? extractDomain(loginData.uris[0].uri)
    : null

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-card/10">
      {/* Detail Header matching Screenshot 1 & 5 */}
      <div className="flex flex-col gap-4 border-b border-border/80 bg-card/40 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
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
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    title={item.favorite ? "Unpin / Unfavorite" : "Favorite"}
                  >
                    {item.favorite ? (
                      <IconStarFilled className="size-4 text-foreground" />
                    ) : (
                      <IconStar className="size-4" />
                    )}
                  </button>
                )}
              </div>

              {primaryDomain && (
                <a
                  href={loginData?.uris?.[0]?.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="truncate">{loginData?.uris?.[0]?.uri}</span>
                  <IconExternalLink className="size-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center gap-1.5">
            {!isTrash ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditCipher(item.id)}
                  className="h-8 gap-1.5 rounded-xl text-xs"
                >
                  <IconPencil className="size-3.5" />
                  <span>Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCipher(item.id, false)}
                  className="size-8 rounded-xl text-muted-foreground hover:text-destructive"
                  aria-label="Move to Trash"
                >
                  <IconTrash className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreCipher(item.id)}
                  className="h-8 gap-1.5 rounded-xl text-xs"
                >
                  <IconRestore className="size-3.5" />
                  <span>Restore</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (
                      confirm("Are you sure you want to permanently delete this item?")
                    ) {
                      deleteCipher(item.id, true)
                    }
                  }}
                  className="h-8 gap-1.5 rounded-xl text-xs"
                >
                  <IconTrash className="size-3.5" />
                  <span>Delete Permanently</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Grouped Cards Content */}
      <div className="space-y-4 p-5 sm:p-6">
        {/* ======================================================== */}
        {/* SUBTYPE: LOGIN */}
        {/* ======================================================== */}
        {subtype === "login" && loginData && (
          <>
            {/* Credentials Card */}
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Credentials
              </span>

              {/* Username */}
              {loginData.username && (
                <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                  <div>
                    <span className="text-[11px] text-muted-foreground">Username</span>
                    <p className="text-sm font-semibold text-foreground">
                      {loginData.username}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copySensitiveText(loginData.username, "Username")
                    }
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                    aria-label="Copy Username"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              )}

              {/* Email */}
              {loginData.email && (
                <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                  <div>
                    <span className="text-[11px] text-muted-foreground">Email</span>
                    <p className="text-sm font-semibold text-foreground">
                      {loginData.email}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copySensitiveText(loginData.email!, "Email")}
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                    aria-label="Copy Email"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              )}

              {/* Password */}
              {loginData.password && (
                <div className="space-y-1.5 py-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-muted-foreground">Password</span>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {revealPassword
                          ? loginData.password
                          : "••••••••••••••••"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRevealPassword(!revealPassword)}
                        className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                        aria-label={revealPassword ? "Hide password" : "Show password"}
                      >
                        {revealPassword ? (
                          <IconEyeOff className="size-4" />
                        ) : (
                          <IconEye className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copySensitiveText(loginData.password, "Password")
                        }
                        className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                        aria-label="Copy Password"
                      >
                        <IconCopy className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Password Strength Shield Bar */}
                  {pwdEntropy && (
                    <div className="flex items-center gap-2 pt-1">
                      <IconShieldCheck className="size-4 text-foreground" />
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pwdEntropy.score === 4
                              ? "w-full bg-primary"
                              : pwdEntropy.score === 3
                                ? "w-3/4 bg-primary/80"
                                : pwdEntropy.score === 2
                                  ? "w-1/2 bg-primary/60"
                                  : "w-1/4 bg-primary/40"
                          }`}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        {pwdEntropy.score === 4 ? "100/100" : `${pwdEntropy.score * 25}/100`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Passwords */}
              {loginData.additionalPasswords &&
                loginData.additionalPasswords.map((ap) => {
                  const isRevealed = Boolean(revealedAdditional[ap.id])
                  return (
                    <div
                      key={ap.id}
                      className="flex items-center justify-between border-t border-border/40 py-1 pt-2"
                    >
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          {ap.name || "Secondary Password"}
                        </span>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {isRevealed ? ap.value : "••••••••••••"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setRevealedAdditional((prev) => ({
                              ...prev,
                              [ap.id]: !prev[ap.id],
                            }))
                          }
                          className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                        >
                          {isRevealed ? (
                            <IconEyeOff className="size-4" />
                          ) : (
                            <IconEye className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            copySensitiveText(ap.value, ap.name || "Password")
                          }
                          className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                        >
                          <IconCopy className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* 2FA Card with Circular Countdown matching Screenshot 1 */}
            {loginData.totpSecret && (
              <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2FA Verification Code
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySensitiveText(totpCode, "2FA Code")}
                    className="h-7 gap-1 rounded-lg text-xs text-primary hover:text-primary/80"
                  >
                    <IconCopy className="size-3" />
                    <span>Copy</span>
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-3xl font-extrabold tracking-wider text-foreground">
                      {totpCode.slice(0, 3)} {totpCode.slice(3)}
                    </div>
                    {nextTotpCode && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Next: <span className="font-mono font-medium">{nextTotpCode.slice(0, 3)} {nextTotpCode.slice(3)}</span>
                      </div>
                    )}
                  </div>

                  {/* Circular SVG progress ring */}
                  <div className="relative flex size-12 items-center justify-center">
                    <svg className="size-12 -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        className="stroke-muted"
                        strokeWidth="3.5"
                        fill="none"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        className="stroke-primary transition-all duration-1000 ease-linear"
                        strokeWidth="3.5"
                        strokeDasharray={125.6}
                        strokeDashoffset={
                          125.6 - (totpSecondsRemaining / 30) * 125.6
                        }
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span className="absolute font-mono text-xs font-bold text-foreground">
                      {totpSecondsRemaining}s
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Passkey Card */}
            {loginData.passkey && (
              <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Passkey
                </span>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground">
                    <IconFingerprint className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {loginData.passkey.rpId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {loginData.passkey.createdAt ? new Date(loginData.passkey.createdAt).toLocaleDateString() : "Saved"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Websites Card */}
            {loginData.uris && loginData.uris.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Websites
                </span>
                <div className="space-y-1.5">
                  {loginData.uris.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs"
                    >
                      <a
                        href={u.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-foreground hover:underline"
                      >
                        {u.uri}
                      </a>
                      <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Fields Card */}
            {loginData.customFields && loginData.customFields.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Custom Fields
                </span>
                <div className="space-y-2">
                  {loginData.customFields.map((cf, idx) => {
                    const isRevealed = Boolean(revealedCustom[idx])
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 border-b border-border/40 last:border-0"
                      >
                        <div>
                          <span className="text-[11px] text-muted-foreground">
                            {cf.name}
                          </span>
                          <p className="text-sm font-semibold text-foreground">
                            {cf.isHidden && !isRevealed
                              ? "••••••••••••"
                              : cf.value}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {cf.isHidden && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setRevealedCustom((prev) => ({
                                  ...prev,
                                  [idx]: !prev[idx],
                                }))
                              }
                              className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                            >
                              {isRevealed ? (
                                <IconEyeOff className="size-4" />
                              ) : (
                                <IconEye className="size-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              copySensitiveText(cf.value, cf.name)
                            }
                            className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                          >
                            <IconCopy className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* SUBTYPE: NOTE */}
        {/* ======================================================== */}
        {subtype === "note" && noteData && (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Secure Note
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copySensitiveText(noteData.notes, "Note")}
                className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
              >
                <IconCopy className="size-3" />
                <span>Copy</span>
              </Button>
            </div>
            <div className="whitespace-pre-wrap rounded-xl border border-border/50 bg-background/50 p-4 font-mono text-xs leading-relaxed text-foreground">
              {noteData.notes || "(Empty note)"}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBTYPE: CARD */}
        {/* ======================================================== */}
        {subtype === "card" && cardData && (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payment Card
              </span>
              {cardBrand && (
                <Badge variant="outline" className="text-xs font-bold text-primary">
                  {cardBrand}
                </Badge>
              )}
            </div>

            {/* Cardholder */}
            {cardData.cardHolder && (
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <div>
                  <span className="text-[11px] text-muted-foreground">Cardholder Name</span>
                  <p className="text-sm font-semibold uppercase text-foreground">
                    {cardData.cardHolder}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    copySensitiveText(cardData.cardHolder, "Cardholder")
                  }
                  className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            )}

            {/* Card Number */}
            {cardData.cardNumber && (
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <div>
                  <span className="text-[11px] text-muted-foreground">Card Number</span>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {revealCardNumber
                      ? cardData.cardNumber.replace(/(.{4})/g, "$1 ").trim()
                      : `•••• •••• •••• ${cardData.cardNumber.slice(-4)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRevealCardNumber(!revealCardNumber)}
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    {revealCardNumber ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copySensitiveText(cardData.cardNumber, "Card Number")
                    }
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Expiration and CVV */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div>
                <span className="text-[11px] text-muted-foreground">Expires</span>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {cardData.cardExp || "••/••"}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground">Security Code (CVV)</span>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {revealCardCvv ? cardData.cardCvv : "•••"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRevealCardCvv(!revealCardCvv)}
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    {revealCardCvv ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copySensitiveText(cardData.cardCvv, "CVV")}
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Card PIN */}
            {cardData.cardPin && (
              <div className="flex items-center justify-between border-t border-border/40 pt-2">
                <div>
                  <span className="text-[11px] text-muted-foreground">Card PIN</span>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {revealCardPin ? cardData.cardPin : "••••"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRevealCardPin(!revealCardPin)}
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    {revealCardPin ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copySensitiveText(cardData.cardPin!, "PIN")}
                    className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBTYPE: SSH KEY */}
        {/* ======================================================== */}
        {subtype === "ssh" && sshData && (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                SSH Keypair
              </span>
              <Badge variant="outline" className="text-xs">
                {sshData.keyType}
              </Badge>
            </div>

            {/* Fingerprint */}
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-muted-foreground">Fingerprint</span>
                <p className="truncate font-mono text-xs font-semibold text-foreground">
                  {sshData.fingerprint}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  copySensitiveText(sshData.fingerprint, "Fingerprint")
                }
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <IconCopy className="size-4" />
              </Button>
            </div>

            {/* Public Key */}
            <div className="space-y-1.5 py-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Public Key</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copySensitiveText(sshData.publicKey, "Public Key")
                  }
                  className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-3" />
                  <span>Copy</span>
                </Button>
              </div>
              <div className="max-h-24 overflow-y-auto rounded-xl border border-border/40 bg-background/50 p-3 font-mono text-[11px] text-foreground">
                {sshData.publicKey}
              </div>
            </div>

            {/* Private Key */}
            {sshData.privateKey && (
              <div className="space-y-1.5 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Private Key (PEM)</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevealPrivateKey(!revealPrivateKey)}
                      className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    >
                      {revealPrivateKey ? (
                        <>
                          <IconEyeOff className="size-3" /> Hide
                        </>
                      ) : (
                        <>
                          <IconEye className="size-3" /> Reveal
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copySensitiveText(sshData.privateKey, "Private Key")
                      }
                      className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    >
                      <IconCopy className="size-3" />
                      <span>Copy</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleDownloadPrivateKey(sshData.privateKey, item.title)
                      }
                      className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    >
                      <IconDownload className="size-3" />
                      <span>Download</span>
                    </Button>
                  </div>
                </div>
                {revealPrivateKey ? (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-border/40 bg-background/50 p-3 font-mono text-[10px] text-foreground">
                    {sshData.privateKey}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5 font-mono text-xs text-muted-foreground">
                    ••••••••••••••••••••••••••••••••••••••••
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBTYPE: IDENTITY */}
        {/* ======================================================== */}
        {subtype === "identity" && identityData && (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Personal Identity
            </span>

            {identityData.fullName && (
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <div>
                  <span className="text-[11px] text-muted-foreground">Full Name</span>
                  <p className="text-sm font-semibold text-foreground">
                    {identityData.fullName}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    copySensitiveText(identityData.fullName, "Name")
                  }
                  className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            )}

            {identityData.email && (
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <div>
                  <span className="text-[11px] text-muted-foreground">Email</span>
                  <p className="text-sm font-semibold text-foreground">
                    {identityData.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    copySensitiveText(identityData.email, "Email")
                  }
                  className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            )}

            {identityData.phone && (
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <div>
                  <span className="text-[11px] text-muted-foreground">Phone</span>
                  <p className="text-sm font-semibold text-foreground">
                    {identityData.phone}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    copySensitiveText(identityData.phone, "Phone")
                  }
                  className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            )}

            {identityData.address && (
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-[11px] text-muted-foreground">Address</span>
                  <p className="text-sm font-semibold text-foreground">
                    {identityData.address}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    copySensitiveText(identityData.address, "Address")
                  }
                  className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBTYPE: OTHER */}
        {/* ======================================================== */}
        {subtype === "other" && otherData && otherData.customFields && (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Custom Fields
            </span>
            <div className="space-y-2">
              {otherData.customFields.map((cf, idx) => {
                const isRevealed = Boolean(revealedCustom[idx])
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 border-b border-border/40 last:border-0"
                  >
                    <div>
                      <span className="text-[11px] text-muted-foreground">{cf.name}</span>
                      <p className="text-sm font-semibold text-foreground">
                        {cf.isHidden && !isRevealed ? "••••••••••••" : cf.value}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {cf.isHidden && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setRevealedCustom((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                        >
                          {isRevealed ? (
                            <IconEyeOff className="size-4" />
                          ) : (
                            <IconEye className="size-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copySensitiveText(cf.value, cf.name)}
                        className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
                      >
                        <IconCopy className="size-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes (if present for non-note types) */}
        {subtype !== "note" && (item.data as any)?.notes && (
          <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Notes
            </span>
            <div className="whitespace-pre-wrap rounded-xl border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
              {(item.data as any).notes}
            </div>
          </div>
        )}

        {/* Metadata Card */}
        <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Metadata
          </span>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Last Modified</span>
              <span className="font-medium text-foreground">
                {new Date(item.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Created</span>
              <span className="font-medium text-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
