"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconRefresh,
  IconLink,
  IconCheck,
  IconDeviceGamepad,
  IconMovie,
  IconServer,
  IconInfoCircle,
} from "@tabler/icons-react"
import type { SettingsTabProps } from "../types"
import type { ProviderMetadata, UserConnectionItem } from "./connections/types"
import { ConnectionCard } from "./connections/connection-card"
import { ConnectDialog } from "./connections/connect-dialog"
import { ConnectionSettingsDialog } from "./connections/connection-settings-dialog"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"

type CategoryFilter = "ALL" | "TRACKING" | "GAMING" | "SERVARR"

export function ConnectionsSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderMetadata[]>([])
  const [connections, setConnections] = useState<UserConnectionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL")

  // Modal dialog states
  const [selectedConnectProvider, setSelectedConnectProvider] =
    useState<ProviderMetadata | null>(null)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)

  const [selectedSettingsConnection, setSelectedSettingsConnection] =
    useState<UserConnectionItem | null>(null)
  const [selectedSettingsProvider, setSelectedSettingsProvider] =
    useState<ProviderMetadata | null>(null)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const inFlightRef = React.useRef(false)

  const fetchData = useCallback(async (manual = false) => {
    if (inFlightRef.current && !manual) return
    inFlightRef.current = true

    if (manual) setIsRefreshing(true)
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
  }, [fetchData])

  const handleOpenConnect = (provider: ProviderMetadata) => {
    setSelectedConnectProvider(provider)
    setConnectDialogOpen(true)
  }

  const handleOpenSettings = (
    provider: ProviderMetadata,
    connection: UserConnectionItem
  ) => {
    setSelectedSettingsProvider(provider)
    setSelectedSettingsConnection(connection)
    setSettingsDialogOpen(true)
  }

  const availableProviders = providers.filter((p) => p.isConfigured)

  const filteredProviders = availableProviders.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      categoryFilter === "ALL" ||
      (categoryFilter === "TRACKING" && p.category === "TRACKING") ||
      (categoryFilter === "GAMING" && p.category === "GAMING") ||
      (categoryFilter === "SERVARR" &&
        (p.category === "SERVARR" ||
          p.category === "MEDIA" ||
          p.category === "MUSIC"))

    return matchesSearch && matchesCategory
  })

  const [refreshCooldown, setRefreshCooldown] = useState(0)

  React.useEffect(() => {
    if (refreshCooldown <= 0) return
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [refreshCooldown])

  const handleManualRefresh = () => {
    if (isRefreshing || isLoading || refreshCooldown > 0) return
    setRefreshCooldown(5)
    fetchData(true)
  }

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      {/* Header section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-foreground">Connections</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading || refreshCooldown > 0}
            className="h-8 gap-1.5 text-xs"
          >
            {isRefreshing ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <IconRefresh className="h-3.5 w-3.5" />
            )}
            {refreshCooldown > 0 ? `Refresh (${refreshCooldown}s)` : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters and search bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant={categoryFilter === "ALL" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("ALL")}
            className="h-8 rounded-lg text-xs"
          >
            All ({availableProviders.length})
          </Button>
          <Button
            variant={categoryFilter === "TRACKING" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("TRACKING")}
            className="h-8 gap-1 rounded-lg text-xs"
          >
            <IconMovie className="h-3.5 w-3.5" />
            Tracking
          </Button>
          <Button
            variant={categoryFilter === "GAMING" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("GAMING")}
            className="h-8 gap-1 rounded-lg text-xs"
          >
            <IconDeviceGamepad className="h-3.5 w-3.5" />
            Gaming
          </Button>
          <Button
            variant={categoryFilter === "SERVARR" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("SERVARR")}
            className="h-8 gap-1 rounded-lg text-xs"
          >
            <IconServer className="h-3.5 w-3.5" />
            Media & Servarr
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Provider Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Spinner className="h-7 w-7 text-primary" />
          <p className="text-xs text-muted-foreground">
            Loading connection providers...
          </p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
          <p className="text-xs text-muted-foreground">
            No connection providers found matching your filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((provider) => {
            const matchingConnection = connections.find(
              (c) =>
                c.provider.toUpperCase() === provider.provider.toUpperCase()
            )

            return (
              <ConnectionCard
                key={provider.provider}
                provider={provider}
                connection={matchingConnection}
                onOpenConnect={handleOpenConnect}
                onOpenSettings={handleOpenSettings}
                onRefresh={() => fetchData(true)}
              />
            )
          })}
        </div>
      )}

      {/* Connect Modal */}
      <ConnectDialog
        provider={selectedConnectProvider}
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnected={() => fetchData(true)}
      />

      {/* Connection Settings Modal */}
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
