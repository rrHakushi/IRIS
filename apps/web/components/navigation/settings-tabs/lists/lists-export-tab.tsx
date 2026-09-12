"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import type { SettingsTabProps } from "../types"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad2,
  IconHeadphones,
  IconPlaylist,
  IconDownload,
  IconLink,
  IconCopy,
  IconCheck,
  IconTrash,
  IconKey,
  IconClock,
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconFileCode,
  IconFileTypeXml,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { elysia, API_URL } from "@/lib/elysia"

interface MediaTypeOption {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  malSupported: boolean
}

const MEDIA_TYPES: MediaTypeOption[] = [
  { id: "anime", label: "Anime", icon: IconDeviceTv, malSupported: true },
  { id: "manga", label: "Manga", icon: IconBook, malSupported: true },
  { id: "tv", label: "TV Shows", icon: IconDeviceTv, malSupported: false },
  { id: "movie", label: "Movies", icon: IconMovie, malSupported: false },
  { id: "game", label: "Games", icon: IconDeviceGamepad2, malSupported: false },
  { id: "book", label: "Books", icon: IconBook, malSupported: false },
  { id: "music", label: "Music", icon: IconHeadphones, malSupported: false },
  {
    id: "custom_lists",
    label: "Custom Lists",
    icon: IconPlaylist,
    malSupported: false,
  },
]

interface ExportShareItem {
  id: string
  description: string | null
  mediaTypes: string[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  isExpired: boolean
}

export function ListsExportSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const { data: session } = useSession()
  const username = session?.user?.username

