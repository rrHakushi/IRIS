"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconSearch,
  IconRefresh,
  IconLink,
  IconCheck,
  IconDeviceGamepad,
  IconMovie,
  IconServer,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { SettingsTabProps } from "../types";
import type { ProviderMetadata, UserConnectionItem } from "./connections/types";
import { ConnectionCard } from "./connections/connection-card";
import { ConnectDialog } from "./connections/connect-dialog";
import { ConnectionSettingsDialog } from "./connections/connection-settings-dialog";
import { toast } from "sonner";

type CategoryFilter = "ALL" | "TRACKING" | "GAMING" | "SERVARR";

export function ConnectionsSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderMetadata[]>([]);
  const [connections, setConnections] = useState<UserConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");

  // Modal dialog states
  const [selectedConnectProvider, setSelectedConnectProvider] = useState<ProviderMetadata | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const [selectedSettingsConnection, setSelectedSettingsConnection] = useState<UserConnectionItem | null>(null);
  const [selectedSettingsProvider, setSelectedSettingsProvider] = useState<ProviderMetadata | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const inFlightRef = React.useRef(false);

  const fetchData = useCallback(async (manual = false) => {
    if (inFlightRef.current && !manual) return;
    inFlightRef.current = true;

    if (manual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [provRes, connRes] = await Promise.all([
        fetch(`${apiUrl}/connections/providers`),
        fetch(`${apiUrl}/connections`, { credentials: "include" }),
      ]);

      if (provRes.ok) {
        const provData = await provRes.json();
        if (provData.success) {
          setProviders(provData.providers);
        }
      }

      if (connRes.ok) {
        const connData = await connRes.json();
        if (connData.success) {
          setConnections(connData.connections);
        }
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      inFlightRef.current = false;
    }
  }, [apiUrl]);

  useEffect(() => {
    // Process any OAuth callback redirect query params
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get("status");
      const provider = urlParams.get("provider");
      const message = urlParams.get("message");

      if (status === "connected" && provider) {
        toast.success(`Successfully connected to ${provider}!`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (status === "error") {
        toast.error(message ? decodeURIComponent(message) : "Failed to link connection");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    fetchData();
  }, [fetchData]);

  const handleOpenConnect = (provider: ProviderMetadata) => {
    setSelectedConnectProvider(provider);
    setConnectDialogOpen(true);
  };

  const handleOpenSettings = (provider: ProviderMetadata, connection: UserConnectionItem) => {
    setSelectedSettingsProvider(provider);
    setSelectedSettingsConnection(connection);
    setSettingsDialogOpen(true);
  };

  const availableProviders = providers.filter((p) => p.isConfigured);

  const filteredProviders = availableProviders.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "ALL" ||
      (categoryFilter === "TRACKING" && p.category === "TRACKING") ||
      (categoryFilter === "GAMING" && p.category === "GAMING") ||
      (categoryFilter === "SERVARR" && (p.category === "SERVARR" || p.category === "MEDIA" || p.category === "MUSIC"));

    return matchesSearch && matchesCategory;
  });

  const [refreshCooldown, setRefreshCooldown] = useState(0);

  React.useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

  const handleManualRefresh = () => {
    if (isRefreshing || isLoading || refreshCooldown > 0) return;
    setRefreshCooldown(5);
    fetchData(true);
  };

  return (
    <div className="flex-1 w-full space-y-6 pb-6 animate-in fade-in-50 duration-200">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Connections</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading || refreshCooldown > 0}
            className="h-8 text-xs gap-1.5"
          >
            {isRefreshing ? <Spinner className="w-3.5 h-3.5" /> : <IconRefresh className="w-3.5 h-3.5" />}
            {refreshCooldown > 0 ? `Refresh (${refreshCooldown}s)` : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters and search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant={categoryFilter === "ALL" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("ALL")}
            className="h-8 text-xs rounded-lg"
          >
            All ({availableProviders.length})
          </Button>
          <Button
            variant={categoryFilter === "TRACKING" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("TRACKING")}
            className="h-8 text-xs rounded-lg gap-1"
          >
            <IconMovie className="w-3.5 h-3.5" />
            Tracking
          </Button>
          <Button
            variant={categoryFilter === "GAMING" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("GAMING")}
            className="h-8 text-xs rounded-lg gap-1"
          >
            <IconDeviceGamepad className="w-3.5 h-3.5" />
            Gaming
          </Button>
          <Button
            variant={categoryFilter === "SERVARR" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCategoryFilter("SERVARR")}
            className="h-8 text-xs rounded-lg gap-1"
          >
            <IconServer className="w-3.5 h-3.5" />
            Media & Servarr
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>

      {/* Provider Cards Grid */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-7 h-7 text-primary" />
          <p className="text-xs text-muted-foreground">Loading connection providers...</p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="py-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <p className="text-xs text-muted-foreground">No connection providers found matching your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => {
            const matchingConnection = connections.find(
              (c) => c.provider.toUpperCase() === provider.provider.toUpperCase()
            );

            return (
              <ConnectionCard
                key={provider.provider}
                provider={provider}
                connection={matchingConnection}
                onOpenConnect={handleOpenConnect}
                onOpenSettings={handleOpenSettings}
                onRefresh={() => fetchData(true)}
              />
            );
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
  );
}
