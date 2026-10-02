"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconTrash,
  IconCheck,
  IconRefresh,
  IconAlertTriangle,
  IconClock,
  IconExternalLink,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import type { ProviderMetadata, UserConnectionItem } from "./types"
import { ProviderIcon } from "./icons"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"

interface ConnectionSettingsDialogProps {
  connection: UserConnectionItem | null
  provider: ProviderMetadata | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  onDisconnected: () => void
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

export function ConnectionSettingsDialog({
  connection,
  provider,
  open,
  onOpenChange,
  onUpdated,
  onDisconnected,
}: ConnectionSettingsDialogProps): React.JSX.Element | null {
  const [librarySync, setLibrarySync] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResyncing, setIsResyncing] = useState(false)
  const [resyncCooldown, setResyncCooldown] = useState(0)

  // Sync state when connection changes
  useEffect(() => {
    if (connection) {
      setLibrarySync(Boolean(connection.settings?.librarySync ?? true))
      setIsPrivate(Boolean(connection.settings?.isPrivate ?? false))
    }
  }, [connection])

  // Cooldown timer
  useEffect(() => {
    if (resyncCooldown <= 0) return
    const timer = setInterval(() => {
      setResyncCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resyncCooldown])

  if (!connection || !provider) return null

  const isRadarrOrSonarr =
    provider.provider === "RADARR" ||
    provider.provider === "SONARR" ||
    provider.category === "SERVARR"

  const handleResyncProfile = async () => {
    if (isResyncing || resyncCooldown > 0) return
    setIsResyncing(true)

    try {
      const { data, error } = await elysia
        .connections({ id: connection.id })
        .sync.post(undefined, {
          fetch: { credentials: "include" },
        })

      if (error || !data?.success) {
        throw new Error(
          (error as any)?.value?.message ||
            (data as any)?.message ||
            "Failed to resync profile data"
        )
      }

      toast.success(
        data.message || `Profile data refreshed from ${provider.name}!`
      )
      setResyncCooldown(8)
      onUpdated()

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("iris-connections-changed"))
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Resync failed")
      setResyncCooldown(4)
    } finally {
      setIsResyncing(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const { error } = await elysia.connections({ id: connection.id }).patch(
        {
          settings: {
            ...(connection.settings?.hostUrl
              ? { hostUrl: connection.settings.hostUrl }
              : {}),
            ...(isRadarrOrSonarr ? {} : { librarySync }),
            isPrivate,
          },
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (error) {
        throw new Error(
          (error as any)?.value?.message || "Failed to save settings"
        )
      }

      toast.success("Connection settings updated!")
      onOpenChange(false)
      onUpdated()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("iris-connections-changed"))
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}?`))
      return

    setIsDeleting(true)
    try {
      const { error } = await elysia
        .connections({ id: connection.id })
        .delete(undefined, {
          fetch: { credentials: "include" },
        })

      if (error) {
        throw new Error(
          (error as any)?.value?.message || "Failed to disconnect"
        )
      }

      toast.success(`Disconnected ${provider.name}`)
      onOpenChange(false)
      onDisconnected()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("iris-connections-changed"))
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to disconnect")
    } finally {
      setIsDeleting(false)
    }
  }

  const isConnected = connection.status === "CONNECTED"
  const isExpired = connection.status === "EXPIRED"
  const isError = connection.status === "ERROR"

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <div className="w-full">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/40 bg-muted/40 p-2 shadow-2xs">
              <ProviderIcon
                provider={provider.provider}
                iconUrl={provider.iconUrl}
                className="size-6"
              />
            </div>
            <div>
              <DialogTitle>{provider.name} Settings</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Manage credentials, sync preferences, and profile visibility.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Dedicated Profile & Sync Section */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                {connection.avatarUrl ? (
                  <img
                    src={connection.avatarUrl}
                    alt={connection.displayName || "Avatar"}
                    className="size-10 shrink-0 rounded-full border border-border/60 object-cover shadow-2xs"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {(connection.displayName || provider.name)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-xs font-bold text-foreground">
                      {connection.displayName || "Linked User"}
                    </h4>
                    {isConnected && (
                      <Badge className="h-4 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[9px] font-semibold text-emerald-400">
                        <IconCheck className="me-0.5 size-2.5" />
                        Connected
                      </Badge>
                    )}
                    {isExpired && (
                      <Badge className="h-4 border-amber-500/20 bg-amber-500/10 px-1.5 text-[9px] font-semibold text-amber-400">
                        <IconAlertTriangle className="me-0.5 size-2.5" />
                        Expired
                      </Badge>
                    )}
                    {isError && (
                      <Badge className="h-4 border-destructive/20 bg-destructive/10 px-1.5 text-[9px] font-semibold text-destructive">
                        <IconAlertTriangle className="me-0.5 size-2.5" />
                        Error
                      </Badge>
                    )}
                  </div>
                  {connection.externalId && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      ID: {connection.externalId}
                    </p>
                  )}
                </div>
              </div>

              {connection.profileUrl && (
                <a
                  href={connection.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/50 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  title="View external profile"
                >
                  <IconExternalLink className="size-3.5" />
                </a>
              )}
            </div>

            {/* Profile Resync Action Row */}
            <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <IconClock className="size-3.5 text-muted-foreground/80" />
                <span>
                  Last synced:{" "}
                  <strong className="font-medium text-foreground">
                    {formatRelativeTime(connection.lastSyncedAt)}
                  </strong>
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onPress={handleResyncProfile}
                isDisabled={isResyncing || resyncCooldown > 0}
                className="h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-2xs"
              >
                {isResyncing ? (
                  <Spinner className="size-3.5 text-primary" />
                ) : (
                  <IconRefresh className="size-3.5" />
                )}
                <span>
                  {resyncCooldown > 0
                    ? `Resync (${resyncCooldown}s)`
                    : "Resync Profile"}
                </span>
              </Button>
            </div>
          </div>

          {/* Settings toggles */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
            {!isRadarrOrSonarr && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pe-4">
                  <Label className="text-xs font-semibold">Library Sync</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Synchronize watchlists, ratings, and media status
                    automatically.
                  </p>
                </div>
                <Switch isSelected={librarySync} onChange={setLibrarySync} />
              </div>
            )}

            <div
              className={cn(
                "flex items-center justify-between",
                !isRadarrOrSonarr && "border-t border-border/40 pt-3"
              )}
            >
              <div className="space-y-0.5 pe-4">
                <Label className="text-xs font-semibold">
                  Private Connection
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Hide this linked account badge from your public profile.
                </p>
              </div>
              <Switch isSelected={isPrivate} onChange={setIsPrivate} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex w-full flex-row items-center justify-between sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onPress={handleDisconnect}
            isDisabled={isDeleting}
            className="h-8 gap-1.5 rounded-xl text-xs"
          >
            {isDeleting ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconTrash className="size-3.5" />
            )}
            Disconnect
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => onOpenChange(false)}
              className="h-8 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onPress={handleSaveSettings}
              isDisabled={isSaving}
              className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
            >
              {isSaving ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconCheck className="size-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
