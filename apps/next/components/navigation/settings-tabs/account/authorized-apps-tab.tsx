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
  appName?: string
  appLogo?: string | null
  websiteUrl?: string | null
  client?: {
    id?: string
    clientId?: string
    name?: string
    logoUrl?: string | null
    websiteUrl?: string | null
    isTrusted?: boolean
  }
  authorizedAt: string
  lastUsedAt?: string | null
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
      const res = await elysia.carina.oauth.authorizations.get({
        fetch: { credentials: "include" },
      })

      if (res.error) {
        const errorData = res.error.value as { message?: string } | undefined
        throw new Error(
          errorData?.message || "Failed to load authorized applications"
        )
      }

      if (res.data?.authorizations) {
        setAuthorizations(
          res.data.authorizations as unknown as AuthorizationItem[]
        )
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
    const appName = item.appName || item.client?.name || item.clientId
    if (
      !confirm(
        `Are you sure you want to revoke access for "${appName}"? This application will no longer be able to access your account.`
      )
    ) {
      return
    }

    setRevokingId(item.id)
    try {
      const res = await elysia.carina.oauth
        .authorizations({ id: item.id })
        .delete()

      if (res.error) {
        const errData = res.error.value as { message?: string } | undefined
        toast.error(errData?.message || "Failed to revoke authorization")
        return
      }

      setAuthorizations((prev) => prev.filter((a) => a.id !== item.id))
      toast.success(`Revoked access for ${appName}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke authorization")
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Spinner className="size-7 text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">
            Loading authorized applications...
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <IconAlertCircle className="mb-2 size-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            onPress={() => fetchAuthorizations(true)}
            className="mt-4 h-8 text-xs"
          >
            Retry
          </Button>
        </div>
      ) : authorizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground">
            <IconApps className="size-6" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            No authorized applications
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            You have not authorized any external applications or remote IRIS
            instances to access your account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {authorizations.map((item) => {
            const formattedDate = new Date(
              item.authorizedAt
            ).toLocaleDateString(undefined, {
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

            const appName = item.appName || item.client?.name || item.clientId
            const appLogo = item.appLogo || item.client?.logoUrl || null
            const websiteUrl = item.websiteUrl || item.client?.websiteUrl || null
            const isTrusted = item.client?.isTrusted || false

            let hostname = ""
            if (websiteUrl) {
              try {
                hostname = new URL(websiteUrl).hostname
              } catch {
                hostname = websiteUrl
              }
            }

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 transition-all hover:border-border hover:bg-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                      {appLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={appLogo}
                          alt={appName}
                          className="size-full object-cover"
                        />
                      ) : (
                        <IconApps className="size-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-heading text-sm font-semibold text-foreground">
                          {appName}
                        </h3>
                        {isTrusted && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 py-0 text-[10px]"
                          >
                            Verified
                          </Badge>
                        )}
                      </div>
                      {websiteUrl && (
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <span>{hostname}</span>
                          <IconExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={revokingId === item.id}
                    onPress={() => handleRevoke(item)}
                    className="h-8 shrink-0 px-3 text-xs text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  >
                    {revokingId === item.id ? (
                      <Spinner className="me-1.5 size-3.5" />
                    ) : (
                      <IconTrash className="me-1.5 size-3.5" />
                    )}
                    Revoke
                  </Button>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
                  <span>
                    Authorized on {formattedDate}
                    {lastUsedFormatted && ` • Last active: ${lastUsedFormatted}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
