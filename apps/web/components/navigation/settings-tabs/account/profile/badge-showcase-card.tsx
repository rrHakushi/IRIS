"use client"

import React, { useState, useMemo } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  IconAward,
  IconCrown,
  IconCode,
  IconFlame,
  IconPalette,
  IconSparkles,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconHeadphones,
  IconBug,
  IconRocket,
  IconShieldCheck,
  IconLock,
  IconX,
  IconCheck,
  IconHelp,
  IconPlus,
  IconSearch,
  IconFolderHeart,
  IconDeviceGamepad,
  IconMoonStars,
  IconEyeOff,
} from "@tabler/icons-react"
import { getAllBadges, type IrisBadge } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

export interface BadgeShowcaseCardProps {
  unlockedBadgeIds?: number[]
  showcaseBadgeIds?: number[]
  onShowcaseBadgeIdsChange: (ids: number[]) => void
  disabled?: boolean
}

export function renderBadgeIcon(iconName: string, className = "size-4"): React.JSX.Element {
  switch (iconName) {
    case "IconCrown":
      return <IconCrown className={className} />
    case "IconCode":
      return <IconCode className={className} />
    case "IconFlame":
      return <IconFlame className={className} />
    case "IconPalette":
      return <IconPalette className={className} />
    case "IconSparkles":
      return <IconSparkles className={className} />
    case "IconDeviceTv":
      return <IconDeviceTv className={className} />
    case "IconBook":
      return <IconBook className={className} />
    case "IconMovie":
      return <IconMovie className={className} />
    case "IconHeadphones":
      return <IconHeadphones className={className} />
    case "IconBug":
      return <IconBug className={className} />
    case "IconRocket":
      return <IconRocket className={className} />
    case "IconShieldCheck":
      return <IconShieldCheck className={className} />
    case "IconFolderHeart":
      return <IconFolderHeart className={className} />
    case "IconDeviceGamepad":
      return <IconDeviceGamepad className={className} />
    case "IconMoonStars":
      return <IconMoonStars className={className} />
    case "IconEyeOff":
      return <IconEyeOff className={className} />
    default:
      return <IconAward className={className} />
  }
}

