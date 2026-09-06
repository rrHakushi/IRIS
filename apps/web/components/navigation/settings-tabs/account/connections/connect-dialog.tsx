"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconKey,
  IconServer,
  IconUser,
} from "@tabler/icons-react"
import type { ProviderMetadata } from "./types"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"

interface ConnectDialogProps {
  provider: ProviderMetadata | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected: () => void
}

export function ConnectDialog({
  provider,
  open,
  onOpenChange,
  onConnected,
}: ConnectDialogProps): React.JSX.Element | null {
  const [apiKey, setApiKey] = useState("")
  const [hostUrl, setHostUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setApiKey("")
    setHostUrl(provider?.defaultHostUrl || "")
    setUsername("")
    setPassword("")
    setError(null)
  }, [provider])

  // Reset fields whenever dialog opens or provider changes
  useEffect(() => {
    if (open) {
      resetForm()
    }
  }, [open, resetForm])

  if (!provider) return null

  const isServarr = provider.category === "SERVARR"
  const isBangumi = provider.provider === "BANGUMI"
  const isSteam = provider.provider === "STEAM"
  const isRiot = provider.provider === "RIOT_GAMES"
  const isLastFm = provider.provider === "LASTFM"

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: submitErr } = await elysia.connections.post(
        {
          provider: provider.provider as any,
          apiKey: apiKey.trim() || undefined,
          hostUrl: hostUrl.trim() || undefined,
          username: username.trim() || undefined,
          password: password || undefined,
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (submitErr) {
        throw new Error(
          (submitErr as any)?.value?.message || "Failed to establish connection"
        )
      }

      toast.success(`Successfully connected to ${provider.name}!`)
      resetForm()
      onOpenChange(false)
      onConnected()
    } catch (err: unknown) {
      setError(
        (err as Error).message || "Connection failed. Please check credentials."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleManualConnect} className="w-full">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-muted/40 p-2">
              <img
                src={provider.iconUrl}
                alt={provider.name}
                className="h-6 w-6 object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <DialogTitle>Connect {provider.name}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {isServarr
                  ? "Enter your server host URL and API key to connect."
                  : isBangumi
                    ? "Enter your Bangumi Personal Access Token."
                    : isRiot
                      ? "Enter your Riot ID (e.g. Player#1234) or API Key."
                      : isSteam
                        ? "Enter your SteamID64 or Steam Web API Key."
                        : isLastFm
                          ? "Enter your Last.fm username or Session Key to scrobble tracks."
                          : "Enter connection credentials."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex animate-in items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive fade-in-50">
              <IconAlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isServarr && (
            <div className="space-y-1.5">
              <Label
                htmlFor="hostUrl"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <IconServer className="h-3.5 w-3.5 text-muted-foreground" />
                Server Host URL
              </Label>
              <Input
                id="hostUrl"
                placeholder="http://localhost:7878"
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                className="font-mono text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Include protocol (http/https) and port without trailing slash.
              </p>
            </div>
          )}

          {isRiot && (
            <div className="space-y-1.5">
              <Label
                htmlFor="riotUsername"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <IconUser className="h-3.5 w-3.5 text-muted-foreground" />
                Riot ID (GameName#TagLine)
              </Label>
              <Input
                id="riotUsername"
                placeholder="Faker#KR1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-mono text-xs"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Enter your in-game name and tagline separated by a hashtag.
              </p>
            </div>
          )}

          {isLastFm && (
            <div className="space-y-1.5">
              <Label
                htmlFor="lastFmUsername"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <IconUser className="h-3.5 w-3.5 text-muted-foreground" />
                Last.fm Username
              </Label>
              <Input
                id="lastFmUsername"
                placeholder="Your Last.fm Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-mono text-xs"
                required
                autoFocus
              />
            </div>
          )}

          {(isServarr || isBangumi || isSteam || isRiot || isLastFm) && (
            <div className="space-y-1.5">
              <Label
                htmlFor="apiKey"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <IconKey className="h-3.5 w-3.5 text-muted-foreground" />
                {isBangumi
                  ? "Personal Access Token"
                  : isSteam
                    ? "Steam Web API Key / SteamID"
                    : isRiot
                      ? "Riot API Key (Optional if configured in server .env)"
                      : isLastFm
                        ? "Last.fm Session Key / API Key (Optional for basic scrobbling)"
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
                        : isLastFm
                          ? "Enter Last.fm session key (optional)"
                          : "Enter 32-character API key"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs"
                required={!isRiot && !isLastFm}
              />
            </div>
          )}

          <div className="flex items-center justify-end pt-2 text-[11px] text-muted-foreground">
            <a
              href={provider.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-primary"
            >
              Website <IconExternalLink className="h-3 w-3" />
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
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                Testing & Saving...
              </>
            ) : (
              <>
                <IconCheck className="h-4 w-4" />
                Connect
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
