"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  IconX,
  IconCheck,
  IconTrash,
  IconGitFork,
  IconEdit,
  IconCalendar,
  IconStar,
  IconClock,
  IconEye,
  IconPhotoOff,
  IconLock,
  IconExternalLink,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { elysia } from "@/lib/elysia"
import { useUser } from "@/context/user-context"
import { useEncryption } from "@/context/encryption-context"
import { deriveVaultKey, safeDecryptText, safeEncryptText } from "@/lib/client-encryption"
import type { ListEntryData } from "../types"
import type { MediaListStatus } from "../../media/list/types"
import { CreateOtherItemDialog, type OtherCatalogItem } from "./create-other-item-dialog"

export interface OtherListEntryModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  item: ListEntryData | null
  isOwner: boolean
  onItemUpdated?: (entryId: number, updatedEntry: any) => void
  onItemDeleted?: (entryId: number) => void
}

const DEFAULT_STATUS_LIST = [
  { key: "IN_PROGRESS", label: "Tracking", badge: "border-primary/40 bg-primary/10 text-primary" },
  { key: "PLANNED", label: "Planning", badge: "border-border bg-muted/60 text-muted-foreground" },
  { key: "COMPLETED", label: "Completed", badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  { key: "ON_HOLD", label: "On Hold", badge: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  { key: "DROPPED", label: "Dropped", badge: "border-destructive/40 bg-destructive/10 text-destructive" },
]

export function OtherListEntryModal({
  isOpen,
  onOpenChange,
  item,
  isOwner,
  onItemUpdated,
  onItemDeleted,
}: OtherListEntryModalProps): React.JSX.Element | null {
  const { user } = useUser()
  const { secretKey, isActive: isVaultActive } = useEncryption()
  const vaultKey = useMemo(
    () => (isVaultActive && secretKey ? deriveVaultKey(secretKey) : null),
    [isVaultActive, secretKey]
  )

  const media = item?.media as any
  const entry = item?.entry as any

  const otherId = Number(media?.id || 0)
  const isCreator = Boolean(user?.id && media?.creatorId && user.id === media.creatorId)

  // Tracking form states
  const [status, setStatus] = useState<MediaListStatus>("IN_PROGRESS")
  const [progressValues, setProgressValues] = useState<Record<string, number>>({})
  const [score, setScore] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<string>("")
  const [completedAt, setCompletedAt] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [isPrivate, setIsPrivate] = useState<boolean>(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingEntry, setIsDeletingEntry] = useState(false)
  const [isDeletingCatalogItem, setIsDeletingCatalogItem] = useState(false)
  const [isForking, setIsForking] = useState(false)

  // Edit catalog item dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Initialize entry form state
  useEffect(() => {
    if (entry) {
      const raw = (entry.status || "IN_PROGRESS").toUpperCase()
      const norm: MediaListStatus =
        raw === "CURRENT" || raw === "TRACKING" || raw === "WATCHING"
          ? "IN_PROGRESS"
          : raw === "PLANNING"
            ? "PLANNED"
            : (raw as MediaListStatus)
      setStatus(norm)
      setScore(entry.score ?? null)
      setIsPrivate(Boolean(entry.private))
      setStartedAt(
        entry.startedAt
          ? new Date(entry.startedAt).toISOString().slice(0, 10)
          : ""
      )
      setCompletedAt(
        entry.completedAt
          ? new Date(entry.completedAt).toISOString().slice(0, 10)
          : ""
      )

      // Initialize progressValues
      const initialProgMap: Record<string, number> = {}
      const incKey = media?.incrementFieldKey || "progress"
      const existingValues = entry.progressValues || {}

      if (Array.isArray(media?.progressFields)) {
        for (const f of media.progressFields) {
          if (existingValues[f.key] !== undefined) {
            initialProgMap[f.key] = Number(existingValues[f.key])
          } else if (f.key === incKey && entry.progress !== undefined) {
            initialProgMap[f.key] = Number(entry.progress)
          } else {
            initialProgMap[f.key] = 0
          }
        }
      } else {
        initialProgMap[incKey] = Number(entry.progress ?? 0)
      }
      setProgressValues(initialProgMap)

      // Decrypt notes if encrypted
      const rawNotes = entry.notes || ""
      if (rawNotes.startsWith("enc:") && vaultKey) {
        setNotes(safeDecryptText(rawNotes, vaultKey))
      } else {
        setNotes(rawNotes)
      }
    } else {
      setStatus("IN_PROGRESS")
      setProgressValues({})
      setScore(null)
      setStartedAt("")
      setCompletedAt("")
      setNotes("")
      setIsPrivate(false)
    }
  }, [entry, media, vaultKey, isOpen])

  // Progress field definitions from catalog item
  const progressFields: Array<{
    key: string
    label: string
    unit?: string | null
    max?: number | null
  }> = useMemo(() => {
    if (Array.isArray(media?.progressFields) && media.progressFields.length > 0) {
      return media.progressFields
    }
    return [{ key: "progress", label: "Progress", unit: "units", max: null }]
  }, [media?.progressFields])

  // Status options from catalog item or defaults
  const statusOptions = useMemo(() => {
    return DEFAULT_STATUS_LIST
  }, [])

  // Pre-update snapshot notice
  const hasSnapshot = Boolean(media?.preUpdateSnapshot)

  // Quick increment progress value helper
  const handleDeltaProgress = (key: string, delta: number, max?: number | null) => {
    setProgressValues((prev) => {
      const cur = prev[key] || 0
      const next = Math.max(0, cur + delta)
      const clamped = max && max > 0 ? Math.min(next, max) : next

      // Auto-complete status if increment field reaches max
      if (key === media?.incrementFieldKey && max && max > 0 && clamped >= max) {
        setStatus("COMPLETED")
        if (!completedAt) {
          setCompletedAt(new Date().toISOString().slice(0, 10))
        }
      }

      return {
        ...prev,
        [key]: clamped,
      }
    })
  }

  // Save entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otherId) return

    setIsSaving(true)

    try {
      let notesToSave = notes.trim() || null
      if (notesToSave && vaultKey) {
        notesToSave = safeEncryptText(notesToSave, vaultKey)
      }

      const incKey = media?.incrementFieldKey || "progress"
      const incProg = progressValues[incKey] ?? 0

      const payload = {
        status,
        progress: incProg,
        progressValues,
        score: score !== null ? Number(score) : null,
        notes: notesToSave,
        private: isPrivate,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        completedAt: completedAt ? new Date(completedAt).toISOString() : null,
      }

      const { data, error } = await elysia.borealis.lists
        .other({ otherId })
        .post(payload)

      if (error || !data?.success) {
        throw new Error((error as any)?.value?.detail || "Failed to save entry")
      }

      toast.success("List entry updated")
      onItemUpdated?.(entry.id, {
        ...entry,
        ...payload,
        updatedAt: new Date().toISOString(),
      })
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save entry")
    } finally {
      setIsSaving(false)
    }
  }

  // Remove from list
  const handleDeleteEntry = async () => {
    if (!otherId || !entry?.id) return
    setIsDeletingEntry(true)

    try {
      const { data, error } = await elysia.borealis.lists
        .other({ otherId })
        .delete()

      if (error || !data?.success) {
        throw new Error((error as any)?.value?.detail || "Failed to remove entry")
      }

      toast.success("Removed from your list")
      onItemUpdated?.(entry.id, null)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to remove entry")
    } finally {
      setIsDeletingEntry(false)
    }
  }

  // Fork snapshot
  const handleForkSnapshot = async () => {
    if (!otherId) return
    setIsForking(true)

    try {
      const { data, error } = await elysia.borealis.other({ otherId }).fork.post()
      if (error || !data?.success) {
        throw new Error((error as any)?.value?.detail || "Failed to fork item")
      }

      toast.success("Snapshot forked to your personal catalog")
      if (data.entry && onItemUpdated) {
        onItemUpdated(entry.id, data.entry)
      }
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to fork item snapshot")
    } finally {
      setIsForking(false)
    }
  }

  // Delete item from catalog (strict integrity check)
  const handleDeleteCatalogItem = async () => {
    if (!otherId) return
    if (!confirm("Are you sure you want to permanently delete this item from the catalog? If other users track it, deletion will be blocked.")) {
      return
    }

    setIsDeletingCatalogItem(true)

    try {
      const { data, error } = await elysia.borealis.other({ otherId }).delete()
      if (error || !data?.success) {
        const errorDetail =
          (error as any)?.value?.detail ||
          (error as any)?.value?.message ||
          "Cannot delete item: other users are currently tracking or have favorited it."
        throw new Error(errorDetail)
      }

      toast.success("Item deleted from catalog")
      onItemDeleted?.(entry?.id || otherId)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete item")
    } finally {
      setIsDeletingCatalogItem(false)
    }
  }

  if (!item) return null

  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {/* Header Banner & Title */}
          <div className="relative -mx-6 -mt-6 overflow-hidden rounded-t-2xl border-b border-border/40 bg-muted/30">
            {media?.bannerImage ? (
              <div
                className="h-28 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${media.bannerImage})` }}
              />
            ) : (
              <div className="h-16 w-full bg-gradient-to-r from-muted/50 via-muted/20 to-muted/50" />
            )}

            <div className="flex gap-4 p-4">
              {/* Cover thumbnail */}
              <div className="relative -mt-10 size-20 shrink-0 overflow-hidden rounded-xl border-2 border-background bg-muted shadow-md">
                {media?.coverImage ? (
                  <img
                    src={media.coverImage}
                    alt={media.titlePrimary || "Cover"}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <IconPhotoOff className="size-6" />
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {media?.titlePrimary || "Untitled Custom Item"}
                  </h3>
                  <Link
                    href={`/borealis/other/${otherId}`}
                    title="View item page"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <IconExternalLink className="size-3.5" />
                  </Link>
                </div>
                {media?.titleSecondary && (
                  <p className="text-xs text-muted-foreground truncate">
                    {media.titleSecondary}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant={media?.isPublished ? "default" : "secondary"} className="text-[10px] py-0 px-1.5">
                    {media?.isPublished ? "Public" : "Private"}
                  </Badge>
                  {isCreator && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/40 text-primary">
                      Creator
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pre-update snapshot warning for non-creators */}
          {hasSnapshot && !isCreator && (
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-amber-500">
                <IconAlertTriangle className="size-4 shrink-0" />
                <span>Original Snapshot Available</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The creator updated this item after you added it. You can fork the original version into your private catalog.
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isForking}
                  onPress={handleForkSnapshot}
                  className="gap-1.5 rounded-xl border-amber-500/40 text-amber-500 hover:bg-amber-500/10 text-xs"
                >
                  {isForking ? <Spinner className="size-3" /> : <IconGitFork className="size-3.5" />}
                  <span>Fork Snapshot to My Items</span>
                </Button>
              </div>
            </div>
          )}

          {/* Creator catalog options */}
          {isCreator && (
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground text-[11px]">
                You are the creator of this catalog item.
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onPress={() => setIsEditDialogOpen(true)}
                  className="h-7 gap-1 rounded-lg text-xs"
                >
                  <IconEdit className="size-3" />
                  <span>Edit Item</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isDeletingCatalogItem}
                  onPress={handleDeleteCatalogItem}
                  className="h-7 gap-1 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                >
                  {isDeletingCatalogItem ? (
                    <Spinner className="size-3" />
                  ) : (
                    <IconTrash className="size-3" />
                  )}
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSaveEntry} className="space-y-4 pt-1">
            {/* Status Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((opt: any) => {
                  const isSelected = status === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setStatus(opt.key)}
                      className={cn(
                        "rounded-xl border px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Dynamic Progress Fields */}
            <div className="space-y-2.5 rounded-2xl border border-border/40 bg-muted/10 p-3">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Progress
              </Label>
              <div className="space-y-2">
                {progressFields.map((field) => {
                  const currentVal = progressValues[field.key] ?? 0
                  const hasMax = typeof field.max === "number" && field.max > 0
                  const isIncTarget = field.key === media?.incrementFieldKey

                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/50 p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground truncate">
                            {field.label}
                          </span>
                          {isIncTarget && (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                              +1 Target
                            </Badge>
                          )}
                        </div>
                        {hasMax && (
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{
                                width: `${Math.min(100, (currentVal / field.max!) * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Stepper & input */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          onPress={() => handleDeltaProgress(field.key, -1, field.max)}
                          disabled={currentVal <= 0}
                          className="size-7 rounded-lg text-xs"
                        >
                          -1
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          max={field.max ?? undefined}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            const clamped = field.max ? Math.min(val, field.max) : val
                            setProgressValues((prev) => ({
                              ...prev,
                              [field.key]: clamped,
                            }))
                          }}
                          className="h-7 w-16 text-center text-xs px-1"
                        />
                        {hasMax && (
                          <span className="text-[11px] text-muted-foreground">
                            / {field.max}
                          </span>
                        )}
                        {field.unit && (
                          <span className="text-[11px] text-muted-foreground ps-0.5">
                            {field.unit}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          onPress={() => handleDeltaProgress(field.key, 1, field.max)}
                          disabled={Boolean(field.max && currentVal >= field.max)}
                          className="size-7 rounded-lg text-xs"
                        >
                          +1
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Score & Dates */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Score */}
              <div className="space-y-1.5">
                <Label htmlFor="entryScore" className="text-xs font-medium">
                  Score (1-10)
                </Label>
                <div className="relative">
                  <IconStar className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="entryScore"
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    placeholder="-"
                    value={score ?? ""}
                    onChange={(e) =>
                      setScore(e.target.value ? Number(e.target.value) : null)
                    }
                    className="h-9 ps-8 text-xs"
                  />
                </div>
              </div>

              {/* Started Date */}
              <div className="space-y-1.5">
                <Label htmlFor="startedAt" className="text-xs font-medium">
                  Started Date
                </Label>
                <Input
                  id="startedAt"
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Completed Date */}
              <div className="space-y-1.5">
                <Label htmlFor="completedAt" className="text-xs font-medium">
                  Completed Date
                </Label>
                <Input
                  id="completedAt"
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="entryNotes" className="text-xs font-medium">
                  Notes
                </Label>
                {isVaultActive && (
                  <Badge variant="outline" className="text-[10px] py-0 gap-1 border-primary/30 text-primary">
                    <IconLock className="size-2.5" />
                    <span>Encrypted with Vault</span>
                  </Badge>
                )}
              </div>
              <Textarea
                id="entryNotes"
                placeholder="Personal thoughts, tracking logs, review..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            {/* Privacy switch */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="privacyToggle" className="text-xs font-medium cursor-pointer">
                  Private Entry
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Hide this tracking entry from your public profile list.
                </p>
              </div>
              <Switch
                id="privacyToggle"
                isSelected={isPrivate}
                onChange={setIsPrivate}
              />
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between pt-2">
              {entry?.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDeletingEntry}
                  onPress={handleDeleteEntry}
                  className="h-9 gap-1.5 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                >
                  {isDeletingEntry ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <IconTrash className="size-3.5" />
                  )}
                  <span>Remove</span>
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onPress={() => onOpenChange(false)}
                  className="h-9 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  {isSaving ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <IconCheck className="size-3.5" />
                  )}
                  <span>Save</span>
                </Button>
              </div>
            </DialogFooter>
          </form>
      </Dialog>

      {/* Edit Catalog Item Dialog for Creator */}
      {isCreator && (
        <CreateOtherItemDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          initialData={media as OtherCatalogItem}
          onSuccess={(updated) => {
            // Update local state if needed
            if (item) {
              item.media = {
                ...item.media,
                ...updated,
              }
            }
          }}
        />
      )}
    </>
  )
}
