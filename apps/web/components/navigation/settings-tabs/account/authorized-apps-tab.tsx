"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconApps,
  IconShieldCheck,
  IconRefresh,
  IconAlertCircle,
  IconExternalLink,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import type { SettingsTabProps } from "../types"

interface AuthorizationItem {
  id: string
  clientId: string
  client: {
    id: string
    clientId: string
    name: string
    description?: string | null
    logoUrl?: string | null
    websiteUrl?: string | null
    isPublic: boolean
    isTrusted: boolean
  }
  scopes: string[]
  scopeDetails: Array<{
    scope: string
    name: string
    description: string
  }>
  authorizedAt: string
  lastUsedAt?: string | null
  isActive: boolean
}

export function AuthorizedAppsSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const [authorizations, setAuthorizations] = useState<AuthorizationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasFetchedRef = useRef(false)

  useEffect(() => {
    setFooterContent?.(null)
  }, [setFooterContent])

  const fetchAuthorizations = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      const res = await elysia.oauth.authorizations.get({
        fetch: { credentials: "include" },
      })

      if (res.error) {
        const errorData = res.error.value as { message?: string } | undefined
        throw new Error(errorData?.message || "Failed to load authorized applications")
      }

      if (res.data?.authorizations) {
        setAuthorizations(res.data.authorizations as unknown as AuthorizationItem[])
      }
    } catch (err: any) {
      console.error("[AuthorizedAppsTab] Fetch error:", err)
      const msg = err.message || "Failed to load authorized applications"
      setError(msg)
      if (isManualRefresh) toast.error(msg)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchAuthorizations()
    }
  }, [fetchAuthorizations])

  const handleRevoke = async (item: AuthorizationItem) => {
    if (
      !confirm(
        `Are you sure you want to revoke access for "${item.client.name}"? This application will no longer be able to access your account.`
      )
    ) {
      return
    }

    setRevokingId(item.id)
    try {
      const res = await elysia.oauth.authorizations({ id: item.id }).delete(
        {},
        { fetch: { credentials: "include" } }
      )

      if (res.error) {
        const errData = res.error.value as { message?: string } | undefined
        toast.error(errData?.message || "Failed to revoke authorization")
        return
      }

      setAuthorizations((prev) => prev.filter((a) => a.id !== item.id))
      toast.success(`Revoked access for ${item.client.name}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke authorization")
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <IconShieldCheck className="size-6" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Authorized Applications
          </h2>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Spinner className="size-7 text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">Loading authorized applications...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <IconAlertCircle className="size-8 text-destructive mb-2" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchAuthorizations(true)}
            className="mt-4 text-xs h-8"
          >
            Retry
          </Button>
        </div>
      ) : authorizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground mb-3">
            <IconApps className="size-6" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            No authorized applications
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            You have not authorized any external applications or remote IRIS instances to access your account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {authorizations.map((item) => {
            const formattedDate = new Date(item.authorizedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
            const lastUsedFormatted = item.lastUsedAt
              ? new Date(item.lastUsedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 transition-all hover:border-border hover:bg-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 overflow-hidden">
                      {item.client.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.client.logoUrl}
                          alt={item.client.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <IconApps className="size-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-sm font-semibold text-foreground truncate">
                          {item.client.name}
                        </h3>
                        {item.client.isTrusted && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            Verified
                          </Badge>
                        )}
                      </div>
                      {item.client.websiteUrl && (
                        <a
                          href={item.client.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span>{new URL(item.client.websiteUrl).hostname}</span>
                          <IconExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokingId === item.id}
                    onClick={() => handleRevoke(item)}
                    className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/40 shrink-0"
                  >
                    {revokingId === item.id ? (
                      <Spinner className="size-3.5 me-1.5" />
                    ) : (
                      <IconTrash className="size-3.5 me-1.5" />
                    )}
                    Revoke
                  </Button>
                </div>

                {/* Scopes granted */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Permissions granted</span>
                    <span>
                      Authorized on {formattedDate}
                      {lastUsedFormatted && ` • Last active: ${lastUsedFormatted}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.scopeDetails.map((scope) => (
                      <span
                        key={scope.scope}
                        className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                        title={scope.description}
                      >
                        {scope.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
