"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconPlus,
  IconPlugConnected,
  IconRefresh,
} from "@tabler/icons-react"
import type { SettingsTabProps } from "../types"
import type { ProviderMetadata, UserConnectionItem } from "./connections/types"
import { ConnectionCard } from "./connections/connection-card"
import { ConnectDialog } from "./connections/connect-dialog"
import { ConnectionSettingsDialog } from "./connections/connection-settings-dialog"
import { AvailableConnectionsDialog } from "./connections/available-connections-dialog"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"

export function ConnectionsSettingsTab({
  onOpenChange,
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderMetadata[]>([])
  const [connections, setConnections] = useState<UserConnectionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal dialog states
  const [availableDialogOpen, setAvailableDialogOpen] = useState(false)
  const [selectedConnectProvider, setSelectedConnectProvider] =
    useState<ProviderMetadata | null>(null)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)

  const [selectedSettingsConnection, setSelectedSettingsConnection] =
    useState<UserConnectionItem | null>(null)
  const [selectedSettingsProvider, setSelectedSettingsProvider] =
    useState<ProviderMetadata | null>(null)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const inFlightRef = useRef(false)

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (inFlightRef.current) return
    inFlightRef.current = true

    if (isManualRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [provRes, connRes] = await Promise.all([
        elysia.connections.providers.get(),
        elysia.connections.get({ fetch: { credentials: "include" } }),
      ])

      if (!provRes.error && provRes.data?.success) {
        setProviders(provRes.data.providers as unknown as ProviderMetadata[])
      }

      if (!connRes.error && connRes.data?.success) {
        setConnections(
          connRes.data.connections as unknown as UserConnectionItem[]
        )
      }
    } catch (err) {
      console.error("Failed to load connections:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    // Process any OAuth callback redirect query params
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const status = urlParams.get("status")
      const provider = urlParams.get("provider")
      const message = urlParams.get("message")

      if (status === "connected" && provider) {
        toast.success(`Successfully connected to ${provider}!`)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )
      } else if (status === "error") {
        toast.error(
          message ? decodeURIComponent(message) : "Failed to link connection"
        )
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )
      }
    }

    fetchData()

    const handleExternalChange = () => {
      fetchData(true)
    }

    window.addEventListener("iris-connections-changed", handleExternalChange)
    return () => {
      window.removeEventListener(
        "iris-connections-changed",
        handleExternalChange
      )
    }
  }, [fetchData])

  // Configure modal footer with active count and Connect button (universal Close button is handled by modal)
  useEffect(() => {
    if (!setFooterContent) return

    setFooterContent(
      <div className="flex w-full items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {connections.length} active connection
          {connections.length === 1 ? "" : "s"}
        </span>

        <Button
          variant="default"
          size="sm"
          onPress={() => setAvailableDialogOpen(true)}
          className="h-8 gap-1.5 rounded-xl px-3.5 text-xs font-semibold shadow-2xs"
        >
          <IconPlus className="size-3.5" />
          <span>Connect</span>
        </Button>
      </div>
    )

    return () => {
      setFooterContent(null)
    }
  }, [connections.length, setFooterContent])

  const handleOpenSettings = (
    provider: ProviderMetadata,
    connection: UserConnectionItem
  ) => {
    setSelectedSettingsProvider(provider)
    setSelectedSettingsConnection(connection)
    setSettingsDialogOpen(true)
  }

  const handleSelectAvailableProvider = (provider: ProviderMetadata) => {
    if (
      provider.capabilities.supportsOAuth &&
      provider.provider !== "RADARR" &&
      provider.provider !== "SONARR" &&
      provider.provider !== "IRIS"
    ) {
      // Start OAuth flow directly
      const returnTo =
        typeof window !== "undefined"
          ? window.location.href
          : "/settings?tab=connections"

      elysia
        .connections({ id: provider.provider.toLowerCase() })
        .auth.get({
          query: { returnTo },
          fetch: { credentials: "include" },
        })
        .then(({ data, error }) => {
          if (error || !data?.url) {
            throw new Error(
              (error as any)?.value?.message ||
                "Failed to initiate authorization"
            )
          }
          window.location.href = data.url
        })
        .catch((err: unknown) => {
          toast.error((err as Error).message || "Authorization failed")
        })
    } else {
      // Manual credential / API key dialog
      setSelectedConnectProvider(provider)
      setConnectDialogOpen(true)
    }
  }

  const connectedProviderKeys = useMemo(
    () => connections.map((c) => c.provider.toUpperCase()),
    [connections]
  )

  const filteredConnections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return connections
    return connections.filter((c) => {
      const matchProvider = c.provider.toLowerCase().includes(q)
      const matchName = c.displayName?.toLowerCase().includes(q) || false
      const matchExtId = c.externalId?.toLowerCase().includes(q) || false
      return matchProvider || matchName || matchExtId
    })
  }, [connections, searchQuery])

  return (
    <div className="w-full flex-1 animate-in space-y-5 pb-6 duration-200 fade-in-50">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Active Connections
          </h3>
          <p className="text-xs text-muted-foreground">
            Third-party platforms and integrations linked to your account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connections.length > 2 && (
            <div className="relative w-full sm:w-48">
              <IconSearch className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-xl pl-8 text-xs"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="icon-sm"
            onPress={() => fetchData(true)}
            isDisabled={isLoading || isRefreshing}
            aria-label="Refresh connections"
            className="size-8 shrink-0 rounded-xl"
          >
            <IconRefresh
              className={`size-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Spinner className="size-7 text-primary" />
          <p className="text-xs text-muted-foreground">
            Loading your active connections...
          </p>
        </div>
      ) : connections.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-xs">
            <IconPlugConnected className="size-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">
              No Connected Services Yet
            </h4>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Link AniList, Steam, Sonarr, or other external platforms to sync
              watchlists, track progress, and showcase badges.
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onPress={() => setAvailableDialogOpen(true)}
            className="mt-2 h-8.5 gap-1.5 rounded-xl px-4 text-xs font-semibold shadow-2xs"
          >
            <IconPlus className="size-3.5" />
            <span>Connect your first service</span>
          </Button>
        </div>
      ) : filteredConnections.length === 0 ? (
        /* Search Empty State */
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
          <p className="text-xs text-muted-foreground">
            No active connections match &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      ) : (
        /* Active Connections 2-Column Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredConnections.map((conn) => {
            const matchedProvider: ProviderMetadata = providers.find(
              (p) => p.provider.toUpperCase() === conn.provider.toUpperCase()
            ) || {
              provider: conn.provider as ProviderMetadata["provider"],
              name: conn.provider,
              description: "",
              category: "TRACKING",
              iconUrl: conn.avatarUrl || "",
              websiteUrl: "",
              capabilities: {
                supportsOAuth: true,
                supportsApiKey: false,
                supportsCredentials: false,
                supportsSearch: false,
                supportsLibrarySync: true,
                supportsScrobble: false,
                supportsGamingLibrary: false,
                authType: "OAUTH2",
                category: "TRACKING",
              },
              isConfigured: true,
            }

            return (
              <ConnectionCard
                key={conn.id}
                provider={matchedProvider}
                connection={conn}
                onOpenSettings={handleOpenSettings}
                onRefresh={() => fetchData(true)}
              />
            )
          })}
        </div>
      )}

      {/* Available Connections Modal Catalog */}
      <AvailableConnectionsDialog
        open={availableDialogOpen}
        onOpenChange={setAvailableDialogOpen}
        providers={providers}
        connectedProviderKeys={connectedProviderKeys}
        onConnectProvider={handleSelectAvailableProvider}
      />

      {/* Manual Credential / API Key Modal */}
      <ConnectDialog
        provider={selectedConnectProvider}
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnected={() => fetchData(true)}
      />

      {/* Connection Settings Modal with Profile Resync Button */}
      <ConnectionSettingsDialog
        connection={selectedSettingsConnection}
        provider={selectedSettingsProvider}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onUpdated={() => fetchData(true)}
        onDisconnected={() => fetchData(true)}
      />
    </div>
  )
}
