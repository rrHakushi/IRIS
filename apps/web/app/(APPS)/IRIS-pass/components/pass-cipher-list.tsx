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
        if (d.fingerprint && d.fingerprint.toLowerCase().includes(q)) return true
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
    <div className="flex-1 flex flex-col min-w-0 bg-background border-e border-border h-full">
      {/* Search and Action Bar */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="relative flex-1">
          <IconSearch className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="ps-9 rounded-xl border-border bg-card/60 text-sm h-9"
          />
        </div>

        {!isTrashView ? (
          <Button
            onClick={onOpenNewCipher}
            size="sm"
            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors h-9 px-3 shrink-0"
          >
            <IconPlus className="size-4 me-1.5" />
            <span>New Item</span>
          </Button>
        ) : (
          filtered.length > 0 && (
            <Button
              onClick={emptyTrash}
              size="sm"
              variant="destructive"
              className="rounded-xl h-9 px-3 shrink-0"
            >
              <IconTrashX className="size-4 me-1.5" />
              <span>Empty Trash</span>
            </Button>
          )
        )}
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-muted-foreground">
            <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <IconSearch className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No items found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
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
                className={`group flex items-center justify-between p-3.5 cursor-pointer transition-colors ${isSelected
                  ? "bg-primary/10 border-s-2 border-s-primary"
                  : "hover:bg-muted/40"
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Icon */}
                  <CipherIcon item={item} size="md" />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {item.title}
                      </span>
                      {folder && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 rounded-md border-border text-muted-foreground gap-1"
                        >
                          <IconFolder className="size-2.5" />
                          <span className="truncate max-w-[80px]">
                            {folder.name}
                          </span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate block mt-0.5">
                      {subtitle}
                    </span>
                  </div>
                </div>

                {/* Actions & Favorite */}
                <div className="flex items-center gap-1 ps-2">
                  {!isTrashView && (
                    <>
                      {/* Quick copy buttons */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
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
                        className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-amber-500 transition-colors"
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
