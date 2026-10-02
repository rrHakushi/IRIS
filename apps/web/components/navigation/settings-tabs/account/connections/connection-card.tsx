"use client"

import React from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconCheck,
  IconAlertTriangle,
  IconExternalLink,
  IconSettings,
  IconClock,
  IconEye,
  IconEyeOff,
  IconRefresh,
} from "@tabler/icons-react"
import type { ProviderMetadata, UserConnectionItem } from "./types"
import { ProviderIcon } from "./icons"

interface ConnectionCardProps {
  provider: ProviderMetadata
  connection: UserConnectionItem
  onOpenSettings: (
    provider: ProviderMetadata,
    connection: UserConnectionItem
  ) => void
  onRefresh: () => void
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Never"
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffSeconds < 60) return "Just now"
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return "Recently"
  }
}

export function ConnectionCard({
  provider,
  connection,
  onOpenSettings,
}: ConnectionCardProps): React.JSX.Element {
  const isConnected = connection.status === "CONNECTED"
  const isError = connection.status === "ERROR"
  const isExpired = connection.status === "EXPIRED"

  const isPrivate = Boolean(connection.settings?.isPrivate)
  const isLibrarySyncSupported =
    provider.capabilities.supportsLibrarySync ||
    provider.category === "TRACKING" ||
    provider.category === "GAMING"
  const librarySyncEnabled = Boolean(connection.settings?.librarySync ?? true)

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card/70 p-4 shadow-2xs backdrop-blur-xs transition-all duration-200 hover:border-border hover:bg-card hover:shadow-xs">
      <div className="space-y-3.5">
        {/* Header with Official Logo, Title, and Live Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/50 bg-muted/30 p-2 shadow-2xs transition-transform duration-200 group-hover:scale-105">
              <ProviderIcon
                provider={provider.provider}
                iconUrl={provider.iconUrl}
                className="size-6"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-foreground">
                  {provider.name}
                </h4>
                {provider.websiteUrl && (
                  <a
                    href={provider.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                    title="Official website"
                  >
                    <IconExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="text-[10px] font-medium text-muted-foreground capitalize">
                {provider.category.toLowerCase()}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {isConnected ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
            >
              <IconCheck className="size-3" />
              Connected
            </Badge>
          ) : isExpired ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400"
            >
              <IconAlertTriangle className="size-3" />
              Expired
            </Badge>
          ) : isError ? (
            <Badge
              variant="outline"
              className="gap-1 border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
            >
              <IconAlertTriangle className="size-3" />
              Error
            </Badge>
          ) : null}
        </div>

        {/* Connected User Identity Box */}
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-border/40 bg-muted/20 p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {connection.avatarUrl ? (
              <img
                src={connection.avatarUrl}
                alt={connection.displayName || "Avatar"}
                className="size-8 shrink-0 rounded-full border border-border/50 object-cover shadow-2xs"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {(connection.displayName || provider.name)
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold text-foreground">
                {connection.displayName ||
                  connection.externalId ||
                  "Linked User"}
              </span>
              {connection.externalId && connection.displayName && (
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {connection.externalId}
                </span>
              )}
            </div>
          </div>

          {connection.profileUrl && (
            <a
              href={connection.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              title="Open external profile"
            >
              <IconExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {/* Badges Strip (Public/Private & Sync Status) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {isPrivate ? (
            <Badge
              variant="outline"
              className="h-4.5 gap-1 rounded-md border-amber-500/20 bg-amber-500/5 px-1.5 text-[9px] font-medium text-amber-400/90"
            >
              <IconEyeOff className="size-2.5" />
              Private
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-4.5 gap-1 rounded-md border-emerald-500/20 bg-emerald-500/5 px-1.5 text-[9px] font-medium text-emerald-400/90"
            >
              <IconEye className="size-2.5" />
              Public
            </Badge>
          )}

          {isLibrarySyncSupported && (
            <Badge
              variant="outline"
              className={
                librarySyncEnabled
                  ? "h-4.5 gap-1 rounded-md border-primary/20 bg-primary/5 px-1.5 text-[9px] font-medium text-primary/90"
                  : "h-4.5 gap-1 rounded-md border-border/50 bg-muted/20 px-1.5 text-[9px] font-medium text-muted-foreground"
              }
            >
              <IconRefresh className="size-2.5" />
              {librarySyncEnabled ? "Sync On" : "Sync Off"}
            </Badge>
          )}
        </div>
      </div>

      {/* Action Footer: Last Synced Time & Settings Trigger */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <IconClock className="size-3 text-muted-foreground/70" />
          <span className="truncate">
            {formatRelativeTime(connection.lastSyncedAt)}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onPress={() => onOpenSettings(provider, connection)}
          className="h-7.5 gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-2xs"
        >
          <IconSettings className="size-3.5" />
          <span>Settings</span>
        </Button>
      </div>
    </div>
  )
}
