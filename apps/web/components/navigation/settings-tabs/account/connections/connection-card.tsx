"use client"

import React, { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconCheck,
  IconAlertTriangle,
  IconExternalLink,
  IconSettings,
  IconRefresh,
  IconPlus,
} from "@tabler/icons-react"
import type { ProviderMetadata, UserConnectionItem } from "./types"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"

interface ConnectionCardProps {
  provider: ProviderMetadata
  connection?: UserConnectionItem
  onOpenConnect: (provider: ProviderMetadata) => void
  onOpenSettings: (
    provider: ProviderMetadata,
    connection: UserConnectionItem
  ) => void
  onRefresh: () => void
}

export function ConnectionCard({
  provider,
  connection,
  onOpenConnect,
  onOpenSettings,
  onRefresh,
}: ConnectionCardProps): React.JSX.Element {
  const [isTesting, setIsTesting] = useState(false)
  const [testCooldown, setTestCooldown] = useState(0)
  const isConnected = connection && connection.status === "CONNECTED"
  const isError = connection && connection.status === "ERROR"
  const isExpired = connection && connection.status === "EXPIRED"

  React.useEffect(() => {
    if (testCooldown <= 0) return
    const timer = setInterval(() => {
      setTestCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [testCooldown])

  const handleOAuthConnect = async () => {
    try {
      const returnTo =
        typeof window !== "undefined"
          ? window.location.href
          : "/settings?tab=connections"

      const { data, error } = await elysia
        .connections({ id: provider.provider.toLowerCase() })
        .auth.get({
          query: { returnTo },
          fetch: { credentials: "include" },
        })

      if (error || !data?.url) {
        throw new Error(
          (error as any)?.value?.message || "Failed to initiate authorization"
        )
      }

      window.location.href = data.url
    } catch (err: unknown) {
      toast.error((err as Error).message || "Authorization failed")
    }
  }

  const handleConnectClick = () => {
    if (
      provider.capabilities.supportsOAuth &&
      provider.provider !== "RADARR" &&
      provider.provider !== "SONARR"
    ) {
      handleOAuthConnect()
    } else {
      onOpenConnect(provider)
    }
  }

  const handleTestHealth = async () => {
    if (!connection || isTesting || testCooldown > 0) return
    setIsTesting(true)
    try {
      const { data, error } = await elysia
        .connections({ id: connection.id })
        .test.post(undefined, {
          fetch: { credentials: "include" },
        })

      if (error || data?.status === "ERROR") {
        throw new Error(
          (error as any)?.value?.message ||
            (data as any)?.message ||
            "Connection health test failed"
        )
      }
      toast.success(`${provider.name} is active and healthy!`)
      setTestCooldown(10)
      onRefresh()
    } catch (err: unknown) {
      toast.error((err as Error).message || "Connection test failed")
      setTestCooldown(5)
      onRefresh()
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-md">
      <div>
        {/* Header with Official Logo and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-muted/40 p-2 transition-transform duration-200 group-hover:scale-105">
              <img
                src={provider.iconUrl}
                alt={provider.name}
                className="h-6 w-6 object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-semibold text-foreground">
                  {provider.name}
                </h4>
                <a
                  href={provider.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                  <IconExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                {provider.category}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {isConnected ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-500"
            >
              <IconCheck className="h-3 w-3" />
              Connected
            </Badge>
          ) : isExpired ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500"
            >
              <IconAlertTriangle className="h-3 w-3" />
              Expired
            </Badge>
          ) : isError ? (
            <Badge
              variant="outline"
              className="gap-1 border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"
            >
              <IconAlertTriangle className="h-3 w-3" />
              Error
            </Badge>
          ) : null}
        </div>

        {/* Description / Connected User details */}
        <div className="mt-3.5 space-y-2">
          {isConnected && connection ? (
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 p-2.5 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                {connection.avatarUrl ? (
                  <img
                    src={connection.avatarUrl}
                    alt={connection.displayName || "Avatar"}
                    className="h-6 w-6 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {(connection.displayName || provider.name)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <span className="truncate text-xs font-medium text-foreground">
                  {connection.displayName ||
                    connection.externalId ||
                    "Linked User"}
                </span>
              </div>
              <span className="shrink-0 pl-2 text-[10px] text-muted-foreground">
                {connection.createdAt
                  ? `Added ${new Date(connection.createdAt).toLocaleDateString()}`
                  : connection.lastSyncedAt
                    ? `Added ${new Date(connection.lastSyncedAt).toLocaleDateString()}`
                    : "Connected"}
              </span>
            </div>
          ) : (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {provider.description}
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
        {isConnected && connection ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestHealth}
              disabled={isTesting || testCooldown > 0}
              className="h-8 gap-1.5 text-xs"
            >
              {isTesting ? (
                <Spinner className="h-3 w-3" />
              ) : (
                <IconRefresh className="h-3.5 w-3.5" />
              )}
              {testCooldown > 0 ? `Test (${testCooldown}s)` : "Test"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenSettings(provider, connection)}
              className="h-8 gap-1.5 text-xs"
            >
              <IconSettings className="h-3.5 w-3.5" />
              Settings
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConnectClick}
            className="h-8 w-full gap-1.5 text-xs"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Connect
          </Button>
        )}
      </div>
    </div>
  )
}
