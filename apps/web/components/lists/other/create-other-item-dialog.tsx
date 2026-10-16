"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  IconPlus,
  IconTrash,
  IconUpload,
  IconPhoto,
  IconCalendar,
  IconSparkles,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconWorld,
  IconLock,
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

export interface ProgressFieldDef {
  key: string
  label: string
  unit?: string | null
  max?: number | null
}

export interface StatusOptionDef {
  key: string
  label: string
  isCompleted?: boolean
}

export interface OtherCatalogItem {
  id: number
  creatorId: string
  titlePrimary: string
  titleSecondary?: string | null
  description?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  format?: string | null
  startDate?: string | null
  endDate?: string | null
  isPublished?: boolean
  progressFields: ProgressFieldDef[]
  incrementFieldKey: string
  statuses?: StatusOptionDef[] | null
}

export interface CreateOtherItemDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialData?: OtherCatalogItem | null
  onSuccess?: (item: OtherCatalogItem) => void
}

const DEFAULT_STATUSES: StatusOptionDef[] = [
  { key: "TRACKING", label: "Tracking", isCompleted: false },
  { key: "PLANNING", label: "Planning", isCompleted: false },
  { key: "COMPLETED", label: "Completed", isCompleted: true },
  { key: "ON_HOLD", label: "On Hold", isCompleted: false },
  { key: "DROPPED", label: "Dropped", isCompleted: false },
]

export const PRESET_FORMATS = [
  { key: "app", label: "App" },
  { key: "activity", label: "Activity" },
  { key: "course", label: "Course" },
  { key: "habit", label: "Habit" },
  { key: "workout", label: "Workout" },
  { key: "project", label: "Project" },
  { key: "podcast", label: "Podcast" },
  { key: "other", label: "Other" },
] as const

