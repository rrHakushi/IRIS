"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import type { SettingsTabProps } from "../types"
import type { ProviderMetadata, UserConnectionItem } from "../account/connections/types"
import { ProviderImportCard, type ProviderImportConfig } from "./import/provider-import-card"
import { FileBackupImportCard } from "./import/file-backup-import-card"
import { ConnectDialog } from "../account/connections/connect-dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconPlaylist,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { useTranslations } from "next-intl"

export function ListsImportSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.lists.import")
  const [providers, setProviders] = useState<ProviderMetadata[]>([])
  const [connections, setConnections] = useState<UserConnectionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Manual connect dialog for non-OAuth providers (like Bangumi PAT)
  const [selectedManualProvider, setSelectedManualProvider] =
    useState<ProviderMetadata | null>(null)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)

  const inFlightRef = useRef(false)

  const fetchData = useCallback(async (silent = false) => {
    if (inFlightRef.current && !silent) return
    inFlightRef.current = true

    if (!silent) setIsLoading(true)

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
      console.error("Failed to load connections for import:", err)
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOpenManualConnect = (providerKey: string) => {
    const meta = providers.find((p) => p.provider === providerKey)
    if (meta) {
      setSelectedManualProvider(meta)
      setConnectDialogOpen(true)
    }
  }

  // Base list of import-supported providers
  const importConfigs: ProviderImportConfig[] = [
    {
      id: "anilist",
      key: "ANILIST",
      name: "AniList",
      iconUrl:
        providers.find((p) => p.provider === "ANILIST")?.iconUrl ||
        "https://cdn.simpleicons.org/anilist/02A9FF",
      websiteUrl: "https://anilist.co",
      supportsOAuth: true,
      availableMediaTypes: [
        { id: "anime", label: t("types.anime"), icon: IconDeviceTv },
        { id: "manga", label: t("types.manga"), icon: IconBook },
        { id: "custom_lists", label: t("types.custom_lists"), icon: IconPlaylist },
      ],
    },
    {
      id: "mal",
      key: "MAL",
      name: "MyAnimeList",
      iconUrl:
        providers.find((p) => p.provider === "MAL")?.iconUrl ||
        "https://cdn.simpleicons.org/myanimelist/2E51A2",
      websiteUrl: "https://myanimelist.net",
      supportsOAuth: true,
      availableMediaTypes: [
        { id: "anime", label: t("types.anime"), icon: IconDeviceTv },
        { id: "manga", label: t("types.manga"), icon: IconBook },
      ],
    },
    {
      id: "simkl",
      key: "SIMKL",
      name: "Simkl",
      iconUrl:
        providers.find((p) => p.provider === "SIMKL")?.iconUrl ||
        "https://cdn.simpleicons.org/simkl/00ADEF",
      websiteUrl: "https://simkl.com",
      supportsOAuth: true,
      availableMediaTypes: [
        { id: "anime", label: t("types.anime"), icon: IconDeviceTv },
        { id: "tv", label: t("types.tv"), icon: IconDeviceTv },
        { id: "movie", label: t("types.movie"), icon: IconMovie },
      ],
    },
    {
      id: "bangumi",
      key: "BANGUMI",
      name: "Bangumi",
      iconUrl:
        providers.find((p) => p.provider === "BANGUMI")?.iconUrl ||
        "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/bangumi.svg",
      websiteUrl: "https://bgm.tv",
      supportsOAuth: false,
      availableMediaTypes: [
        { id: "anime", label: t("types.anime"), icon: IconDeviceTv },
        { id: "manga", label: t("types.manga"), icon: IconBook },
      ],
    },
    {
      id: "deezer",
      key: "DEEZER",
      name: "Deezer",
      iconUrl:
        providers.find((p) => p.provider === "DEEZER")?.iconUrl ||
        "https://e-cdns-files.dzcdn.net/img/common/favicon/favicon.ico",
      websiteUrl: "https://deezer.com",
      supportsOAuth: true,
      availableMediaTypes: [
        { id: "custom_lists", label: t("types.custom_lists"), icon: IconPlaylist },
      ],
    },
  ]

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      {/* Header section with Title */}
      <div>
        <h3 className="text-base font-bold text-foreground">
          {t("title")}
        </h3>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Connected Services Grid */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {t("connectedServices")}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {importConfigs.map((cfg) => {
                const conn = connections.find(
                  (c) => c.provider.toUpperCase() === cfg.key.toUpperCase()
                )
                return (
                  <ProviderImportCard
                    key={cfg.id}
                    config={cfg}
                    connection={conn}
                    onOpenManualConnect={handleOpenManualConnect}
                    onRefreshConnections={() => fetchData(true)}
                  />
                )
              })}
            </div>
          </div>

          {/* Section 2: JSON Backup File Import */}
          <div className="space-y-3">
            <FileBackupImportCard />
          </div>
        </div>
      )}

      {/* Manual Connect Dialog (for Bangumi PAT) */}
      <ConnectDialog
        provider={selectedManualProvider}
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnected={() => fetchData(true)}
      />
    </div>
  )
}
