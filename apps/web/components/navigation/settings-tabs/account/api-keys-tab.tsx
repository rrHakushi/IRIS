"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconPlus,
  IconSearch,
  IconAlertCircle,
  IconShieldLock,
  IconRefresh,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import type { SettingsTabProps } from "../types"
import type { ApiKeyItem } from "./api-keys/types"
import { ApiKeyItemCard } from "./api-keys/api-key-item-card"
import { CreateApiKeyDialog } from "./api-keys/create-api-key-dialog"
import { RevealApiKeyDialog } from "./api-keys/reveal-api-key-dialog"

export function ApiKeysSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys")
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [revealDialogOpen, setRevealDialogOpen] = useState(false)
  const [revealedRawKey, setRevealedRawKey] = useState<string | null>(null)
  const [revealedApiKey, setRevealedApiKey] = useState<ApiKeyItem | null>(null)
  const [isRevealedRegenerated, setIsRevealedRegenerated] = useState(false)

  // Item action loading states
  const [isCreating, setIsCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const hasFetchedRef = useRef(false)

  // Clear footer content for this tab since actions are modal/dialog based
  useEffect(() => {
    setFooterContent?.(null)
  }, [setFooterContent])

  // Fetch all API keys for user
  const fetchApiKeys = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true)
      else setIsLoading(true)
      setError(null)

      try {
        const res = await elysia.auth["api-keys"].get({
          fetch: { credentials: "include" },
        })

        if (res.error) {
          const errorData = res.error?.value as { message?: string } | undefined
          throw new Error(errorData?.message || t("failedLoad"))
        }

        if (res.data?.apiKeys) {
          setApiKeys(res.data.apiKeys)
        }
      } catch (err: any) {
        console.error("[ApiKeysTab] Fetch error:", err)
        const msg = err.message || t("failedLoad")
        setError(msg)
        if (isManualRefresh) toast.error(msg)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [t]
  )

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchApiKeys()
    }
  }, [fetchApiKeys])

  // Create API Key handler
  const handleCreateApiKey = async (
    name: string,
    expirationDays: number | null
  ): Promise<boolean> => {
    setIsCreating(true)
    setError(null)

    try {
      const res = await elysia.auth["api-keys"].post(
        {
          name,
          expirationDays: expirationDays ?? undefined,
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (res.error || !res.data) {
        const errorData = res.error?.value as { message?: string } | undefined
        throw new Error(errorData?.message || t("failedGenerate"))
      }

      const { rawKey, apiKey } = res.data

      // Update state
      setApiKeys((prev) => [apiKey, ...prev])
      setRevealedRawKey(rawKey)
      setRevealedApiKey(apiKey)
      setIsRevealedRegenerated(false)
      setCreateDialogOpen(false)
      setRevealDialogOpen(true)

      toast.success(t("createdSuccess"))
      return true
    } catch (err: any) {
      console.error("[ApiKeysTab] Create error:", err)
      const msg = err.message || t("failedCreate")
      toast.error(msg)
      return false
    } finally {
      setIsCreating(false)
    }
  }

  // Rename API Key handler
  const handleRenameApiKey = async (
    id: string,
    newName: string
  ): Promise<boolean> => {
    setRenamingId(id)

    try {
      const res = await elysia.auth["api-keys"]({ id }).patch(
        {
          name: newName,
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (res.error || !res.data) {
        const errorData = res.error?.value as { message?: string } | undefined
        throw new Error(errorData?.message || t("failedRename"))
      }

      const updatedKey = res.data.apiKey
      setApiKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, ...updatedKey } : k))
      )

      toast.success(t("renamedSuccess"))
      return true
    } catch (err: any) {
      console.error("[ApiKeysTab] Rename error:", err)
      toast.error(err.message || t("failedRename"))
      return false
    } finally {
      setRenamingId(null)
    }
  }

  // Regenerate API Key handler
  const handleRegenerateApiKey = async (id: string): Promise<boolean> => {
    setRegeneratingId(id)

    try {
      const res = await elysia.auth
        ["api-keys"]({ id })
        .regenerate.post(
          {},
          {
            fetch: { credentials: "include" },
          }
        )

      if (res.error || !res.data) {
        const errorData = res.error?.value as { message?: string } | undefined
        throw new Error(errorData?.message || t("failedRegenerate"))
      }

      const { rawKey, apiKey } = res.data

      // Update state
      setApiKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, ...apiKey } : k))
      )
      setRevealedRawKey(rawKey)
      setRevealedApiKey(apiKey)
      setIsRevealedRegenerated(true)
      setRevealDialogOpen(true)

      toast.success(t("regeneratedSuccess"))
      return true
    } catch (err: any) {
      console.error("[ApiKeysTab] Regenerate error:", err)
      toast.error(err.message || t("failedRegenerate"))
      return false
    } finally {
      setRegeneratingId(null)
    }
  }

  // Revoke / Delete API Key handler
  const handleDeleteApiKey = async (id: string): Promise<boolean> => {
    setDeletingId(id)

    try {
      const res = await elysia.auth["api-keys"]({ id }).delete(
        {},
        {
          fetch: { credentials: "include" },
        }
      )

      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined
        throw new Error(errorData?.message || t("failedDelete"))
      }

      setApiKeys((prev) => prev.filter((k) => k.id !== id))
      toast.success(t("revokedSuccess"))
      return true
    } catch (err: any) {
      console.error("[ApiKeysTab] Delete error:", err)
      toast.error(err.message || t("failedRevoke"))
      return false
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered keys
  const filteredKeys = apiKeys.filter((key) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      key.name.toLowerCase().includes(q) || key.prefix.toLowerCase().includes(q)
    )
  })

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-10 sm:pr-12">
        <div>
          <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Search filter if there are multiple keys */}
          {apiKeys.length > 3 && (
            <div className="relative w-36 sm:w-48">
              <IconSearch className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchKeysPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-xl bg-background/50 pl-8 text-xs"
              />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => fetchApiKeys(true)}
            disabled={isLoading || isRefreshing}
            aria-label={t("refreshAria")}
            className="size-8 shrink-0 rounded-xl"
          >
            <IconRefresh
              className={`size-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-8 shrink-0 gap-1.5 rounded-xl px-3.5 text-xs"
          >
            <IconPlus className="size-4" />
            <span>{t("createApiKey")}</span>
          </Button>
        </div>
      </div>

      {/* Main Keys Section */}
      <div className="space-y-3.5">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-muted/10 p-10">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs text-muted-foreground">
              {t("loadingApiKeys")}
            </p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <IconAlertCircle className="size-6 text-destructive" />
            <p className="text-xs font-medium text-destructive">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchApiKeys()}
              className="mt-1 h-7 rounded-lg text-xs"
            >
              {t("retry")}
            </Button>
          </div>
        ) : apiKeys.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/10 p-8 text-center sm:p-10">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <IconShieldLock className="size-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                {t("noApiKeysFound")}
              </h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("noApiKeysDesc")}
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="mt-1 h-8 gap-1.5 rounded-xl px-4 text-xs"
            >
              <IconPlus className="size-3.5" />
              <span>{t("createFirstKey")}</span>
            </Button>
          </div>
        ) : filteredKeys.length === 0 ? (
          /* Search Empty State */
          <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-8 text-center">
            <p className="text-xs text-muted-foreground">
              {t("noKeysMatching", { query: searchQuery })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="h-7 rounded-lg text-xs"
            >
              {t("clearSearch")}
            </Button>
          </div>
        ) : (
          /* Key List */
          <div className="space-y-3">
            {filteredKeys.map((key) => (
              <ApiKeyItemCard
                key={key.id}
                apiKey={key}
                onRename={handleRenameApiKey}
                onRegenerate={handleRegenerateApiKey}
                onDelete={handleDeleteApiKey}
                isRenaming={renamingId === key.id}
                isRegenerating={regeneratingId === key.id}
                isDeleting={deletingId === key.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <CreateApiKeyDialog
        isOpen={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateApiKey}
        isCreating={isCreating}
      />

      {/* Reveal Dialog (Shown after creation or regeneration) */}
      <RevealApiKeyDialog
        isOpen={revealDialogOpen}
        onOpenChange={setRevealDialogOpen}
        rawKey={revealedRawKey}
        apiKey={revealedApiKey}
        isRegenerated={isRevealedRegenerated}
      />
    </div>
  )
}
