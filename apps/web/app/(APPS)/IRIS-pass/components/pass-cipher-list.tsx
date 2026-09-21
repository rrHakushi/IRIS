"use client"

import React from "react"
import { usePass } from "@/context/pass-context"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconSearch,
  IconPlus,
  IconKey,
  IconTerminal2,
  IconStar,
  IconStarFilled,
  IconCopy,
  IconClock,
  IconTrashX,
  IconFolder,
} from "@tabler/icons-react"
import { generateTotpCode } from "@/lib/pass-totp"
import { toast } from "sonner"
import type { DecryptedLoginData, DecryptedSshKeyData } from "@/lib/pass-types"
import { CipherIcon } from "./pass-cipher-icon"

export function PassCipherList({
  onOpenNewCipher,
}: {
  onOpenNewCipher: () => void
}) {
  const {
    ciphers,
    folders,
    selectedCipherId,
    setSelectedCipherId,
    activeFilter,
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    emptyTrash,
  } = usePass()

  const isTrashView = activeFilter === "trash"

  // 1. Filter by category / folder / trash
  let filtered = ciphers.filter((c) => {
    if (isTrashView) {
      return c.deletedAt !== null
    }
    if (c.deletedAt !== null) {
      return false
    }

    if (activeFilter === "favorites") {
      return c.favorite
    }
    if (activeFilter === "logins") {
      return c.type === "LOGIN"
    }
    if (activeFilter === "ssh") {
      return c.type === "SSH_KEY"
    }
    if (activeFilter !== "all") {
      // Must be a folderId
      return c.folderId === activeFilter
    }
    return true
  })

  // 2. Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    filtered = filtered.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true
      if (c.type === "LOGIN") {
        const d = c.data as DecryptedLoginData
        if (d.username && d.username.toLowerCase().includes(q)) return true
        if (d.uris?.some((u) => u.uri.toLowerCase().includes(q))) return true
      } else {
        const d = c.data as DecryptedSshKeyData
        if (d.fingerprint && d.fingerprint.toLowerCase().includes(q))
          return true
      }
      return false
    })
  }

  // Quick copy helpers
  const handleCopy = (e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const handleCopyTotp = (e: React.MouseEvent, secret: string) => {
    e.stopPropagation()
    const code = generateTotpCode(secret)
    navigator.clipboard.writeText(code)
    toast.success("TOTP code copied to clipboard")
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col border-e border-border bg-background">
      {/* Search and Action Bar */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="relative flex-1">
          <IconSearch className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="h-9 rounded-xl border-border bg-card/60 ps-9 text-sm"
          />
        </div>

        {!isTrashView ? (
          <Button
            onClick={onOpenNewCipher}
            size="sm"
            className="h-9 shrink-0 rounded-xl bg-primary px-3 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <IconPlus className="me-1.5 size-4" />
            <span>New Item</span>
          </Button>
        ) : (
          filtered.length > 0 && (
            <Button
              onClick={emptyTrash}
              size="sm"
              variant="destructive"
              className="h-9 shrink-0 rounded-xl px-3"
            >
              <IconTrashX className="me-1.5 size-4" />
              <span>Empty Trash</span>
            </Button>
          )
        )}
      </div>

      {/* List Content */}
      <div className="flex-1 divide-y divide-border/40 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/50">
              <IconSearch className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No items found</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {isTrashView
                ? "Your trash is completely clean."
                : "Create your first credential or change your search filter."}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = selectedCipherId === item.id
            const folder = folders.find((f) => f.id === item.folderId)

            let subtitle = ""
            let hasPassword = false
            let hasTotp = false
            let totpSecret = ""
            let passwordStr = ""
            let usernameStr = ""

            if (item.type === "LOGIN") {
              const d = item.data as DecryptedLoginData
              subtitle = d.username || "No username"
              usernameStr = d.username || ""
              passwordStr = d.password || ""
              hasPassword = Boolean(d.password)
              hasTotp = Boolean(d.totpSecret)
              totpSecret = d.totpSecret || ""
            } else {
              const d = item.data as DecryptedSshKeyData
              subtitle = `${d.keyType} • ${d.fingerprint || "SSH Key"}`
            }

            return (
              <div
                key={item.id}
                onClick={() => setSelectedCipherId(item.id)}
                className={`group flex cursor-pointer items-center justify-between p-3.5 transition-colors ${
                  isSelected
                    ? "border-s-2 border-s-primary bg-primary/10"
                    : "hover:bg-muted/40"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {/* Icon */}
                  <CipherIcon item={item} size="md" />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      {folder && (
                        <Badge
                          variant="outline"
                          className="h-4 gap-1 rounded-md border-border px-1.5 py-0 text-[10px] text-muted-foreground"
                        >
                          <IconFolder className="size-2.5" />
                          <span className="max-w-[80px] truncate">
                            {folder.name}
                          </span>
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
                        {item.type === "LOGIN" && (
                          <>
                            {usernameStr && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) =>
                                  handleCopy(e, usernameStr, "Username")
                                }
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
                                onClick={(e) =>
                                  handleCopy(e, passwordStr, "Password")
                                }
                                aria-label="Copy Password"
                                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                              >
                                <IconKey className="size-3.5" />
                              </Button>
                            )}
                            {hasTotp && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleCopyTotp(e, totpSecret)}
                                aria-label="Copy TOTP Code"
                                className="size-7 rounded-lg text-[#d800a6] hover:text-[#b8008e]"
                              >
                                <IconClock className="size-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Favorite Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(item.id)
                        }}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-amber-500"
                      >
                        {item.favorite ? (
                          <IconStarFilled className="size-4 text-amber-500" />
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