export function BadgeShowcaseCard({
  unlockedBadgeIds = [],
  showcaseBadgeIds = [],
  onShowcaseBadgeIdsChange,
  disabled = false,
}: BadgeShowcaseCardProps): React.JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "unlocked" | "locked">("all")

  const allBadges = useMemo(() => getAllBadges(), [])
  const unlockedSet = useMemo(() => new Set(unlockedBadgeIds), [unlockedBadgeIds])
  const showcasedSet = useMemo(() => new Set(showcaseBadgeIds), [showcaseBadgeIds])

  const showcasedBadges = useMemo(
    () =>
      showcaseBadgeIds
        .map((id) => allBadges.find((b) => b.id === id))
        .filter((b): b is IrisBadge => Boolean(b)),
    [showcaseBadgeIds, allBadges]
  )

  const unlockedCount = useMemo(
    () => allBadges.filter((b) => unlockedSet.has(b.id)).length,
    [allBadges, unlockedSet]
  )
  const lockedCount = allBadges.length - unlockedCount

  const filteredBadges = useMemo(() => {
    return allBadges.filter((badge) => {
      const isUnlocked = unlockedSet.has(badge.id)

      if (filterTab === "unlocked" && !isUnlocked) return false
      if (filterTab === "locked" && isUnlocked) return false

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const isHidden = !isUnlocked && badge.hidden
        const nameMatch = !isHidden && badge.name.toLowerCase().includes(query)
        const descMatch = !isHidden && badge.description.toLowerCase().includes(query)
        const hiddenMatch =
          isHidden &&
          ("secret achievement".includes(query) ||
            "locked".includes(query) ||
            "???".includes(query))

        return nameMatch || descMatch || hiddenMatch
      }

      return true
    })
  }, [allBadges, unlockedSet, filterTab, searchQuery])

  const handleToggleBadge = (badgeId: number) => {
    if (disabled) return
    const isUnlocked = unlockedSet.has(badgeId)

    if (!isUnlocked) {
      const badge = allBadges.find((b) => b.id === badgeId)
      if (badge?.hidden) {
        toast.info("Secret achievement. Keep exploring IRIS to unlock it!")
      } else if (badge) {
        toast.info(`${badge.name} is locked: ${badge.description}`)
      }
      return
    }

    if (showcasedSet.has(badgeId)) {
      onShowcaseBadgeIdsChange(showcaseBadgeIds.filter((id) => id !== badgeId))
      toast.success("Removed from showcase")
    } else {
      if (showcaseBadgeIds.length >= 5) {
        toast.error("Showcase limit reached (5/5). Remove a pinned badge first.")
        return
      }
      onShowcaseBadgeIdsChange([...showcaseBadgeIds, badgeId])
      toast.success("Pinned to showcase")
    }
  }

  const handleRemoveShowcase = (badgeId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    onShowcaseBadgeIdsChange(showcaseBadgeIds.filter((id) => id !== badgeId))
  }

  return (
    <>
      <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <IconAward className="size-4 text-primary" />
              Profile Badges & Showcase
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Showcase:
              </span>
              <Badge
                variant={showcaseBadgeIds.length >= 5 ? "default" : "secondary"}
                className="h-5 px-1.5 text-[10px] font-bold"
              >
                {showcaseBadgeIds.length} / 5
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Active Showcase Slot Strip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>Featured Showcase</span>
              {showcaseBadgeIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onShowcaseBadgeIdsChange([])}
                    className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Clear all
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(true)}
                    disabled={disabled}
                    className="h-6 gap-1 rounded-lg px-2 text-xs font-medium cursor-pointer"
                  >
                    <IconAward className="size-3" />
                    <span>Select Badge</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-muted/20 p-2.5 min-h-[52px]">
              {showcasedBadges.length > 0 ? (
                showcasedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="group flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 ps-2 pe-1.5 py-1 text-xs shadow-2xs transition-all hover:border-primary/40"
                    style={{ borderColor: `${badge.color}40` }}
                  >
                    <div style={{ color: badge.color }}>
                      {renderBadgeIcon(badge.icon, "size-3.5")}
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {badge.name}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => handleRemoveShowcase(badge.id, e)}
                      className="cursor-pointer text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100 disabled:opacity-30 inline-flex items-center justify-center"
                      aria-label={`Remove ${badge.name} from showcase`}
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex w-full items-center justify-between py-1 px-1">
                  <span className="text-xs text-muted-foreground/70 italic">
                    No badges pinned yet.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(true)}
                    disabled={disabled}
                    className="h-7 gap-1.5 rounded-xl px-2.5 text-xs font-medium cursor-pointer"
                  >
                    <IconAward className="size-3.5" />
                    <span>Select Badge</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges Catalog Modal */}
      <Dialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        className="sm:max-w-2xl"
      >
        <div className="flex w-full min-w-0 flex-col gap-4">
          <DialogHeader>
            <div className="pe-8">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <IconAward className="size-4.5 text-primary" />
                <span>Profile Badges & Achievements</span>
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Search bar & Filter Tabs */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <IconSearch className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search badges by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-full ps-8.5 pe-8 text-xs rounded-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear search"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 shrink-0 rounded-xl border border-border/40 bg-muted/20 p-1">
              {(
                [
                  { key: "all", label: `All (${allBadges.length})` },
                  { key: "unlocked", label: `Available (${unlockedCount})` },
                  { key: "locked", label: `Locked (${lockedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    filterTab === tab.key
                      ? "bg-card text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Badges Grid / Catalog */}
          <div className="max-h-[50vh] overflow-y-auto pe-1">
            {filteredBadges.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {filteredBadges.map((badge) => {
                  const isUnlocked = unlockedSet.has(badge.id)
                  const isShowcased = showcasedSet.has(badge.id)
                  const isHidden = !isUnlocked && badge.hidden

                  if (isUnlocked) {
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => handleToggleBadge(badge.id)}
                        className={cn(
                          "group relative flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 text-start transition-all",
                          isShowcased
                            ? "bg-muted/30 shadow-xs ring-1"
                            : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/40 hover:shadow-xs"
                        )}
                        style={
                          isShowcased
                            ? {
                                borderColor: `${badge.color}80`,
                              }
                            : undefined
                        }
                      >
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${badge.color}15`,
                            color: badge.color,
                            borderColor: `${badge.color}40`,
                          }}
                        >
                          {renderBadgeIcon(badge.icon, "size-4.5")}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-xs font-bold text-foreground">
                              {badge.name}
                            </span>
                            {isShowcased ? (
                              <Badge
                                variant="default"
                                className="h-4.5 gap-1 px-1.5 text-[9px] font-semibold uppercase tracking-wider shrink-0"
                                style={{ backgroundColor: badge.color, color: "#fff" }}
                              >
                                <IconCheck className="size-2.5" />
                                Pinned
                              </Badge>
                            ) : (
                              <span className="shrink-0 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 flex items-center gap-0.5">
                                <IconPlus className="size-2.5" /> Pin
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground line-clamp-2">
                            {badge.description}
                          </p>
                        </div>
                      </button>
                    )
                  }

                  return (
                    <div
                      key={badge.id}
                      onClick={() => handleToggleBadge(badge.id)}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-border/40 bg-muted/10 p-2.5 text-start opacity-70 transition-all hover:bg-muted/20 hover:opacity-90"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleToggleBadge(badge.id)
                        }
                      }}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-muted/30 text-muted-foreground/60">
                        {isHidden ? (
                          <IconHelp className="size-4.5" />
                        ) : (
                          <IconLock className="size-4.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-xs font-semibold text-muted-foreground">
                            {isHidden ? "???" : badge.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="h-4.5 gap-1 px-1.5 text-[9px] font-medium text-muted-foreground/80 border-border/40 shrink-0"
                          >
                            <IconLock className="size-2.5" />
                            Locked
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground/70 line-clamp-2">
                          {isHidden
                            ? "Secret achievement. Keep exploring to unlock."
                            : badge.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex size-9 items-center justify-center rounded-xl border border-border/40 bg-muted/30 text-muted-foreground/60">
                  <IconSearch className="size-4" />
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground">No badges found</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {searchQuery
                    ? `No badges match "${searchQuery}". Try a different keyword.`
                    : "No badges match the selected filter."}
                </p>
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-2 h-6 text-xs text-primary cursor-pointer"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <DialogFooter className="flex w-full flex-row items-center justify-between sm:justify-between border-t border-border/40 pt-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Showcase:</span>
              <Badge
                variant={showcaseBadgeIds.length >= 5 ? "default" : "secondary"}
                className="h-5 px-1.5 text-[10px] font-bold"
              >
                {showcaseBadgeIds.length} / 5
              </Badge>
              {showcaseBadgeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onShowcaseBadgeIdsChange([])}
                  className="ms-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="h-8 rounded-xl px-4 text-xs font-medium cursor-pointer"
            >
              Done
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  )
}