  // Export options
  const [selectedFormat, setSelectedFormat] = useState<"iris-json" | "mal-xml">(
    "iris-json"
  )
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    MEDIA_TYPES.map((m) => m.id)
  )
  const [isExporting, setIsExporting] = useState(false)

  // Share URL options
  const [shares, setShares] = useState<ExportShareItem[]>([])
  const [isLoadingShares, setIsLoadingShares] = useState(false)
  const [sharePassword, setSharePassword] = useState("")
  const [showSharePassword, setShowSharePassword] = useState(false)
  const [shareExpiresIn, setShareExpiresIn] = useState<number | null>(null)
  const [shareDescription, setShareDescription] = useState("")
  const [isCreatingShare, setIsCreatingShare] = useState(false)
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null)

  // Fetch active shares
  const fetchShares = useCallback(async () => {
    if (!username) return
    setIsLoadingShares(true)
    try {
      const { data, error } = await elysia
        .user({ username })
        .lists.export.shares.get({
          fetch: { credentials: "include" },
        })

      if (!error && data?.success && Array.isArray(data.shares)) {
        setShares(data.shares as ExportShareItem[])
      }
    } catch (err) {
      console.error("Failed to load export shares:", err)
    } finally {
      setIsLoadingShares(false)
    }
  }, [username])

  useEffect(() => {
    fetchShares()
  }, [fetchShares])

  // When format switches to MAL XML, constrain selection to Anime & Manga
  const handleFormatChange = (format: "iris-json" | "mal-xml") => {
    setSelectedFormat(format)
    if (format === "mal-xml") {
      setSelectedTypes((prev) =>
        prev.filter((id) => id === "anime" || id === "manga")
      )
    } else {
      setSelectedTypes(MEDIA_TYPES.map((m) => m.id))
    }
  }

  const toggleType = (id: string) => {
    if (selectedFormat === "mal-xml" && id !== "anime" && id !== "manga") return
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedFormat === "mal-xml") {
      setSelectedTypes(["anime", "manga"])
    } else {
      setSelectedTypes(MEDIA_TYPES.map((m) => m.id))
    }
  }

  const deselectAll = () => {
    setSelectedTypes([])
  }

  // Direct File Download
  const handleDownload = async () => {
    if (!username) {
      toast.error("Please sign in to export your media lists.")
      return
    }

    if (selectedTypes.length === 0) {
      toast.error("Please select at least one media type to export.")
      return
    }

    setIsExporting(true)
    try {
      const res = await elysia.user({ username }).lists.export.get({
        query: {
          format: selectedFormat,
          types: selectedTypes.join(","),
        },
        fetch: { credentials: "include" },
      })

      if (res.error || !res.data) {
        throw new Error(
          (res.error as any)?.value?.message || "Failed to download export file"
        )
      }

      let blob: Blob
      const isXml = selectedFormat === "mal-xml"

      if (typeof res.data === "string") {
        blob = new Blob([res.data], {
          type: isXml
            ? "application/xml;charset=utf-8"
            : "application/json;charset=utf-8",
        })
      } else {
        blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json;charset=utf-8",
        })
      }

      const filename = `${username}-${isXml ? "mal-export.xml" : "iris-export.json"}`
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success(`Export downloaded: ${filename}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to generate export file.")
    } finally {
      setIsExporting(false)
    }
  }

  // Create Share URL
  const handleCreateShare = async () => {
    if (!username) return
    if (!sharePassword || sharePassword.length < 4) {
      toast.error("Password must be at least 4 characters long.")
      return
    }

    if (selectedTypes.length === 0) {
      toast.error(
        "Please select at least one media type to include in the share."
      )
      return
    }

    setIsCreatingShare(true)
    try {
      const { data, error } = await elysia.user({ username }).lists.export.post(
        {
          password: sharePassword,
          mediaTypes: selectedTypes,
          description: shareDescription.trim() || undefined,
          expiresInHours: shareExpiresIn,
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (error || !data?.success) {
        throw new Error(
          (error as any)?.value?.message || "Failed to create export share link"
        )
      }

      toast.success("Password-protected export link created successfully!")
      setSharePassword("")
      setShareDescription("")
      fetchShares()
    } catch (err: any) {
      toast.error(err.message || "Failed to create share link.")
    } finally {
      setIsCreatingShare(false)
    }
  }

  // Revoke Share URL
  const handleRevokeShare = async (shareId: string) => {
    if (!username) return
    try {
      const { data, error } = await elysia
        .user({ username })
        .lists.export.delete(
          {},
          {
            query: { shareId },
            fetch: { credentials: "include" },
          }
        )

      if (error || !data?.success) {
        throw new Error(
          (error as any)?.value?.message || "Failed to revoke export link"
        )
      }

      toast.success("Export share link revoked.")
      setShares((prev) => prev.filter((s) => s.id !== shareId))
    } catch (err: any) {
      toast.error(err.message || "Could not revoke export link.")
    }
  }

  const copyShareUrl = (shareId: string) => {
    const fullUrl = `${API_URL}/lists/export/share/${shareId}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedShareId(shareId)
    toast.success("Export URL copied to clipboard!")
    setTimeout(() => setCopiedShareId(null), 2500)
  }

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-foreground">Media Export</h3>
      </div>

      {/* Section 1: Export Configuration (Format & Media Types) */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
        <div className="space-y-4">
          {/* Format Selector */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Export Format
            </label>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div
                onClick={() => handleFormatChange("iris-json")}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  selectedFormat === "iris-json"
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selectedFormat === "iris-json"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <IconFileCode className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">IRIS JSON</span>
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      Universal
                    </Badge>
                  </div>
                </div>
              </div>

              <div
                onClick={() => handleFormatChange("mal-xml")}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  selectedFormat === "mal-xml"
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selectedFormat === "mal-xml"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <IconFileTypeXml className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">
                      MyAnimeList XML
                    </span>
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      MAL Standard
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {selectedFormat === "mal-xml" && (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                <IconAlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  MyAnimeList XML only supports Anime and Manga tracking. Other
                  media types have been automatically deselected.
                </span>
              </div>
            )}
          </div>

          {/* Media Types Selection Grid */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Select Media Categories ({selectedTypes.length}/
                {selectedFormat === "mal-xml" ? 2 : MEDIA_TYPES.length})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted-foreground/40">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MEDIA_TYPES.map((type) => {
                const Icon = type.icon
                const isSupported =
                  selectedFormat === "iris-json" || type.malSupported
                const isChecked = selectedTypes.includes(type.id)

                return (
                  <div
                    key={type.id}
                    onClick={() => isSupported && toggleType(type.id)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 transition-colors ${
                      !isSupported
                        ? "cursor-not-allowed border-border/30 bg-muted/10 opacity-40"
                        : isChecked
                          ? "cursor-pointer border-primary/40 bg-primary/5 text-foreground"
                          : "cursor-pointer border-border/60 bg-card hover:border-border hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isChecked && isSupported
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate text-xs font-medium">
                        {type.label}
                      </span>
                    </div>

                    <Checkbox
                      isSelected={isChecked && isSupported}
                      onChange={() => isSupported && toggleType(type.id)}
                      isDisabled={!isSupported}
                      aria-label={`Select ${type.label}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action: Direct Download */}
          <div className="flex items-center justify-end border-t border-border/40 pt-3">
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isExporting || selectedTypes.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              {isExporting ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  <span>Generating Export...</span>
                </>
              ) : (
                <>
                  <IconDownload className="h-3.5 w-3.5" />
                  <span>
                    Download{" "}
                    {selectedFormat === "mal-xml" ? "MAL XML" : "IRIS JSON"}{" "}
                    File
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Section 2: Password-Protected Export Share URLs */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconLink className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Export Share URL
                </h4>
              </div>
            </div>
          </div>

          {/* Creation Form */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Password */}
              <div className="space-y-1 sm:col-span-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Share Password (Min 4 chars)
                </label>
                <div className="relative flex items-center">
                  <Input
                    type={showSharePassword ? "text" : "password"}
                    placeholder="Set password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    className="h-8 pe-8 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSharePassword(!showSharePassword)}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSharePassword ? (
                      <IconEyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <IconEye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expiration */}
              <div className="space-y-1 sm:col-span-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Expiration
                </label>
                <select
                  value={shareExpiresIn === null ? "0" : String(shareExpiresIn)}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setShareExpiresIn(val === 0 ? null : val)
                  }}
                  className="h-8 w-full rounded-2xl border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
                >
                  <option value="0">Never Expires</option>
                  <option value="24">24 Hours</option>
                  <option value="168">7 Days</option>
                  <option value="720">30 Days</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1 sm:col-span-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Label (Optional)
                </label>
                <Input
                  placeholder="e.g. Sync with Home Server"
                  value={shareDescription}
                  onChange={(e) => setShareDescription(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                Will include currently selected categories:{" "}
                <span className="font-medium text-foreground">
                  {selectedTypes.join(", ")}
                </span>
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateShare}
                disabled={
                  isCreatingShare ||
                  !sharePassword ||
                  selectedTypes.length === 0
                }
                className="h-8 gap-1.5 text-xs"
              >
                {isCreatingShare ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    <span>Creating Link...</span>
                  </>
                ) : (
                  <>
                    <IconKey className="h-3.5 w-3.5" />
                    <span>Generate Share Link</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Active Shares List */}
          <div className="space-y-2 pt-1">
            <h5 className="text-xs font-semibold text-foreground">
              Active Export Share Links ({shares.length})
            </h5>

            {isLoadingShares ? (
              <div className="flex h-20 items-center justify-center">
                <Spinner className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : shares.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No active export share URLs created yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => {
                  const shareUrl = `${API_URL}/lists/export/share/${share.id}`
                  const isCopied = copiedShareId === share.id

                  return (
                    <div
                      key={share.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {share.description || "Export Share Link"}
                          </span>
                          {share.isExpired ? (
                            <Badge
                              variant="destructive"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              Expired
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              Active
                            </Badge>
                          )}
                        </div>

                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {shareUrl}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] text-muted-foreground">
                          <span>
                            Created:{" "}
                            {new Date(share.createdAt).toLocaleDateString()}
                          </span>
                          {share.expiresAt && (
                            <span>
                              • Expires:{" "}
                              {new Date(share.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                          {share.lastUsedAt && (
                            <span>
                              • Last used:{" "}
                              {new Date(share.lastUsedAt).toLocaleDateString()}
                            </span>
                          )}
                          <span>• Types: {share.mediaTypes.join(", ")}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyShareUrl(share.id)}
                          className="h-7 gap-1 text-xs"
                        >
                          {isCopied ? (
                            <>
                              <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <IconCopy className="h-3.5 w-3.5" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeShare(share.id)}
                          className="h-7 px-2 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          <span className="sr-only">Revoke</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