export function CreateOtherItemDialog({
  isOpen,
  onOpenChange,
  initialData,
  onSuccess,
}: CreateOtherItemDialogProps): React.JSX.Element {
  const isEditing = Boolean(initialData?.id)

  const [titlePrimary, setTitlePrimary] = useState("")
  const [titleSecondary, setTitleSecondary] = useState("")
  const [description, setDescription] = useState("")
  const [coverImage, setCoverImage] = useState("")
  const [bannerImage, setBannerImage] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedFormat, setSelectedFormat] = useState<string>("other")
  const [customFormat, setCustomFormat] = useState<string>("")
  const [isPublished, setIsPublished] = useState(false)
  const [addToListImmediately, setAddToListImmediately] = useState(true)

  const [progressFields, setProgressFields] = useState<ProgressFieldDef[]>([
    { key: "progress", label: "Progress", unit: "units", max: null },
  ])
  const [incrementFieldKey, setIncrementFieldKey] = useState("progress")

  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)

  // Initialize or reset form state
  useEffect(() => {
    if (initialData) {
      setTitlePrimary(initialData.titlePrimary || "")
      setTitleSecondary(initialData.titleSecondary || "")
      setDescription(initialData.description || "")
      setCoverImage(initialData.coverImage || "")
      setBannerImage(initialData.bannerImage || "")
      setStartDate(
        initialData.startDate
          ? new Date(initialData.startDate).toISOString().slice(0, 10)
          : ""
      )
      setEndDate(
        initialData.endDate
          ? new Date(initialData.endDate).toISOString().slice(0, 10)
          : ""
      )
      if (initialData.format) {
        const norm = initialData.format.trim().toLowerCase()
        const isPreset = PRESET_FORMATS.some((p) => p.key === norm)
        if (isPreset) {
          setSelectedFormat(norm)
          setCustomFormat("")
        } else {
          setSelectedFormat("custom")
          setCustomFormat(initialData.format)
        }
      } else {
        setSelectedFormat("other")
        setCustomFormat("")
      }
      setIsPublished(Boolean(initialData.isPublished))
      setProgressFields(
        Array.isArray(initialData.progressFields) &&
          initialData.progressFields.length > 0
          ? initialData.progressFields
          : [{ key: "progress", label: "Progress", unit: "units", max: null }]
      )
      setIncrementFieldKey(initialData.incrementFieldKey || "progress")
    } else {
      setTitlePrimary("")
      setTitleSecondary("")
      setDescription("")
      setCoverImage("")
      setBannerImage("")
      setStartDate("")
      setEndDate("")
      setSelectedFormat("other")
      setCustomFormat("")
      setIsPublished(false)
      setAddToListImmediately(true)
      setProgressFields([
        { key: "progress", label: "Progress", unit: "units", max: null },
      ])
      setIncrementFieldKey("progress")
    }
  }, [initialData, isOpen])

  // Handle image upload helper (WebP conversion via Elysia endpoint)
  const handleUploadFile = async (
    file: File,
    type: "cover" | "banner"
  ) => {
    if (file.size > 1024 * 1024) {
      toast.error("Image file size must be 1MB or less")
      return
    }

    if (type === "cover") setIsUploadingCover(true)
    else setIsUploadingBanner(true)

    try {
      const res = await elysia.borealis.other.upload.post({
        file,
        type,
      })

      if (res.error || !res.data?.url) {
        throw new Error(res.error?.value?.detail || "Upload failed")
      }

      if (type === "cover") {
        setCoverImage(res.data.url)
      } else {
        setBannerImage(res.data.url)
      }
      toast.success(`${type === "cover" ? "Cover" : "Banner"} uploaded successfully`)
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image")
    } finally {
      if (type === "cover") setIsUploadingCover(false)
      else setIsUploadingBanner(false)
    }
  }

  // Add progress field
  const handleAddProgressField = () => {
    const nextIdx = progressFields.length + 1
    const newKey = `field_${Date.now()}`
    setProgressFields((prev) => [
      ...prev,
      { key: newKey, label: `Field ${nextIdx}`, unit: "", max: null },
    ])
  }

  // Remove progress field
  const handleRemoveProgressField = (index: number) => {
    if (progressFields.length <= 1) {
      toast.error("At least one progress field is required")
      return
    }
    const removed = progressFields[index]
    const nextFields = progressFields.filter((_, i) => i !== index)
    setProgressFields(nextFields)
    if (removed && incrementFieldKey === removed.key && nextFields.length > 0 && nextFields[0]) {
      setIncrementFieldKey(nextFields[0].key)
    }
  }

  // Update progress field
  const handleUpdateProgressField = (
    index: number,
    patch: Partial<ProgressFieldDef>
  ) => {
    setProgressFields((prev) =>
      prev.map((f, i) => {
        if (i === index) {
          const updated = { ...f, ...patch }
          // If label changed and key was default/empty, auto-slugify key
          if (patch.label && (!f.key || f.key.startsWith("field_"))) {
            const slug = patch.label
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "_")
              .replace(/^_+|_+$/g, "")
            if (slug) {
              if (incrementFieldKey === f.key) {
                setIncrementFieldKey(slug)
              }
              updated.key = slug
            }
          }
          return updated
        }
        return f
      })
    )
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanTitle = titlePrimary.trim()
    if (!cleanTitle) {
      toast.error("Title is required")
      return
    }

    if (progressFields.length === 0) {
      toast.error("At least one progress field is required")
      return
    }

    // Verify all progress fields have keys and labels
    for (const f of progressFields) {
      if (!f.key.trim() || !f.label.trim()) {
        toast.error("All progress fields must have a name/label")
        return
      }
    }

    // Ensure incrementFieldKey points to a valid field key
    const validIncKey = progressFields.some((f) => f.key === incrementFieldKey)
      ? incrementFieldKey
      : progressFields[0]?.key || "progress"

    setIsSubmitting(true)

    try {
      const resolvedFormat =
        selectedFormat === "custom"
          ? customFormat.trim().toLowerCase() || null
          : selectedFormat.trim().toLowerCase() || null

      const payload = {
        titlePrimary: cleanTitle,
        titleSecondary: titleSecondary.trim() || null,
        description: description.trim() || null,
        coverImage: coverImage.trim() || null,
        bannerImage: bannerImage.trim() || null,
        format: resolvedFormat,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        isPublished,
        progressFields: progressFields.map((f) => ({
          key: f.key.trim(),
          label: f.label.trim(),
          unit: f.unit?.trim() || null,
          max: f.max && f.max > 0 ? Number(f.max) : null,
        })),
        incrementFieldKey: validIncKey,
        statuses: DEFAULT_STATUSES,
      }

      if (isEditing && initialData?.id) {
        const { data, error } = await elysia.borealis.other({
          otherId: initialData.id,
        }).put(payload)

        if (error || !data?.success) {
          throw new Error(
            (error as any)?.value?.detail || "Failed to update item"
          )
        }

        toast.success("Custom item updated successfully")
        onSuccess?.(data.item)
        onOpenChange(false)
      } else {
        const { data, error } = await elysia.borealis.other.post(payload)

        if (error || !data?.success) {
          throw new Error(
            (error as any)?.value?.detail || "Failed to create item"
          )
        }

        const createdItem = data.item

        // Automatically add to user's list if requested
        if (addToListImmediately && createdItem?.id) {
          try {
            await elysia.borealis.lists.other({
              otherId: createdItem.id,
            }).post({
              status: "TRACKING",
              progress: 0,
            })
          } catch {
            // Ignore if adding to list fails; item was created
          }
        }

        toast.success("Custom item created successfully")
        onSuccess?.(createdItem)
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save custom item")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconSparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEditing ? "Edit Custom Item" : "Create Custom Item"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Track any hobby, habit, project, or custom media category.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Section 1: Basic Information */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
            <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Basic Information
            </h4>

            <div className="space-y-1.5">
              <Label htmlFor="titlePrimary" className="text-xs font-medium">
                Primary Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titlePrimary"
                placeholder="e.g. Solo Leveling Webnovel, Warhammer Army, Spanish Duolingo"
                value={titlePrimary}
                onChange={(e) => setTitlePrimary(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="titleSecondary" className="text-xs font-medium">
                Secondary / Alternative Title (Optional)
              </Label>
              <Input
                id="titleSecondary"
                placeholder="e.g. English title, original language name, or subtitle"
                value={titleSecondary}
                onChange={(e) => setTitleSecondary(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Format</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_FORMATS.map((p) => {
                  const isSelected = selectedFormat === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setSelectedFormat(p.key)
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat("custom")
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedFormat === "custom"
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Custom...
                </button>
              </div>

              {selectedFormat === "custom" && (
                <div className="pt-1">
                  <Input
                    placeholder="e.g. Manga, Novel, Certification, Language..."
                    value={customFormat}
                    onChange={(e) => setCustomFormat(e.target.value)}
                    className="h-8 text-xs max-w-sm"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Describe this item, outline objectives, tracking rules, or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs resize-none"
              />
            </div>
          </div>

          {/* Section 2: Artwork & Imagery */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Artwork & Images
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Uploads max 1MB (converted to WebP)
              </span>
            </div>

            {/* Cover Image Input */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Cover Image</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste image URL (https://...)"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className="h-9 text-xs flex-1"
                />
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUploadFile(f, "cover")
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingCover}
                  onPress={() => coverInputRef.current?.click()}
                  className="h-9 shrink-0 gap-1.5 rounded-xl px-3 text-xs"
                >
                  {isUploadingCover ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <IconUpload className="size-3.5" />
                  )}
                  <span>Upload</span>
                </Button>
                {coverImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onPress={() => setCoverImage("")}
                    className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <IconX className="size-4" />
                  </Button>
                )}
              </div>
              {coverImage && (
                <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-2">
                  <img
                    src={coverImage}
                    alt="Cover preview"
                    className="size-12 rounded-lg object-cover"
                  />
                  <span className="text-[11px] text-muted-foreground truncate">
                    {coverImage}
                  </span>
                </div>
              )}
            </div>

            {/* Banner Image Input */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Banner Image (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste banner URL (https://...)"
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  className="h-9 text-xs flex-1"
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUploadFile(f, "banner")
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingBanner}
                  onPress={() => bannerInputRef.current?.click()}
                  className="h-9 shrink-0 gap-1.5 rounded-xl px-3 text-xs"
                >
                  {isUploadingBanner ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <IconUpload className="size-3.5" />
                  )}
                  <span>Upload</span>
                </Button>
                {bannerImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onPress={() => setBannerImage("")}
                    className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <IconX className="size-4" />
                  </Button>
                )}
              </div>
              {bannerImage && (
                <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-2">
                  <img
                    src={bannerImage}
                    alt="Banner preview"
                    className="h-12 w-28 rounded-lg object-cover"
                  />
                  <span className="text-[11px] text-muted-foreground truncate">
                    {bannerImage}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Start and End Dates (Mandatory on Models) */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
            <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Schedule & Timeline
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs font-medium">
                  Start Date (Optional)
                </Label>
                <div className="relative">
                  <IconCalendar className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 ps-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium">
                  End Date (Optional)
                </Label>
                <div className="relative">
                  <IconCalendar className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 ps-9 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Dynamic Progress Fields & Quick Increment Selector */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Progress Fields & Increment Target
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Select which single field increments when clicking the +1 quick button.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onPress={handleAddProgressField}
                className="gap-1 rounded-xl text-xs"
              >
                <IconPlus className="size-3" />
                <span>Add Field</span>
              </Button>
            </div>

            <div className="space-y-2">
              {progressFields.map((field, idx) => {
                const isIncrementTarget = incrementFieldKey === field.key
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center sm:gap-3 transition-colors",
                      isIncrementTarget
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/40 bg-background/50"
                    )}
                  >
                    {/* Radio selector for increment target */}
                    <button
                      type="button"
                      onClick={() => setIncrementFieldKey(field.key)}
                      title="Select as quick increment (+1) target"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    >
                      <div
                        className={cn(
                          "size-4 rounded-full border flex items-center justify-center transition-colors",
                          isIncrementTarget
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background"
                        )}
                      >
                        {isIncrementTarget && <IconCheck className="size-2.5" />}
                      </div>
                      <span className="font-medium text-[11px] sm:hidden">
                        Increment Target
                      </span>
                    </button>

                    {/* Field Label */}
                    <div className="flex-1">
                      <Input
                        placeholder="Field name (e.g. Episodes, Pages, Bosses)"
                        value={field.label}
                        onChange={(e) =>
                          handleUpdateProgressField(idx, { label: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Unit */}
                    <div className="w-24 shrink-0">
                      <Input
                        placeholder="Unit (ep, ch)"
                        value={field.unit || ""}
                        onChange={(e) =>
                          handleUpdateProgressField(idx, { unit: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Max */}
                    <div className="w-24 shrink-0">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Max (opt)"
                        value={field.max ?? ""}
                        onChange={(e) =>
                          handleUpdateProgressField(idx, {
                            max: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Delete button */}
                    {progressFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onPress={() => handleRemoveProgressField(idx)}
                        className="size-8 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground ps-1">
              <span className="font-semibold text-foreground">Current Increment Target (+1):</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                {progressFields.find((f) => f.key === incrementFieldKey)?.label ||
                  incrementFieldKey}
              </Badge>
            </div>
          </div>

          {/* Section 5: Discoverability & Tracking Options */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
            <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Publishing & Catalog Options
            </h4>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="publishToggle" className="text-xs font-medium cursor-pointer">
                    Publish to Public Search
                  </Label>
                  <Badge variant={isPublished ? "default" : "outline"} className="text-[10px] py-0">
                    {isPublished ? "Public" : "Private Item"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Allow other Borealis users to discover, browse, and track this custom item.
                </p>
              </div>
              <Switch
                id="publishToggle"
                isSelected={isPublished}
                onChange={setIsPublished}
              />
            </div>

            {!isEditing && (
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/30">
                <div className="space-y-0.5">
                  <Label htmlFor="addToListToggle" className="text-xs font-medium cursor-pointer">
                    Add to my Other List immediately
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically starts tracking this item in your personal list with status Current.
                  </p>
                </div>
                <Switch
                  id="addToListToggle"
                  isSelected={addToListImmediately}
                  onChange={setAddToListImmediately}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={isSubmitting}
              className="h-9 gap-1.5 rounded-xl text-xs"
            >
              {isSubmitting ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconCheck className="size-3.5" />
              )}
              <span>{isEditing ? "Save Changes" : "Create Item"}</span>
            </Button>
          </DialogFooter>
        </form>
    </Dialog>
  )
}
