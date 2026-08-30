"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconCheck,
  IconAlertTriangle,
  IconExternalLink,
  IconSettings,
  IconRefresh,
  IconPlus,
} from "@tabler/icons-react";
import type { ProviderMetadata, UserConnectionItem } from "./types";
import { toast } from "sonner";

interface ConnectionCardProps {
  provider: ProviderMetadata;
  connection?: UserConnectionItem;
  onOpenConnect: (provider: ProviderMetadata) => void;
  onOpenSettings: (provider: ProviderMetadata, connection: UserConnectionItem) => void;
  onRefresh: () => void;
}

export function ConnectionCard({
  provider,
  connection,
  onOpenConnect,
  onOpenSettings,
  onRefresh,
}: ConnectionCardProps): React.JSX.Element {
  const [isTesting, setIsTesting] = useState(false);
  const [testCooldown, setTestCooldown] = useState(0);
  const isConnected = connection && connection.status === "CONNECTED";
  const isError = connection && connection.status === "ERROR";
  const isExpired = connection && connection.status === "EXPIRED";

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  React.useEffect(() => {
    if (testCooldown <= 0) return;
    const timer = setInterval(() => {
      setTestCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [testCooldown]);

  const handleOAuthConnect = async () => {
    try {
      const returnTo = typeof window !== "undefined" ? window.location.href : "/settings?tab=connections";
      const authEndpoint = new URL(`${apiUrl}/connections/${provider.provider.toLowerCase()}/auth`);
      authEndpoint.searchParams.set("returnTo", returnTo);

      const res = await fetch(authEndpoint.toString(), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to initiate authorization");
      }

      if (data.url) {
        // Redirect in the same window
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Authorization failed");
    }
  };

  const handleConnectClick = () => {
    if (
      provider.capabilities.supportsOAuth &&
      provider.provider !== "RADARR" &&
      provider.provider !== "SONARR"
    ) {
      handleOAuthConnect();
    } else {
      onOpenConnect(provider);
    }
  };

  const handleTestHealth = async () => {
    if (!connection || isTesting || testCooldown > 0) return;
    setIsTesting(true);
    try {
      const res = await fetch(`${apiUrl}/connections/${connection.id}/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data.status === "ERROR") {
        throw new Error(data.message || "Connection health test failed");
      }
      toast.success(`${provider.name} is active and healthy!`);
      setTestCooldown(10);
      onRefresh();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Connection test failed");
      setTestCooldown(5);
      onRefresh();
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-md">
      <div>
        {/* Header with Official Logo and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center p-2 border border-border/40 transition-transform duration-200 group-hover:scale-105">
              <img
                src={provider.iconUrl}
                alt={provider.name}
                className="w-6 h-6 object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-semibold text-foreground">{provider.name}</h4>
                <a
                  href={provider.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <IconExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {provider.category}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {isConnected ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] gap-1 px-2 py-0.5">
              <IconCheck className="w-3 h-3" />
              Connected
            </Badge>
          ) : isExpired ? (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[11px] gap-1 px-2 py-0.5">
              <IconAlertTriangle className="w-3 h-3" />
              Expired
            </Badge>
          ) : isError ? (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[11px] gap-1 px-2 py-0.5">
              <IconAlertTriangle className="w-3 h-3" />
              Error
            </Badge>
          ) : null}
        </div>

        {/* Description / Connected User details */}
        <div className="mt-3.5 space-y-2">
          {isConnected && connection ? (
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-2.5 border border-border/40 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {connection.avatarUrl ? (
                  <img
                    src={connection.avatarUrl}
                    alt={connection.displayName || "Avatar"}
                    className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                    {(connection.displayName || provider.name).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-foreground truncate text-xs">
                  {connection.displayName || connection.externalId || "Linked User"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 pl-2">
                {connection.createdAt
                  ? `Added ${new Date(connection.createdAt).toLocaleDateString()}`
                  : connection.lastSyncedAt
                    ? `Added ${new Date(connection.lastSyncedAt).toLocaleDateString()}`
                    : "Connected"}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {provider.description}
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
        {isConnected && connection ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestHealth}
              disabled={isTesting || testCooldown > 0}
              className="h-8 text-xs gap-1.5"
            >
              {isTesting ? (
                <Spinner className="w-3 h-3" />
              ) : (
                <IconRefresh className="w-3.5 h-3.5" />
              )}
              {testCooldown > 0 ? `Test (${testCooldown}s)` : "Test"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenSettings(provider, connection)}
              className="h-8 text-xs gap-1.5"
            >
              <IconSettings className="w-3.5 h-3.5" />
              Settings
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConnectClick}
            className="w-full h-8 text-xs gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

