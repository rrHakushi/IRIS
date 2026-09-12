"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconPlus,
  IconSearch,
  IconAlertCircle,
  IconWorld,
  IconRefresh,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import type { SettingsTabProps } from "../types"
import type { OAuthAppItem, CreateOAuthAppPayload, EditOAuthAppPayload } from "./oauth-apps/types"
import { OAuthAppItemCard } from "./oauth-apps/oauth-app-item-card"
import { CreateOAuthAppDialog } from "./oauth-apps/create-oauth-app-dialog"
import { RevealOAuthSecretDialog } from "./oauth-apps/reveal-oauth-secret-dialog"
import { EditOAuthAppDialog } from "./oauth-apps/edit-oauth-app-dialog"

export function OAuthAppsSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const [apps, setApps] = useState<OAuthAppItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [revealDialogOpen, setRevealDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<OAuthAppItem | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [isSecretRegenerated, setIsSecretRegenerated] = useState(false)

  // Action loaders
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const hasFetchedRef = useRef(false)

  useEffect(() => {
    setFooterContent?.(null)
  }, [setFooterContent])

  const fetchApps = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      const res = await elysia.oauth.apps.get({
        fetch: { credentials: "include" },
      })

      if (res.error) {
        const errorData = res.error.value as { message?: string } | undefined
        throw new Error(errorData?.message || "Failed to load OAuth applications")
      }

      if (res.data?.apps) {
        setApps(res.data.apps as unknown as OAuthAppItem[])
      }
    } catch (err: any) {
      console.error("[OAuthAppsTab] Fetch error:", err)
      const msg = err.message || "Failed to load OAuth applications"
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
      fetchApps()
    }
  }, [fetchApps])

  // Create Application
  const handleCreateApp = async (payload: CreateOAuthAppPayload): Promise<boolean> => {
    setIsCreating(true)
    try {
      const res = await elysia.oauth.apps.post(payload, {
        fetch: { credentials: "include" },
      })

      if (res.error) {
        const errData = res.error.value as { message?: string } | undefined
        toast.error(errData?.message || "Failed to create application")
        return false
      }

      if (res.data?.app) {
        const newApp = res.data.app as unknown as OAuthAppItem
        const secret = (res.data.app as any).clientSecret || null
        setApps((prev) => [newApp, ...prev])
        toast.success("Application registered successfully!")

        if (secret) {
          setSelectedApp(newApp)
          setRevealedSecret(secret)
          setIsSecretRegenerated(false)
          setRevealDialogOpen(true)
        }
        return true
      }
      return false
    } catch (err: any) {
      toast.error(err.message || "Failed to create application")
      return false
    } finally {
      setIsCreating(false)
    }
  }

  // Edit Application
  const handleEditApp = async (id: string, payload: EditOAuthAppPayload): Promise<boolean> => {
    setIsEditing(true)
    try {
      const res = await elysia.oauth.apps({ id }).put(payload, {
        fetch: { credentials: "include" },
      })

      if (res.error) {
        const errData = res.error.value as { message?: string } | undefined
        toast.error(errData?.message || "Failed to update application")
        return false
      }

      if (res.data?.app) {
        const updatedApp = res.data.app as unknown as OAuthAppItem
        setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updatedApp } : a)))
        toast.success("Application updated successfully!")
        return true
      }
      return false
    } catch (err: any) {
      toast.error(err.message || "Failed to update application")
      return false
    } finally {
      setIsEditing(false)
    }
  }

  // Regenerate Secret
  const handleRegenerateSecret = async (app: OAuthAppItem) => {
    if (app.isPublic) return
    if (!confirm(`Are you sure you want to regenerate the client secret for "${app.name}"? The existing secret will stop working immediately.`)) {
      return
    }

    setRegeneratingId(app.id)
    try {
      const res = await elysia.oauth.apps({ id: app.id })["regenerate-secret"].post(
        {},
        { fetch: { credentials: "include" } }
      )

      if (res.error) {
        const errData = res.error.value as { message?: string } | undefined
        toast.error(errData?.message || "Failed to regenerate client secret")
        return
      }

      if (res.data?.clientSecret) {
        setSelectedApp(app)
        setRevealedSecret(res.data.clientSecret)
        setIsSecretRegenerated(true)
        setRevealDialogOpen(true)
        toast.success("Client secret regenerated!")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate secret")
    } finally {
      setRegeneratingId(null)
    }
  }

  // Delete Application
  const handleDeleteApp = async (app: OAuthAppItem) => {
    if (!confirm(`Are you sure you want to delete "${app.name}"? All active user authorizations and access tokens will be revoked.`)) {
      return
    }

    setDeletingId(app.id)
    try {
      const res = await elysia.oauth.apps({ id: app.id }).delete(
        {},
        { fetch: { credentials: "include" } }
      )

      if (res.error) {
        const errData = res.error.value as { message?: string } | undefined
        toast.error(errData?.message || "Failed to delete application")
        return
      }

      setApps((prev) => prev.filter((a) => a.id !== app.id))
      toast.success("Application deleted successfully")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete application")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredApps = apps.filter((app) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      app.name.toLowerCase().includes(query) ||
      app.clientId.toLowerCase().includes(query) ||
      app.description?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <IconWorld className="size-6" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              OAuth Applications
            </h2>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setCreateDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 px-4 gap-1.5 shrink-0"
        >
          <IconPlus className="size-4" />
          Register Application
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <IconSearch className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by application name or client ID..."
          className="ps-9 text-xs h-9"
        />
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Spinner className="size-7 text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">Loading applications...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <IconAlertCircle className="size-8 text-destructive mb-2" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchApps(true)}
            className="mt-4 text-xs h-8"
          >
            Retry
          </Button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground mb-3">
            <IconWorld className="size-6" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {searchQuery ? "No matching applications" : "No applications registered yet"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {searchQuery
              ? "Try adjusting your search keywords."
              : "Register your first third-party client, mobile app, or remote IRIS instance connection."}
          </p>
          {!searchQuery && (
            <Button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-4 gap-1.5"
            >
              <IconPlus className="size-3.5" />
              Register Application
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredApps.map((app) => (
            <OAuthAppItemCard
              key={app.id}
              app={app}
              onEdit={(item) => {
                setSelectedApp(item)
                setEditDialogOpen(true)
              }}
              onRegenerateSecret={handleRegenerateSecret}
              onDelete={handleDeleteApp}
              isRegenerating={regeneratingId === app.id}
              isDeleting={deletingId === app.id}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateOAuthAppDialog
        isOpen={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateApp}
        isLoading={isCreating}
      />

      <EditOAuthAppDialog
        isOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        app={selectedApp}
        onSubmit={handleEditApp}
        isLoading={isEditing}
      />

      <RevealOAuthSecretDialog
        isOpen={revealDialogOpen}
        onOpenChange={setRevealDialogOpen}
        rawSecret={revealedSecret}
        app={selectedApp}
        isRegenerated={isSecretRegenerated}
      />
    </div>
  )
}
