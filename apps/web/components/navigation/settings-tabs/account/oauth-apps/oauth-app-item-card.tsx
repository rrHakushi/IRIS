"use client"

import React, { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconCopy,
  IconCheck,
  IconEdit,
  IconRefresh,
  IconTrash,
  IconExternalLink,
  IconWorld,
  IconShieldLock,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { OAuthAppItem } from "./types"

export interface OAuthAppItemCardProps {
  app: OAuthAppItem
  onEdit: (app: OAuthAppItem) => void
  onRegenerateSecret: (app: OAuthAppItem) => void
  onDelete: (app: OAuthAppItem) => void
  isRegenerating?: boolean
  isDeleting?: boolean
}

export function OAuthAppItemCard({
  app,
  onEdit,
  onRegenerateSecret,
  onDelete,
  isRegenerating = false,
  isDeleting = false,
}: OAuthAppItemCardProps): React.JSX.Element {
  const [copiedClientId, setCopiedClientId] = useState(false)

  const handleCopyClientId = async () => {
    try {
      await navigator.clipboard.writeText(app.clientId)
      setCopiedClientId(true)
      toast.success("Client ID copied to clipboard!")
      setTimeout(() => setCopiedClientId(false), 2000)
    } catch {
      toast.error("Failed to copy Client ID.")
    }
  }

  const formattedDate = new Date(app.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 transition-all hover:border-border hover:bg-card">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 overflow-hidden">
            {app.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={app.logoUrl}
                alt={app.name}
                className="size-full object-cover"
              />
            ) : (
              <IconWorld className="size-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-semibold text-foreground truncate">
                {app.name}
              </h3>
              {app.isPublic ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-500">
                  Public (PKCE)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                  Confidential
                </Badge>
              )}
            </div>
            {app.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {app.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(app)}
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Edit Application"
          >
            <IconEdit className="size-4" />
          </Button>

          {!app.isPublic && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isRegenerating}
              onClick={() => onRegenerateSecret(app)}
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Regenerate Client Secret"
            >
              {isRegenerating ? (
                <Spinner className="size-4" />
              ) : (
                <IconRefresh className="size-4" />
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isDeleting}
            onClick={() => onDelete(app)}
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label="Delete Application"
          >
            {isDeleting ? (
              <Spinner className="size-4" />
            ) : (
              <IconTrash className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Client ID snippet */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground shrink-0">
            Client ID:
          </span>
          <span className="font-mono text-[11px] text-foreground truncate select-all">
            {app.clientId}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopyClientId}
          className="size-6 text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Copy Client ID"
        >
          {copiedClientId ? (
            <IconCheck className="size-3.5 text-emerald-500" />
          ) : (
            <IconCopy className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Redirect URIs */}
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Redirect URIs ({app.redirectUris.length})</span>
          <span>Created on {formattedDate}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {app.redirectUris.map((uri, idx) => (
            <span
              key={idx}
              className="inline-block rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-xs"
              title={uri}
            >
              {uri}
            </span>
          ))}
        </div>
      </div>

      {/* Footer info: Scopes and active authorizations */}
      <div className="flex items-center justify-between pt-1 text-xs border-t border-border/40">
        <div className="flex flex-wrap gap-1">
          {app.allowedScopes.slice(0, 4).map((scope) => (
            <span
              key={scope}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {scope}
            </span>
          ))}
          {app.allowedScopes.length > 4 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{app.allowedScopes.length - 4} more
            </span>
          )}
        </div>

        {app.authorizedUsersCount !== undefined && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <IconUsers className="size-3" />
            <span>{app.authorizedUsersCount} users</span>
          </div>
        )}
      </div>
    </div>
  )
}
