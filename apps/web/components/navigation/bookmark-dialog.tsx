"use client"

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import {
  IconPin,
  IconCheck,
  IconColorPicker,
  IconTrash,
  IconFolder,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import {
  BOOKMARK_ICON_OPTIONS,
  BOOKMARK_COLOR_PRESETS,
  renderBookmarkIcon,
  type BookmarkIconOption,
} from "@/config/bookmark-icons"
import { useIrisApps, renderIrisAppIcon, type IrisApp } from "@/config/irisApps"
import { type UserBookmark } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

export interface BookmarkDialogProps {
  isOpen: boolean
  onClose: () => void
  bookmark?: UserBookmark | null
  existingGroups?: string[]
  defaultAppId?: string
  defaultAppColor?: string
  defaultTitle?: string
  defaultUrl?: string
  onSave: (data: {
    id?: string
    title: string
    url: string
    icon?: string
    color?: string
    pinned?: boolean
    appId?: string
    group?: string
  }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function BookmarkDialog({
  isOpen,
  onClose,
  bookmark,
  existingGroups = [],
  defaultAppId,
  defaultAppColor,
  defaultTitle,
  defaultUrl,
  onSave,
  onDelete,
}: BookmarkDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.appMenu")
  const irisApps = useIrisApps()

  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<string>("bookmark")
  const [selectedColor, setSelectedColor] = useState<string>("#6366f1")
  const [isPinned, setIsPinned] = useState(false)
  const [selectedAppId, setSelectedAppId] = useState<string>("")
  const [selectedGroup, setSelectedGroup] = useState<string>("")
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false)
  const [isCustomColor, setIsCustomColor] = useState(false)
  const [customColorVal, setCustomColorVal] = useState("#6366f1")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setIsSubmitting(false)
      setIsDeleting(false)
      if (bookmark) {
        // Edit mode
        setTitle(bookmark.title || "")
        setUrl(bookmark.url || "")
        setSelectedIcon(bookmark.icon || "bookmark")
        setSelectedColor(bookmark.color || defaultAppColor || "#6366f1")
        setIsPinned(Boolean(bookmark.pinned))
        setSelectedAppId(bookmark.appId || defaultAppId || "")
        setSelectedGroup(bookmark.group || "")
        setIsCreatingNewGroup(false)

        const isPreset = BOOKMARK_COLOR_PRESETS.some(
          (p) => p.value.toLowerCase() === (bookmark.color || "").toLowerCase()
        )
        if (!isPreset && bookmark.color) {
          setIsCustomColor(true)
          setCustomColorVal(bookmark.color)
        } else {
          setIsCustomColor(false)
        }
      } else {
        // Add mode: default icon from active app, color from active app, page title, current URL
        const initialAppIcon = defaultAppId
          ? defaultAppId.startsWith("app:")
            ? defaultAppId
            : `app:${defaultAppId}`
          : "bookmark"
        const initialFullUrl =
          defaultUrl ||
          (typeof window !== "undefined" ? window.location.href : "/")

        const initialColor = defaultAppColor || "#6366f1"

        setTitle(defaultTitle || "")
        setUrl(initialFullUrl)
        setSelectedIcon(initialAppIcon)
        setSelectedColor(initialColor)
        setIsPinned(false)
        setSelectedAppId(defaultAppId || "")
        setSelectedGroup("")
        setIsCreatingNewGroup(false)
        setIsCustomColor(false)
        setCustomColorVal(initialColor)
      }
    }
  }, [isOpen, bookmark, defaultAppId, defaultAppColor, defaultTitle, defaultUrl])

  const handleColorSelect = (colorValue: string) => {
    setSelectedColor(colorValue)
    setIsCustomColor(false)
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCustomColorVal(val)
    setSelectedColor(val)
    setIsCustomColor(true)
  }

  const sanitizedGroups = React.useMemo(() => {
    const set = new Set<string>()
    existingGroups.forEach((g) => {
      if (g && typeof g === "string" && g.trim()) {
        set.add(g.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [existingGroups])

  const handleGroupChipClick = (grp: string) => {
    if (grp === "__new__") {
      setIsCreatingNewGroup(true)
      setSelectedGroup("")
    } else {
      setIsCreatingNewGroup(false)
      setSelectedGroup(grp)
    }
  }

  const handleDelete = async () => {
    if (!bookmark?.id || !onDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await onDelete(bookmark.id)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete bookmark")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim()) {
      setError(t("bookmarkTitlePlaceholder"))
      return
    }
    if (!url.trim()) {
      setError(t("bookmarkUrlPlaceholder"))
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        id: bookmark?.id,
        title: title.trim(),
        url: url.trim(),
        icon: selectedIcon,
        color: selectedColor,
        pinned: isPinned,
        appId: selectedAppId || undefined,
        group: selectedGroup.trim() || undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save bookmark")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting && !isDeleting) onClose()
      }}
      className="w-full max-w-lg overflow-hidden p-5 sm:p-6"
    >
      <DialogHeader>
        <DialogTitle className="font-heading text-lg font-semibold tracking-tight">
          {bookmark ? t("editBookmark") : t("newBookmark")}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex min-w-0 max-w-full flex-col gap-3 pt-1 overflow-hidden">
        {/* Live Preview & Pin Toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex size-10 shrink-0 items-center justify-center transition-all"
              style={{
                color: selectedColor,
              }}
            >
              {renderBookmarkIcon(selectedIcon, "size-7", { color: selectedColor })}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-foreground">
                {title || t("bookmarkTitlePlaceholder")}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {url || t("bookmarkUrlPlaceholder")}
              </span>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {selectedGroup && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <IconFolder className="size-2.5" />
                    {selectedGroup}
                  </span>
                )}
                {isPinned && (
                  <div className="flex items-center gap-1 text-[10px] font-medium text-rose-500">
                    <IconPin className="size-2.5" />
                    <span>{t("pinned")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{t("pinToTop")}</span>
            <Switch
              isSelected={isPinned}
              onChange={setIsPinned}
              aria-label={t("pinToTop")}
            />
          </div>
        </div>

        {/* Title & URL Inputs (2-col grid on sm screens to save vertical space) */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {t("bookmarkTitle")} <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("bookmarkTitlePlaceholder")}
              required
              className="h-8.5 rounded-xl bg-muted/40 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {t("bookmarkUrl")} <span className="text-destructive">*</span>
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("bookmarkUrlPlaceholder")}
              required
              className="h-8.5 rounded-xl bg-muted/40 text-xs"
            />
          </div>
        </div>

        {/* Group Selection & Creation */}
        <div className="flex min-w-0 max-w-full flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">
              {t("bookmarkGroup")}
            </label>
            {selectedGroup && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup("")
                  setIsCreatingNewGroup(false)
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {t("ungrouped")}
              </button>
            )}
          </div>

          {/* Group Chips Track */}
          <div className="no-scrollbar flex w-full min-w-0 max-w-full touch-pan-x items-center gap-1.5 overflow-x-auto whitespace-nowrap scroll-smooth py-0.5 px-0.5">
            <button
              type="button"
              onClick={() => handleGroupChipClick("")}
              className={cn(
                "shrink-0 cursor-pointer rounded-xl px-2.5 py-1 text-xs font-medium transition-colors",
                !selectedGroup && !isCreatingNewGroup
                  ? "border border-primary bg-primary/15 text-primary"
                  : "border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              {t("ungrouped")}
            </button>

            {sanitizedGroups.map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => handleGroupChipClick(grp)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedGroup === grp && !isCreatingNewGroup
                    ? "border border-primary bg-primary/15 text-primary"
                    : "border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/70"
                )}
              >
                <IconFolder className="size-3" />
                <span>{grp}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleGroupChipClick("__new__")}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-dashed px-2.5 py-1 text-xs font-medium transition-colors",
                isCreatingNewGroup
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              <IconPlus className="size-3" />
              <span>{t("newGroup")}</span>
            </button>
          </div>

          {/* New Group Input Field (or manual edit) */}
          {(isCreatingNewGroup || (selectedGroup && !sanitizedGroups.includes(selectedGroup))) && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Input
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                placeholder={t("groupPlaceholder")}
                autoFocus
                className="h-8 rounded-xl bg-muted/40 text-xs flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewGroup(false)
                  setSelectedGroup("")
                }}
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={t("cancel")}
              >
                <IconX className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Associated App Selector */}
        <div className="flex min-w-0 max-w-full flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            {t("associatedApp")}
          </label>
          <div className="no-scrollbar flex w-full min-w-0 max-w-full touch-pan-x items-center gap-1.5 overflow-x-auto whitespace-nowrap scroll-smooth py-0.5 px-0.5">
            {irisApps.map((app) => {
              const isSelected = selectedAppId === app.id
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedAppId(app.id)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors",
                    isSelected
                      ? "border border-primary bg-primary/15 text-primary"
                      : "border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  <div className="size-3.5 shrink-0">
                    {renderIrisAppIcon(app, "size-3.5")}
                  </div>
                  <span>{app.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Color Picker */}
        <div className="flex min-w-0 max-w-full flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            {t("bookmarkColor")}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {BOOKMARK_COLOR_PRESETS.map((preset) => {
              const isSelected =
                !isCustomColor &&
                selectedColor.toLowerCase() === preset.value.toLowerCase()
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleColorSelect(preset.value)}
                  style={{ backgroundColor: preset.value }}
                  className={cn(
                    "flex size-6 cursor-pointer items-center justify-center rounded-full transition-all hover:scale-110 shadow-xs",
                    isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                  title={preset.name}
                >
                  {isSelected && <IconCheck className="size-3 text-white drop-shadow-xs" />}
                </button>
              )
            })}

            {/* Custom Color Input */}
            <label
              className={cn(
                "relative flex size-6 cursor-pointer items-center justify-center rounded-full border border-border bg-muted/50 transition-all hover:scale-110",
                isCustomColor && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
              )}
              title="Custom Color"
            >
              <IconColorPicker className="size-3 text-muted-foreground" />
              <input
                type="color"
                value={customColorVal}
                onChange={handleCustomColorChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        {/* Icon Picker */}
        <div className="flex min-w-0 max-w-full flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            {t("bookmarkIcon")}
          </label>
          <div
            className="max-h-24 w-full overflow-y-auto rounded-2xl border border-border/50 bg-muted/20 p-2 scrollbar-thin scrollbar-thumb-border"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))",
              gap: "6px",
            }}
          >
            {BOOKMARK_ICON_OPTIONS.map((opt: BookmarkIconOption) => {
              const isSelected = selectedIcon === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedIcon(opt.id)}
                  className={cn(
                    "flex size-8.5 w-full cursor-pointer items-center justify-center rounded-xl transition-all hover:bg-muted/80",
                    isSelected
                      ? "border border-primary bg-primary/15 text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={opt.label}
                >
                  {renderBookmarkIcon(opt.id, "size-4.5")}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-1 sm:justify-between">
          {bookmark?.id && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
              className="rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            >
              <IconTrash className="size-4" />
              <span>{t("deleteBookmark")}</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="rounded-2xl cursor-pointer"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isDeleting}
              className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              {isSubmitting ? "..." : t("save")}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

