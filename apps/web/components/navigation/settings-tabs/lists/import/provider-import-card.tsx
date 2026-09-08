"use client"

import React, { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconCheck,
  IconCloudDownload,
  IconArrowRight,
} from "@tabler/icons-react"
import type { UserConnectionItem } from "../../account/connections/types"
import {
  ImportMediaDialog,
  type ImportMediaTypeOption,
} from "./import-media-dialog"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { useTranslations } from "next-intl"

export interface ProviderImportConfig {
  id: string
  key: string
  name: string
  iconUrl: string
  websiteUrl: string
  supportsOAuth: boolean
  availableMediaTypes: ImportMediaTypeOption[]
}

interface ProviderImportCardProps {
  config: ProviderImportConfig
  connection?: UserConnectionItem
  onOpenManualConnect?: (providerKey: string) => void
  onRefreshConnections: () => void
}

export function ProviderImportCard({
  config,
  connection,
  onOpenManualConnect,
}: ProviderImportCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.lists.import")
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isStartingImport, setIsStartingImport] = useState(false)

  const isConnected = connection && connection.status === "CONNECTED"

  // Handle OAuth connect
  const handleConnect = async () => {
    if (!config.supportsOAuth) {
      onOpenManualConnect?.(config.key)
      return
    }

    setIsConnecting(true)
    try {
      const returnTo =
        typeof window !== "undefined"
          ? window.location.href
          : "/settings?tab=lists"

      const { data, error } = await elysia
        .connections({ id: config.id })
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
      setIsConnecting(false)
    }
  }

  // Handle start import
  const handleStartImport = async (selectedTypes: string[]) => {
    setIsStartingImport(true)
    try {
      const hasCustomLists = selectedTypes.includes("custom_lists")
      const mediaTypes = selectedTypes.filter((type) => type !== "custom_lists")

      const { data, error } = await elysia
        .connections({ id: config.id })
        .import.post(
          {
            mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
            customLists: hasCustomLists || undefined,
          },
          {
            fetch: { credentials: "include" },
          }
        )

      if (error || !data?.success) {
        throw new Error(
          (error as any)?.value?.message || "Failed to start import"
        )
      }

      toast.info(
        `Import started for ${config.name}. You will receive a notification as each list finishes importing.`
      )
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not start import")
      throw err
    } finally {
      setIsStartingImport(false)
    }
  }

  return (
    <>
      <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
        <div className="space-y-3">
          {/* Top Row: Provider Logo, Name & Connection Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/40 p-2">
                <img
                  src={config.iconUrl}
                  alt={config.name}
                  className="h-6 w-6 object-contain"
                  loading="lazy"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {config.name}
                  </h4>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>{connection?.displayName || t("connected")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      <span>{t("notConnected")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Action or Status Badge */}
            {isConnected ? (
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <IconCheck className="me-1 h-3 w-3" />
                {t("connected")}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting}
                className="h-8 gap-1.5 text-xs"
              >
                {isConnecting ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <>
                    <span>{t("connect")}</span>
                    <IconArrowRight className="h-3 w-3" />
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Supported Media Categories Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {config.availableMediaTypes.map((type) => (
              <Badge
                key={type.id}
                variant="secondary"
                className="gap-1 bg-muted/60 px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
              >
                <type.icon className="h-3 w-3 text-foreground/70" />
                {type.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
          {isConnected && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              disabled={isStartingImport}
              className="h-8 gap-1.5 text-xs"
            >
              {isStartingImport ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <IconCloudDownload className="h-3.5 w-3.5" />
              )}
              <span>{t("startImport")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Media Type Selection Dialog */}
      {importDialogOpen && (
        <ImportMediaDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          providerKey={config.key}
          providerName={config.name}
          providerIconUrl={config.iconUrl}
          availableMediaTypes={config.availableMediaTypes}
          onStartImport={handleStartImport}
        />
      )}
    </>
  )
}
