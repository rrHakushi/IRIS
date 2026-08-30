"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconKey,
  IconServer,
  IconUser,
} from "@tabler/icons-react";
import type { ProviderMetadata } from "./types";
import { toast } from "sonner";

interface ConnectDialogProps {
  provider: ProviderMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function ConnectDialog({
  provider,
  open,
  onOpenChange,
  onConnected,
}: ConnectDialogProps): React.JSX.Element | null {
  const [apiKey, setApiKey] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setApiKey("");
    setHostUrl(provider?.defaultHostUrl || "");
    setUsername("");
    setPassword("");
    setError(null);
  }, [provider]);

  // Reset fields whenever dialog opens or provider changes
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  if (!provider) return null;

  const isServarr = provider.category === "SERVARR";
  const isBangumi = provider.provider === "BANGUMI";
  const isSteam = provider.provider === "STEAM";
  const isRiot = provider.provider === "RIOT_GAMES";

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider: provider.provider,
          apiKey: apiKey.trim() || undefined,
          hostUrl: hostUrl.trim() || undefined,
          username: username.trim() || undefined,
          password: password || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to establish connection");
      }

      toast.success(`Successfully connected to ${provider.name}!`);
      resetForm();
      onOpenChange(false);
      onConnected();
    } catch (err: unknown) {
      setError((err as Error).message || "Connection failed. Please check credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleManualConnect} className="w-full">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center p-2 border border-border/40">
              <img
                src={provider.iconUrl}
                alt={provider.name}
                className="w-6 h-6 object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <DialogTitle>Connect {provider.name}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {isServarr
                  ? "Enter your server host URL and API key to connect."
                  : isBangumi
                    ? "Enter your Bangumi Personal Access Token."
                    : isRiot
                      ? "Enter your Riot ID (e.g. Player#1234) or API Key."
                      : isSteam
                        ? "Enter your SteamID64 or Steam Web API Key."
                        : "Enter connection credentials."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-in fade-in-50">
              <IconAlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isServarr && (
            <div className="space-y-1.5">
              <Label htmlFor="hostUrl" className="text-xs flex items-center gap-1.5 font-medium">
                <IconServer className="w-3.5 h-3.5 text-muted-foreground" />
                Server Host URL
              </Label>
              <Input
                id="hostUrl"
                placeholder="http://localhost:7878"
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                className="text-xs font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Include protocol (http/https) and port without trailing slash.
              </p>
            </div>
          )}

          {isRiot && (
            <div className="space-y-1.5">
              <Label htmlFor="riotUsername" className="text-xs flex items-center gap-1.5 font-medium">
                <IconUser className="w-3.5 h-3.5 text-muted-foreground" />
                Riot ID (GameName#TagLine)
              </Label>
              <Input
                id="riotUsername"
                placeholder="Faker#KR1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="text-xs font-mono"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Enter your in-game name and tagline separated by a hashtag.
              </p>
            </div>
          )}

          {(isServarr || isBangumi || isSteam || isRiot) && (
            <div className="space-y-1.5">
              <Label htmlFor="apiKey" className="text-xs flex items-center gap-1.5 font-medium">
                <IconKey className="w-3.5 h-3.5 text-muted-foreground" />
                {isBangumi
                  ? "Personal Access Token"
                  : isSteam
                    ? "Steam Web API Key / SteamID"
                    : isRiot
                      ? "Riot API Key (Optional if configured in server .env)"
                      : "API Key"}
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={
                  isBangumi
                    ? "Enter Bangumi access token"
                    : isSteam
                      ? "SteamID64 or Web API Key"
                      : isRiot
                        ? "RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        : "Enter 32-character API key"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-xs font-mono"
                required={!isRiot}
              />
            </div>
          )}

          <div className="pt-2 text-[11px] text-muted-foreground flex items-center justify-end">
            <a
              href={provider.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              Website <IconExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                Testing & Saving...
              </>
            ) : (
              <>
                <IconCheck className="w-4 h-4" />
                Connect
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

