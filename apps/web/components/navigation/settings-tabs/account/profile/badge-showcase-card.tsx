"use client"

import React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
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
} from "@tabler/icons-react"
import { getAllBadges, type IrisBadge } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

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
  const allBadges = getAllBadges()
  const unlockedSet = new Set(unlockedBadgeIds)
  const showcasedSet = new Set(showcaseBadgeIds)

  const showcasedBadges = showcaseBadgeIds
    .map((id) => allBadges.find((b) => b.id === id))
    .filter((b): b is IrisBadge => Boolean(b))

  const handleToggleBadge = (badgeId: number) => {
    if (disabled) return
    if (showcasedSet.has(badgeId)) {
      onShowcaseBadgeIdsChange(showcaseBadgeIds.filter((id) => id !== badgeId))
    } else {
      if (showcaseBadgeIds.length >= 5) {
        return
      }
      onShowcaseBadgeIdsChange([...showcaseBadgeIds, badgeId])
    }
  }

  const handleRemoveShowcase = (badgeId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    onShowcaseBadgeIdsChange(showcaseBadgeIds.filter((id) => id !== badgeId))
  }

  return (
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
        <CardDescription className="text-xs text-muted-foreground">
          Select up to 5 unlocked badges to feature prominently on your profile header.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Active Showcase Slot Strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Featured Showcase</span>
            {showcaseBadgeIds.length > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onShowcaseBadgeIdsChange([])}
                className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Clear all
              </button>
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
                    className="cursor-pointer text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100 disabled:opacity-30"
                    title="Remove from showcase"
                  >
                    <IconX className="size-3" />
                  </button>
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground/70 italic px-1">
                No badges pinned yet. Click on any unlocked badge below to pin it!
              </span>
            )}
          </div>
        </div>

        {/* All Badges Catalog */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <label className="text-xs font-semibold text-foreground">
            Badge Catalog & Unlock Progress
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allBadges.map((badge) => {
              const isUnlocked = unlockedSet.has(badge.id)
              const isShowcased = showcasedSet.has(badge.id)
              const isHidden = !isUnlocked && badge.hidden

              return (
                <button
                  key={badge.id}
                  type="button"
                  disabled={disabled || !isUnlocked}
                  onClick={() => handleToggleBadge(badge.id)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 text-start transition-all disabled:cursor-not-allowed",
                    isUnlocked
                      ? isShowcased
                        ? "border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/40"
                        : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/40"
                      : "border-dashed border-border/40 bg-muted/10 opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      isUnlocked
                        ? "border-border/60 shadow-2xs"
                        : "border-border/30 bg-muted/30 text-muted-foreground"
                    )}
                    style={
                      isUnlocked
                        ? {
                            backgroundColor: `${badge.color}15`,
                            color: badge.color,
                            borderColor: `${badge.color}40`,
                          }
                        : undefined
                    }
                  >
                    {isUnlocked ? (
                      renderBadgeIcon(badge.icon, "size-4")
                    ) : isHidden ? (
                      <IconHelp className="size-4 text-muted-foreground/60" />
                    ) : (
                      <IconLock className="size-4 text-muted-foreground/60" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-bold text-foreground">
                        {isHidden ? "???" : badge.name}
                      </span>
                      {isShowcased && (
                        <Badge
                          variant="default"
                          className="h-4 px-1 text-[9px] font-semibold uppercase"
                        >
                          Pinned
                        </Badge>
                      )}
                      {!isUnlocked && (
                        <span className="text-[10px] text-muted-foreground">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground line-clamp-2">
                      {isHidden
                        ? "Secret achievement. Keep exploring to unlock."
                        : badge.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
