"use client"

import React, { useState } from "react"
import { usePass } from "@/context/pass-context"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconSearch,
  IconKey,
  IconTerminal2,
  IconCreditCard,
  IconNote,
  IconId,
  IconStar,
  IconStarFilled,
  IconCopy,
  IconClock,
  IconArrowsSort,
  IconFingerprint,
  IconCheck,
} from "@tabler/icons-react"
import { generateTotpCode } from "@/lib/pass-totp"
import type {
  AkaromiSubtype,
  DecryptedCipher,
  DecryptedLoginData,
  DecryptedNoteData,
  DecryptedCardData,
  DecryptedSshKeyData,
  DecryptedIdentityData,
  PassSortOption,
} from "@/lib/pass-types"
import { CipherIcon } from "./pass-cipher-icon"

export function PassCipherList({
  onOpenNewCipher,
}: {
  onOpenNewCipher: (initialSubtype?: AkaromiSubtype) => void
}) {
  const {
    ciphers,
    selectedCipherId,
    setSelectedCipherId,
    activeFilter,
    searchQuery,
    sortOption,
    setSortOption,
    toggleFavorite,
    copySensitiveText,
  } = usePass()

  const [showSortMenu, setShowSortMenu] = useState(false)

  const isTrashView = activeFilter === "trash"

  // 1. Filter by category / trash
  let filtered = ciphers.filter((c) => {
    if (isTrashView) {
      return c.deletedAt !== null
    }
    if (c.deletedAt !== null) {
      return false
    }

    const subtype = c.data?.itemType || (c.type === "SSH_KEY" ? "ssh" : "login")

    if (activeFilter === "favorites") {
      return c.favorite
    }
    if (activeFilter === "logins") {
      return subtype === "login"
    }
    if (activeFilter === "notes") {
      return subtype === "note"
    }
    if (activeFilter === "cards") {
      return subtype === "card"
    }
    if (activeFilter === "ssh") {
      return subtype === "ssh"
    }
    if (activeFilter === "identities") {
      return subtype === "identity"
    }
    return true
  })

  // 2. Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    filtered = filtered.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true
      const subtype = c.data?.itemType || (c.type === "SSH_KEY" ? "ssh" : "login")

      if (subtype === "login") {
        const d = c.data as DecryptedLoginData
        if (d.username && d.username.toLowerCase().includes(q)) return true
        if (d.email && d.email.toLowerCase().includes(q)) return true
        if (d.uris?.some((u) => u.uri.toLowerCase().includes(q))) return true
      } else if (subtype === "card") {
        const d = c.data as DecryptedCardData
        if (d.cardHolder && d.cardHolder.toLowerCase().includes(q)) return true
        if (d.cardNumber && d.cardNumber.includes(q)) return true
      } else if (subtype === "ssh") {
        const d = c.data as DecryptedSshKeyData
        if (d.fingerprint && d.fingerprint.toLowerCase().includes(q)) return true
      } else if (subtype === "identity") {
        const d = c.data as DecryptedIdentityData
        if (d.fullName && d.fullName.toLowerCase().includes(q)) return true
        if (d.email && d.email.toLowerCase().includes(q)) return true
      }
      return false
    })
  }

  // 3. Sort ciphers
  const sorted = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case "title_asc":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      case "title_desc":
        return b.title.localeCompare(a.title, undefined, { sensitivity: "base" })
      case "updated":
      case "recent_used":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case "created_desc":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "created_asc":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      default:
        return 0
    }
  })

  // Quick TOTP Copy
  const handleCopyTotp = (e: React.MouseEvent, secret: string) => {
    e.stopPropagation()
    const code = generateTotpCode(secret)
    copySensitiveText(code, "TOTP Code")
  }

  const SORT_OPTIONS: { id: PassSortOption; label: string }[] = [
    { id: "title_asc", label: "Title (A \u2192 Z)" },
    { id: "title_desc", label: "Title (Z \u2192 A)" },
    { id: "updated", label: "Recently updated" },
    { id: "created_desc", label: "Created (Newest first)" },
    { id: "created_asc", label: "Created (Oldest first)" },
    { id: "recent_used", label: "Recently used" },
  ]

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col border-e border-border/80 bg-background">
      {/* List Sub-bar: Section Name, Count & Sort */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/80 px-4 bg-card/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">
            {activeFilter === "favorites"
              ? "Favorites"
              : activeFilter === "logins"
                ? "Logins"
                : activeFilter === "notes"
                  ? "Secure Notes"
                  : activeFilter === "cards"
                    ? "Credit Cards"
                    : activeFilter === "ssh"
                      ? "SSH Keys"
                      : activeFilter === "identities"
                        ? "Identities"
                        : activeFilter === "trash"
                          ? "Trash"
                          : "All Items"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({sorted.length})
          </span>
        </div>

        {/* Sort Popover Button */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Sort items"
          >
            <IconArrowsSort className="size-3.5" />
            <span className="text-[11px]">Sort</span>
          </Button>

          {showSortMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSortMenu(false)}
              />
              <div className="absolute end-0 top-8 z-50 w-52 rounded-2xl border border-border bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95">
                <span className="block px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  SORT BY
                </span>
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortOption === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortOption(opt.id)
                        setShowSortMenu(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-muted/80 font-semibold text-foreground"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && (
                        <IconCheck className="size-3.5 text-foreground shrink-0 ms-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 divide-y divide-border/40 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/50">
              <IconSearch className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">No items found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isTrashView
                ? "Your trash is completely clean."
                : "Create your first item or adjust your search filter."}
            </p>
          </div>
        ) : (
          sorted.map((item) => {
            const isSelected = selectedCipherId === item.id
            const subtype =
              item.data?.itemType || (item.type === "SSH_KEY" ? "ssh" : "login")

            let subtitle = ""
            let hasPassword = false
            let hasTotp = false
            let totpSecret = ""
            let hasPasskey = false
            let passwordStr = ""
            let usernameStr = ""
            let cardNumberStr = ""

            if (subtype === "login") {
              const d = item.data as DecryptedLoginData
              subtitle = d.username || d.email || "No username"
              usernameStr = d.username || d.email || ""
              passwordStr = d.password || ""
              hasPassword = Boolean(d.password)
              hasTotp = Boolean(d.totpSecret)
              totpSecret = d.totpSecret || ""
              hasPasskey = Boolean(d.passkey)
            } else if (subtype === "note") {
              const d = item.data as DecryptedNoteData
              subtitle = d.notes ? d.notes.slice(0, 32) : "Secure Note"
            } else if (subtype === "card") {
              const d = item.data as DecryptedCardData
              subtitle = d.cardNumber
                ? `•••• ${d.cardNumber.slice(-4)}`
                : d.cardHolder || "Payment Card"
              cardNumberStr = d.cardNumber || ""
            } else if (subtype === "ssh") {
              const d = item.data as DecryptedSshKeyData
              subtitle = `${d.keyType} • ${d.fingerprint || "SSH Key"}`
            } else if (subtype === "identity") {
              const d = item.data as DecryptedIdentityData
              subtitle = d.fullName || d.email || "Personal Identity"
            } else {
              subtitle = "Custom Fields"
            }

            return (
              <div
                key={item.id}
                onClick={() => setSelectedCipherId(item.id)}
                className={`group flex cursor-pointer items-center justify-between p-3.5 transition-colors ${
                  isSelected
                    ? "border-s-2 border-s-primary bg-muted/70 text-foreground"
                    : "hover:bg-muted/40"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CipherIcon item={item} size="md" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {item.title}
                      </span>

                      {/* TOTP Badge */}
                      {hasTotp && (
                        <Badge
                          variant="secondary"
                          className="h-4 rounded-md px-1.5 py-0 text-[9px] font-semibold"
                        >
                          2FA
                        </Badge>
                      )}

                      {/* Passkey Badge */}
                      {hasPasskey && (
                        <Badge
                          variant="outline"
                          className="h-4 gap-0.5 rounded-md px-1.5 py-0 text-[9px] font-semibold"
                        >
                          <IconFingerprint className="size-2.5" />
                          <span>Passkey</span>
                        </Badge>
                      )}
                    </div>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                  </div>
                </div>

                {/* Actions & Favorite */}
                <div className="flex items-center gap-1 ps-2">
                  {!isTrashView && (
                    <>
                      {/* Quick copy buttons */}
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {usernameStr && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              copySensitiveText(usernameStr, "Username")
                            }}
                            aria-label="Copy Username"
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <IconCopy className="size-3.5" />
                          </Button>
                        )}
                        {hasPassword && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              copySensitiveText(passwordStr, "Password")
                            }}
                            aria-label="Copy Password"
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <IconKey className="size-3.5" />
                          </Button>
                        )}
                        {cardNumberStr && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              copySensitiveText(cardNumberStr, "Card Number")
                            }}
                            aria-label="Copy Card Number"
                            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <IconCreditCard className="size-3.5" />
                          </Button>
                        )}
                        {hasTotp && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleCopyTotp(e, totpSecret)}
                            aria-label="Copy TOTP Code"
                            className="size-7 rounded-lg text-foreground hover:text-foreground"
                          >
                            <IconClock className="size-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Favorite Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(item.id)
                        }}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {item.favorite ? (
                          <IconStarFilled className="size-4 text-foreground" />
                        ) : (
                          <IconStar className="size-4 opacity-40 group-hover:opacity-100" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
