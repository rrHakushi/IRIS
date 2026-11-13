"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconSearch,
  IconPlus,
  IconCheck,
  IconExternalLink,
  IconSparkles,
} from "@tabler/icons-react"
import type { ProviderMetadata } from "./types"
import { ProviderIcon } from "./icons"

interface AvailableConnectionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: ProviderMetadata[]
  connectedProviderKeys: string[]
  onConnectProvider: (provider: ProviderMetadata) => void
}

export function AvailableConnectionsDialog({
  open,
  onOpenChange,
  providers,
  connectedProviderKeys,
  onConnectProvider,
}: AvailableConnectionsDialogProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState("")

  const normalizedConnected = useMemo(
    () => new Set(connectedProviderKeys.map((k) => k.toUpperCase())),
    [connectedProviderKeys]
  )

  const availableProviders = useMemo(() => {
    return providers.filter(
      (p) =>
        p.isConfigured && !normalizedConnected.has(p.provider.toUpperCase())
    )
  }, [providers, normalizedConnected])

  const filteredProviders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return availableProviders
    return availableProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    )
  }, [availableProviders, searchQuery])

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <div className="flex max-h-[85vh] w-full flex-col">
        <DialogHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <IconSparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Connect a Service
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Link external tracking, gaming, or media platforms to your
                account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative mb-3">
          <IconSearch className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search available integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 rounded-xl pl-9 text-xs"
          />
        </div>

        {/* Minimal Catalog Single-Column List */}
        <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto pr-0.5">
          {availableProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border/70 bg-muted/15 p-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <IconCheck className="size-5" />
              </div>
              <h4 className="text-xs font-semibold text-foreground">
                All Available Services Connected
              </h4>
              <p className="max-w-xs text-[11px] text-muted-foreground">
                You have connected all configured third-party services. Check
                your active list to manage them.
              </p>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
              <p className="text-xs text-muted-foreground">
                No services found matching &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            filteredProviders.map((provider) => (
              <div
                key={provider.provider}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-3 shadow-2xs transition-all duration-200 hover:border-border hover:bg-card hover:shadow-xs"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30 p-2 shadow-2xs transition-transform duration-200 group-hover:scale-105">
                    <ProviderIcon
                      provider={provider.provider}
                      iconUrl={provider.iconUrl}
                      className="size-6"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate text-xs font-bold text-foreground">
                        {provider.name}
                      </h4>
                      <Badge
                        variant="secondary"
                        className="h-4 rounded-md px-1.5 text-[9px] font-semibold text-muted-foreground capitalize"
                      >
                        {provider.category.toLowerCase()}
                      </Badge>
                      {provider.websiteUrl && (
                        <a
                          href={provider.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                          title="Visit website"
                        >
                          <IconExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {provider.description}
                    </p>
                  </div>
                </div>

                <Button
                  variant="default"
                  size="sm"
                  onPress={() => {
                    onOpenChange(false)
                    onConnectProvider(provider)
                  }}
                  className="h-8 shrink-0 gap-1 rounded-xl px-3 text-xs font-semibold shadow-2xs"
                >
                  <IconPlus className="size-3.5" />
                  <span>Connect</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  )
}
