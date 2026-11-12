"use client"

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  OverlayTriggerStateContext,
  RootMenuTriggerStateContext,
} from "react-aria-components"
import {
  IconActivity,
  IconAlertCircle,
  IconBook,
  IconBook2,
  IconBuildingSkyscraper,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClock,
  IconDeviceTv,
  IconDisc,
  IconEdit,
  IconExternalLink,
  IconFileText,
  IconFlag,
  IconFolder,
  IconHelpCircle,
  IconLayoutGrid,
  IconLink,
  IconLoader2,
  IconLock,
  IconMenu2,
  IconMicrophone,
  IconMovie,
  IconPencil,
  IconPhotoOff,
  IconPlus,
  IconRotate2,
  IconSearch,
  IconSend,
  IconSparkles,
  IconStar,
  IconTrash,
  IconUser,
  IconUserCheck,
  IconUserHeart,
  IconX,
} from "@tabler/icons-react"
import { BorealisDatePicker } from "./date-picker"
import { cn } from "@workspace/ui/lib/utils"
import { elysia } from "@/lib/elysia"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  BorealisCardContext,
  useBorealisCard,
} from "./borealis-card-context"
import { BorealisFormattedText } from "./formatted-text"
import { normalizeBorealisData } from "./normalizers"
import { StatusBadge } from "./status-badge"
import { MediaStatusBadge } from "./media-status-badge"
import {
  MediaListStatusBadge,
  getMediaListStatusIcon,
} from "./media-list-status-badge"
import {
  getMediaListStatusColor,
  getMediaListStatusDotBg,
  getMediaStatusColor,
  getMediaStatusDotBg,
} from "./status"
import {
  getMediaListStatusText,
  normalizeListStatus,
  type ListStatus,
} from "./media-list-status-text"
import type {
  BorealisCardExpandedContentProps,
  BorealisCardExtrasProps,
  BorealisCardHoverContentProps,
  BorealisCardImageProps,
  BorealisCardProps,
  BorealisCardRootProps,
  BorealisCardSavePayload,
  BorealisCardTitleProps,
  BorealisEntityType,
} from "./types"

const STATUS_DROPDOWN_OPTIONS: ListStatus[] = [
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
  "PLANNED",
  "MAYBE",
]

const SCORE_OPTIONS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

// -----------------------------------------------------------------------------
// Fallback Icon Helper
// -----------------------------------------------------------------------------
function getEntityFallbackIcon(type: BorealisEntityType) {
  switch (type) {
    case "character":
      return <IconUserHeart className="size-8 stroke-[1.5] text-muted-foreground/50" />
    case "staff":
      return <IconUserCheck className="size-8 stroke-[1.5] text-muted-foreground/50" />
    case "studio":
      return <IconBuildingSkyscraper className="size-8 stroke-[1.5] text-muted-foreground/50" />
    case "music":
      return <IconDisc className="size-8 stroke-[1.5] text-muted-foreground/50" />
    case "movies":
    case "tv":
      return <IconMovie className="size-8 stroke-[1.5] text-muted-foreground/50" />
    default:
      return <IconPhotoOff className="size-8 stroke-[1.5] text-muted-foreground/50" />
  }
}

// -----------------------------------------------------------------------------
// 1. BorealisCard.Root
// -----------------------------------------------------------------------------
export function BorealisCardRoot({
  data,
  expanded = false,
  imagePosition = "left",
  showExtras = true,
  showBadges = true,
  showSubtitle = true,
  showHoverSubtitle = false,
  showTabNav = false,
  showDescription = false,
  showHoverCard = true,
  showProgress = true,
  statusIconOnly = false,
  canEdit = false,
  onStatusChange,
  onScoreChange,
  onSaveEntry,
  onEdit,
  onIncrement,
  onIncrementVolume,
  isIncrementDisabled = false,
  aspectRatio,
  size = "md",
  hoverPlacement,
  hoverDelay = 150,
  className,
  children,
}: BorealisCardRootProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isHoverCardEditing, setIsHoverCardEditing] = useState(false)
  const [popoverPlacement, setPopoverPlacement] = useState<"left" | "right">("right")
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [localScore, setLocalScore] = useState<number | null | undefined>(undefined)
  const [localStatus, setLocalStatus] = useState<ListStatus | undefined>(undefined)
  const [localProgress, setLocalProgress] = useState<number | undefined>(undefined)

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)

    // Calculate placement to guarantee the popover does NOT cover the card
    if (containerRef.current && typeof window !== "undefined") {
      const rect = containerRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const popoverWidth = Math.min(384, viewportWidth * 0.9)
      const gap = 14
      const spaceOnRight = viewportWidth - rect.right
      const spaceOnLeft = rect.left

      if (spaceOnRight >= popoverWidth + gap) {
        setPopoverPlacement("right")
      } else if (spaceOnLeft >= popoverWidth + gap) {
        setPopoverPlacement("left")
      } else {
        setPopoverPlacement(spaceOnRight >= spaceOnLeft ? "right" : "left")
      }
    }

    timerRef.current = setTimeout(() => {
      setIsHovered(true)
    }, hoverDelay)
  }

  const handleMouseLeave = () => {
    if (isHoverCardEditing) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 150)
  }

  const config = {
    expanded,
    imagePosition,
    showExtras,
    showBadges,
    showSubtitle,
    showHoverSubtitle,
    showTabNav,
    showDescription,
    showHoverCard,
    showProgress,
    statusIconOnly,
    canEdit,
    onStatusChange,
    onScoreChange,
    onSaveEntry,
    onEdit,
    onIncrement,
    onIncrementVolume,
    isIncrementDisabled,
    aspectRatio: aspectRatio ?? data.aspectRatio,
    size,
    hoverPlacement: hoverPlacement ?? popoverPlacement,
    hoverDelay,
    className,
  }

  const rawEntry = data.raw?.entry ?? data.raw?.listEntry ?? data.raw
  const entryPriority = (rawEntry?.priority ?? data.priority ?? "").toUpperCase()

  return (
    <BorealisCardContext.Provider
      value={{
        data,
        config,
        isHovered,
        popoverPlacement,
        containerRef,
        handleMouseEnter,
        handleMouseLeave,
        localScore,
        setLocalScore,
        localStatus,
        setLocalStatus,
        localProgress,
        setLocalProgress,
        isHoverCardEditing,
        setIsHoverCardEditing,
      }}
    >
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "bcard group/bcard relative flex rounded-2xl border border-border/60 bg-card text-card-foreground transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
          entryPriority === "ULTRA" && "border-t-2 border-e-2 border-t-purple-500 border-e-purple-500",
          entryPriority === "HIGH" && "border-t-2 border-e-2 border-t-rose-500 border-e-rose-500",
          entryPriority === "MEDIUM" && "border-t-2 border-e-2 border-t-amber-500 border-e-amber-500",
          expanded
            ? cn(
              "w-full p-2 items-center gap-3 sm:gap-4",
              imagePosition === "right" || imagePosition === "end"
                ? "flex-row-reverse text-start"
                : "flex-row text-start"
            )
            : cn(
              "flex-col p-1.5 shrink-0",
              size === "sm" && "w-32 text-xs",
              size === "md" && "w-40 text-sm",
              size === "lg" && "w-48 text-base"
            ),
          isHovered ? "z-40" : "z-10",
          className
        )}
      >
        {children}
      </div>
    </BorealisCardContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// 2. BorealisCard.Image
// -----------------------------------------------------------------------------
export function BorealisCardImage({
  className,
  aspectRatio,
  showBadges: overrideShowBadges,
  onScoreChange,
  children,
}: BorealisCardImageProps) {
  const { data, config, localScore, setLocalScore, localStatus, localProgress } = useBorealisCard()
  const [imageError, setImageError] = useState(false)

  const effectiveRatio = aspectRatio ?? config.aspectRatio ?? data.aspectRatio
  const shouldShowBadges = overrideShowBadges ?? config.showBadges ?? true

  const scoreFormatted = data.hoverDetails?.scoreFormatted
  const isEntity =
    data.type === "character" ||
    data.type === "characters" ||
    data.type === "staff" ||
    data.type === "people" ||
    data.type === "studio" ||
    data.type === "studios" ||
    data.type === "episode" ||
    data.type === "episodes"
  const effectiveOnScoreChange = onScoreChange ?? config.onScoreChange

  return (
    <a
      href={data.href && data.href !== "#" ? data.href : undefined}
      onClick={(e) => {
        if (!data.href || data.href === "#") {
          e.preventDefault()
        }
      }}
      className={cn(
        "relative block w-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary select-none",
        effectiveRatio === "square" && "aspect-square",
        (effectiveRatio === "poster" || !effectiveRatio) && "aspect-[2/3] aspect-2/3",
        effectiveRatio === "video" && "aspect-video",
        className
      )}
    >
      {data.image && !imageError ? (
        <img
          src={data.image}
          alt={data.title}
          loading="lazy"
          onError={() => setImageError(true)}
          className="size-full rounded-xl object-cover transition-transform duration-300 group-hover/bcard:scale-105"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 p-3 text-muted-foreground/60">
          {getEntityFallbackIcon(data.type)}
          <span className="text-center text-[10px] font-medium capitalize">
            {data.type}
          </span>
        </div>
      )}

      {/* Bottom gradient shadow for badge legibility */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

      {/* Top-Start: Edit Hamburger button when onEdit is provided */}
      {config.onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            config.onEdit?.()
          }}
          aria-label="Edit list entry"
          className="absolute start-1.5 top-1.5 z-20 flex size-6 cursor-pointer items-center justify-center rounded-md bg-black/70 text-white/90 opacity-0 backdrop-blur-md transition-opacity group-hover/bcard:opacity-100 hover:bg-black/90 hover:text-white focus-visible:opacity-100"
        >
          <IconMenu2 className="size-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Top-End: Connected Services Link badge */}
      {data.connectedCount !== undefined && data.connectedCount > 0 && (
        <div
          className="pointer-events-none absolute end-1.5 top-1.5 z-20 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 tabular-nums shadow-xs backdrop-blur-md"
          title={`${data.connectedCount} connected service${data.connectedCount === 1 ? "" : "s"}`}
        >
          <IconLink className="size-2.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{data.connectedCount}</span>
        </div>
      )}

      {/* Bottom Overlaid Badges: Format / Role Badges + Score Badge right next to each other */}
      {shouldShowBadges && (data.badges.length > 0 || !isEntity) && (
        <div className="pointer-events-none absolute start-1.5 bottom-1.5 z-10 flex flex-wrap items-center gap-1">
          {data.badges.map((badge, idx) => (
            <span
              key={idx}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black tracking-wider uppercase shadow-md transition-colors",
                badge.className
              )}
            >
              {badge.label}
            </span>
          ))}

          {/* Score Badge next to Format Badge for all media types */}
          {!isEntity && (() => {
            const entryScore =
              localScore !== undefined
                ? localScore
                : typeof data.raw?.entry?.score === "number" && data.raw.entry.score > 0
                  ? data.raw.entry.score
                  : typeof data.raw?.score === "number" && data.raw.score > 0
                    ? data.raw.score
                    : typeof data.hoverDetails?.userScore === "number" && data.hoverDetails.userScore > 0
                      ? data.hoverDetails.userScore
                      : null
            const currentScoreNum =
              entryScore ??
              (typeof data.hoverDetails?.score === "number" && data.hoverDetails.score > 0
                ? data.hoverDetails.score
                : null)
            const displayScore = effectiveOnScoreChange || config.onSaveEntry
              ? entryScore !== null && entryScore > 0
                ? (entryScore > 10 ? (entryScore / 10).toFixed(1) : entryScore.toFixed(1))
                : "N/A"
              : (scoreFormatted ?? "N/A")
            const hasScore = displayScore !== "N/A"

            const handleScoreSelect = (scoreVal: number | null) => {
              setLocalScore?.(scoreVal)
              if (effectiveOnScoreChange) {
                effectiveOnScoreChange(scoreVal)
              } else if (config.onSaveEntry) {
                config.onSaveEntry({
                  status: localStatus ?? normalizeListStatus(data.raw?.entry?.status ?? data.hoverDetails?.listStatus) ?? "IN_PROGRESS",
                  score: scoreVal,
                  progress: localProgress ?? data.progress?.current ?? data.raw?.entry?.progress ?? 0,
                })
              }
            }

            if (effectiveOnScoreChange || config.onSaveEntry) {
              return (
                <div className="pointer-events-auto">
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-5 gap-1 rounded-md px-1.5 font-mono text-[10px] font-black shadow-md backdrop-blur-md cursor-pointer select-none transition-colors border",
                        hasScore
                          ? "border-amber-500/40 bg-frost text-amber-300 hover:border-amber-400 hover:bg-black/60"
                          : "border-zinc-700/60 bg-frost text-zinc-400 hover:border-zinc-500 hover:bg-black/60"
                      )}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      aria-label={`Score: ${displayScore}. Click to change.`}
                    >
                      <IconStar
                        className={cn(
                          "size-3",
                          hasScore ? "fill-amber-300 text-amber-300" : "text-zinc-500"
                        )}
                      />
                      <span>{displayScore}</span>
                    </Button>
                    <DropdownMenu placement="bottom start" className="max-h-[108px] overflow-y-auto overscroll-contain [scrollbar-width:thin] w-auto min-w-[115px] text-[10px] border border-frost bg-frost text-zinc-100 shadow-2xl backdrop-blur-2xl z-[100]">
                      {SCORE_OPTIONS.map((scoreVal) => {
                        const isSelected = currentScoreNum !== null && (currentScoreNum === scoreVal || currentScoreNum / 10 === scoreVal || currentScoreNum === scoreVal * 10)
                        return (
                          <DropdownMenuItem
                            key={scoreVal}
                            onAction={() => handleScoreSelect(scoreVal)}
                            className="flex items-center gap-1.5 cursor-pointer font-medium text-[10px] py-1 px-2 min-h-6"
                          >
                            <IconStar className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                            <span className={cn(isSelected && "font-bold text-white")}>
                              {scoreVal} / 10
                            </span>
                            {isSelected && (
                              <IconCheck className="size-3 ms-auto text-primary shrink-0" />
                            )}
                          </DropdownMenuItem>
                        )
                      })}
                      <DropdownMenuItem
                        onAction={() => handleScoreSelect(null)}
                        className="flex items-center gap-1.5 cursor-pointer font-medium text-[9px] text-zinc-400 hover:text-white py-1 px-2 min-h-6"
                      >
                        <IconX className="size-3 text-zinc-400 shrink-0" />
                        <span>Clear Rating (N/A)</span>
                        {!hasScore && (
                          <IconCheck className="size-3 ms-auto text-primary shrink-0" />
                        )}
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </DropdownMenuTrigger>
                </div>
              )
            }

            return (
              <div
                className={cn(
                  "inline-flex h-5 items-center gap-1 rounded-md px-1.5 font-mono text-[10px] font-black shadow-md backdrop-blur-md border",
                  hasScore
                    ? "border-amber-500/40 bg-frost text-amber-300"
                    : "border-zinc-700/60 bg-frost text-zinc-400"
                )}
              >
                <IconStar
                  className={cn(
                    "size-3",
                    hasScore ? "fill-amber-300 text-amber-300" : "text-zinc-500"
                  )}
                />
                <span>{displayScore}</span>
              </div>
            )
          })()}
        </div>
      )}

      {children}
    </a>
  )
}

// -----------------------------------------------------------------------------
// 3. BorealisCard.Title
// -----------------------------------------------------------------------------
export function BorealisCardTitle({
  className,
  showSubtitle: overrideShowSubtitle,
  showDescription: overrideShowDescription,
  titleClassName,
  subtitleClassName,
  descriptionClassName,
}: BorealisCardTitleProps) {
  const { data, config } = useBorealisCard()
  const shouldShowSubtitle =
    overrideShowSubtitle ?? config.showSubtitle ?? true
  const shouldShowDescription =
    overrideShowDescription ?? config.showDescription ?? false

  const descriptionText = data.description || data.hoverDetails?.description

  return (
    <div className={cn("flex flex-col gap-0.5 px-1 py-1.5 min-w-0", className)}>
      <a
        href={data.href && data.href !== "#" ? data.href : undefined}
        onClick={(e) => {
          if (!data.href || data.href === "#") {
            e.preventDefault()
          }
        }}
        title={data.title}
        className={cn(
          "block truncate font-mono text-xs sm:text-sm font-bold text-foreground transition-colors group-hover/bcard:text-primary group-hover/bcard:underline",
          titleClassName
        )}
      >
        {data.title}
      </a>

      {shouldShowSubtitle && (data.titleNative || data.titleSecondary) && (
        <span
          title={data.titleNative ?? data.titleSecondary ?? ""}
          className={cn(
            "block truncate text-[10px] text-muted-foreground/80 font-mono tracking-tight",
            subtitleClassName
          )}
        >
          {data.titleNative ?? data.titleSecondary}
        </span>
      )}

      {shouldShowDescription && descriptionText && (
        <p
          title={descriptionText}
          className={cn(
            "line-clamp-2 text-[11px] text-muted-foreground/80 leading-snug select-none mt-0.5",
            descriptionClassName
          )}
        >
          {descriptionText}
        </p>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helper: Custom Progress Increment Input
// -----------------------------------------------------------------------------
function BorealisProgressCustomInput({
  max,
  unit,
  onApply,
}: {
  max?: number | null
  unit?: string
  onApply: (amount: number) => void
}) {
  const [val, setVal] = useState<string>("")
  const overlayState = useContext(OverlayTriggerStateContext)
  const rootMenuState = useContext(RootMenuTriggerStateContext)

  const handleApply = () => {
    const num = parseInt(val, 10)
    if (isNaN(num) || num <= 0) return
    const clamped = typeof max === "number" && max > 0 ? Math.min(num, max) : num
    onApply(clamped)
    setVal("")
    rootMenuState?.close()
    overlayState?.close()
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 w-full select-none text-[10px] min-w-[150px]"
      onClick={(e) => {
        e.stopPropagation()
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
      }}
    >
      <span className="font-mono text-[10px] font-bold text-primary select-none">+</span>
      <input
        type="number"
        min={1}
        max={typeof max === "number" && max > 0 ? max : undefined}
        value={val}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === "") {
            setVal("")
            return
          }
          const num = parseInt(raw, 10)
          if (isNaN(num)) return
          if (typeof max === "number" && max > 0 && num > max) {
            setVal(String(max))
          } else {
            setVal(String(Math.max(1, num)))
          }
        }}
        onFocus={(e) => {
          e.stopPropagation()
        }}
        onBlur={(e) => {
          e.stopPropagation()
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
        }}
        onKeyUp={(e) => {
          e.stopPropagation()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter") {
            e.preventDefault()
            handleApply()
          }
        }}
        placeholder={typeof max === "number" && max > 0 ? `1-${max}` : "Num"}
        className="h-5 w-14 rounded border border-frost bg-frost/80 px-1 font-mono text-[10px] text-white backdrop-blur-md focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit ? (
        <span className="font-mono text-[9px] text-zinc-400 select-none">{unit}</span>
      ) : null}
      <button
        type="button"
        disabled={!val || parseInt(val, 10) <= 0}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleApply()
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        aria-label="Add progress"
        className="ms-auto flex size-5 shrink-0 items-center justify-center rounded bg-primary/20 text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
      >
        <IconSend className="size-3" />
      </button>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 4. BorealisCard.Extras
// -----------------------------------------------------------------------------
export function BorealisCardExtras({
  className,
  showActor = true,
  showMetaPills = true,
  showSubtext = true,
  showProgress = true,
  statusIconOnly,
  onStatusChange,
  onIncrementVolume,
}: BorealisCardExtrasProps) {
  const { data, config } = useBorealisCard()

  if (config.showExtras === false) {
    return null
  }

  const effectiveOnStatusChange = onStatusChange ?? config.onStatusChange
  const effectiveOnIncrementVolume = onIncrementVolume ?? config.onIncrementVolume
  const shouldShowStatusIconOnly =
    statusIconOnly ?? config.statusIconOnly ?? Boolean(effectiveOnStatusChange)

  // 1. Character Voice Actor row (matches provided reference screenshot)
  if (data.type === "character" && showActor && data.actor) {
    const actor = data.actor
    return (
      <div
        className={cn(
          "mt-auto flex items-center gap-2 border-t border-border/40 px-1 pt-1.5 pb-0.5 text-[10px]",
          className
        )}
      >
        {actor.image ? (
          <img
            src={actor.image}
            alt={actor.namePrimary}
            loading="lazy"
            className="size-5 shrink-0 rounded-full object-cover ring-1 ring-border/50"
          />
        ) : (
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
            VA
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <a
            href={`/borealis/people/${actor.id}`}
            title={actor.namePrimary}
            className="truncate text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline dark:text-cyan-400"
          >
            {actor.namePrimary}
          </a>
          {actor.language && (
            <span className="truncate text-[10px] text-muted-foreground/80">
              {actor.language}
            </span>
          )}
        </div>
      </div>
    )
  }

  // 2. Staff Person subtext (role / occupation)
  if (data.type === "staff" && showSubtext && data.subtext) {
    return (
      <div
        className={cn(
          "mt-auto border-t border-border/40 px-1 pt-1.5 pb-0.5 text-[10px] text-muted-foreground",
          className
        )}
      >
        <span className="line-clamp-1 font-medium">{data.subtext}</span>
      </div>
    )
  }

  // 3. Media List Status and/or Interactive Progress dropdown
  const shouldShowProgress =
    showProgress && config.showProgress !== false && Boolean(data.progress)
  const hasListStatus = Boolean(data.listStatus)

  if (hasListStatus || shouldShowProgress) {
    return (
      <div
        className={cn(
          "mt-auto flex flex-col gap-1 border-t border-border/40 px-1 pt-1.5 pb-0.5 text-[10px]",
          className
        )}
      >
        <div className="flex items-center justify-between gap-1">
          {hasListStatus ? (
            shouldShowStatusIconOnly ? (() => {
              const canonicalStatus: ListStatus = normalizeListStatus(data.listStatus) ?? "IN_PROGRESS"
              const StatusIcon = getMediaListStatusIcon(canonicalStatus)
              const statusColor = getMediaListStatusColor(canonicalStatus)
              const currentLabel = getMediaListStatusText(canonicalStatus, data.type)

              if (effectiveOnStatusChange) {
                return (
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        "size-5.5 rounded-md p-0.5 transition-colors cursor-pointer hover:bg-zinc-800/80",
                        statusColor
                      )}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Status: ${currentLabel}. Click to change.`}
                    >
                      <StatusIcon className="size-3.5 stroke-[2]" aria-hidden="true" />
                    </Button>
                    <DropdownMenu placement="bottom start" className="w-auto min-w-[150px] whitespace-nowrap text-[10px] border border-frost bg-frost shadow-2xl backdrop-blur-2xl z-[100]">
                      {STATUS_DROPDOWN_OPTIONS.map((opt) => {
                        const OptIcon = getMediaListStatusIcon(opt)
                        const optColor = getMediaListStatusColor(opt)
                        const optLabel = getMediaListStatusText(opt, data.type)
                        const isSelected = canonicalStatus === opt
                        return (
                          <DropdownMenuItem
                            key={opt}
                            onAction={() => effectiveOnStatusChange(opt)}
                            className="flex items-center gap-1.5 cursor-pointer font-medium text-[10px] py-1 px-2 min-h-6 whitespace-nowrap"
                          >
                            <OptIcon className={cn("size-3 shrink-0", optColor)} />
                            <span className={cn(isSelected && "font-bold text-white")}>
                              {optLabel}
                            </span>
                            {isSelected && (
                              <IconCheck className="size-3 ms-auto text-primary shrink-0" />
                            )}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenu>
                  </DropdownMenuTrigger>
                )
              }

              return (
                <div
                  className={cn(
                    "flex size-5.5 items-center justify-center rounded-md",
                    statusColor
                  )}
                  title={currentLabel}
                >
                  <StatusIcon className="size-3.5 stroke-[2]" aria-hidden="true" />
                </div>
              )
            })() : (
              <MediaListStatusBadge status={data.listStatus!} mediaType={data.type} />
            )
          ) : data.subtext ? (
            <span className="truncate text-[10px] text-muted-foreground/80 font-medium">
              {data.subtext}
            </span>
          ) : (
            <span />
          )}

          {shouldShowProgress && data.progress && (() => {
            const isTv = data.type === "tv"
            const isMangaOrBook = data.type === "manga" || data.type === "books" || data.type === "book"
            const isGameOrOther = data.type === "games" || data.type === "game" || data.type === "other"

            const canIncrement = Boolean(config.onIncrement || effectiveOnIncrementVolume)

            if (isTv && data.progress.seasonNumber) {
              const epNum = data.progress.episodeNumber ?? data.progress.current ?? 0
              const epStr = epNum < 100 ? String(epNum).padStart(2, "0") : String(epNum)
              const maxEpInSeason = data.progress.seasonEpisodeCount
              const maxEpStr = maxEpInSeason
                ? (maxEpInSeason < 100 ? String(maxEpInSeason).padStart(2, "0") : String(maxEpInSeason))
                : null
              const remainingInSeason = maxEpInSeason && maxEpInSeason > epNum ? maxEpInSeason - epNum : 0
              const remainingTotal = data.progress.max && data.progress.max > data.progress.current
                ? data.progress.max - data.progress.current
                : 0
              const nextSeasonEpCount = data.progress.nextSeasonEpisodeCount
              const nextSeasonNum = data.progress.nextSeasonNumber
              const hasMoreSeasons = data.progress.hasMoreSeasons
              const currentSeasonNum = data.progress.seasonNumber

              return (
                <div className="flex items-center gap-1 ms-auto">
                  {/* Season Dropdown */}
                  {canIncrement ? (
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        isDisabled={config.isIncrementDisabled}
                        className="h-5 gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/80 px-1.5 font-mono text-[10px] font-bold text-zinc-100 hover:border-primary/50 hover:bg-zinc-800 backdrop-blur-md select-none transition-colors cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>S{currentSeasonNum}</span>
                      </Button>
                      <DropdownMenu placement="bottom start" className="w-auto min-w-[170px] whitespace-nowrap text-[10px] border border-frost bg-frost shadow-2xl backdrop-blur-2xl z-[100]">
                        {remainingInSeason > 0 ? (
                          hasMoreSeasons ? (
                            <DropdownMenuItem
                              onAction={() => config.onIncrement?.(remainingInSeason)}
                              className="text-primary font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                            >
                              <IconPlus className="size-3 me-1.5 text-primary shrink-0" />
                              + 1 Season
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onAction={() => config.onIncrement?.(remainingInSeason)}
                              className="text-primary font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                            >
                              <IconCheck className="size-3 me-1.5 text-primary shrink-0" />
                              Finish Season
                            </DropdownMenuItem>
                          )
                        ) : nextSeasonEpCount && nextSeasonEpCount > 0 ? (
                          <DropdownMenuItem
                            onAction={() => config.onIncrement?.(nextSeasonEpCount)}
                            className="text-primary font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                          >
                            <IconPlus className="size-3 me-1.5 text-primary shrink-0" />
                            + 1 Season
                          </DropdownMenuItem>
                        ) : hasMoreSeasons && nextSeasonNum ? (
                          <DropdownMenuItem isDisabled className="text-[9px] text-muted-foreground opacity-60 cursor-default whitespace-nowrap py-1 px-2 min-h-6">
                            Season {nextSeasonNum} (TBA)
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem isDisabled className="text-[9px] text-muted-foreground opacity-60 cursor-default whitespace-nowrap py-1 px-2 min-h-6">
                            Season {currentSeasonNum} Complete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenu>
                    </DropdownMenuTrigger>
                  ) : (
                    <span className="font-mono text-[10px] font-medium text-muted-foreground tabular-nums">
                      S{currentSeasonNum}
                    </span>
                  )}

                  {/* Episode Dropdown */}
                  {canIncrement ? (
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        isDisabled={config.isIncrementDisabled}
                        className="h-5 gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/80 px-1.5 font-mono text-[10px] font-bold text-zinc-100 hover:border-primary/50 hover:bg-zinc-800 backdrop-blur-md select-none transition-colors cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>E{epStr}{maxEpStr ? `/${maxEpStr}` : ""}</span>
                      </Button>
                      <DropdownMenu placement="bottom start" className="w-auto min-w-[170px] whitespace-nowrap text-[10px] border border-frost bg-frost shadow-2xl backdrop-blur-2xl z-[100]">
                        <DropdownMenuItem onAction={() => config.onIncrement?.(1)} className="whitespace-nowrap text-[10px] py-1 px-2 min-h-6 font-medium">
                          <IconPlus className="size-3 me-1.5 text-primary shrink-0" />
                          +1 Ep
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          id="custom-ep"
                          textValue="Custom episodes"
                          shouldCloseOnSelect={false}
                          className="p-0 focus:bg-transparent focus:outline-none cursor-default min-h-6"
                        >
                          <BorealisProgressCustomInput
                            max={remainingTotal > 0 ? remainingTotal : undefined}
                            unit="eps"
                            onApply={(amount) => config.onIncrement?.(amount)}
                          />
                        </DropdownMenuItem>
                        {remainingTotal > 1 && (
                          <DropdownMenuItem
                            onAction={() => config.onIncrement?.(remainingTotal)}
                            className="text-emerald-400 font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                          >
                            <IconCheck className="size-3 me-1.5 text-emerald-400 shrink-0" />
                            Finish Series
                          </DropdownMenuItem>
                        )}
                      </DropdownMenu>
                    </DropdownMenuTrigger>
                  ) : (
                    <span className="font-mono text-[10px] font-medium text-muted-foreground tabular-nums">
                      E{epStr}{maxEpStr ? `/${maxEpStr}` : ""}
                    </span>
                  )}
                </div>
              )
            }

            if (isMangaOrBook) {
              const volCur = data.progress.volumeCurrent ?? 0
              const volMax = data.progress.volumeMax
              const chCur = data.progress.chapterCurrent ?? data.progress.current ?? 0
              const chMax = data.progress.chapterMax ?? data.progress.max
              const hasVolumes = volMax !== null || volCur > 0

              return (
                <div className="flex items-center gap-1 ms-auto">
                  {/* Volume Dropdown (if has volumes or effectiveOnIncrementVolume) */}
                  {hasVolumes && (
                    canIncrement && effectiveOnIncrementVolume ? (
                      <DropdownMenuTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          isDisabled={config.isIncrementDisabled}
                          className="h-5 gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/80 px-1.5 font-mono text-[10px] font-bold text-zinc-100 hover:border-primary/50 hover:bg-zinc-800 backdrop-blur-md select-none transition-colors cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>V{volCur}{volMax ? `/${volMax}` : ""}</span>
                        </Button>
                        <DropdownMenu placement="bottom start" className="w-auto min-w-[170px] whitespace-nowrap text-[10px] border border-frost bg-frost shadow-2xl backdrop-blur-2xl z-[100]">
                          <DropdownMenuItem onAction={() => effectiveOnIncrementVolume(1)} className="whitespace-nowrap text-[10px] py-1 px-2 min-h-6 font-medium">
                            <IconPlus className="size-3 me-1.5 text-cyan-400 shrink-0" />
                            +1 Vol
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            id="custom-vol"
                            textValue="Custom volumes"
                            shouldCloseOnSelect={false}
                            className="p-0 focus:bg-transparent focus:outline-none cursor-default min-h-6"
                          >
                            <BorealisProgressCustomInput
                              max={volMax && volMax > volCur ? volMax - volCur : undefined}
                              unit="vols"
                              onApply={(amount) => effectiveOnIncrementVolume(amount)}
                            />
                          </DropdownMenuItem>
                          {volMax && volMax > volCur + 1 && (
                            <DropdownMenuItem
                              onAction={() => effectiveOnIncrementVolume(volMax - volCur)}
                              className="text-cyan-400 font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                            >
                              <IconCheck className="size-3 me-1.5 text-cyan-400 shrink-0" />
                              Finish Volumes
                            </DropdownMenuItem>
                          )}
                        </DropdownMenu>
                      </DropdownMenuTrigger>
                    ) : (
                      <span className="font-mono text-[10px] font-medium text-muted-foreground tabular-nums">
                        V{volCur}{volMax ? `/${volMax}` : ""}
                      </span>
                    )
                  )}

                  {/* Chapter Dropdown */}
                  {canIncrement ? (
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        isDisabled={config.isIncrementDisabled}
                        className="h-5 gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/80 px-1.5 font-mono text-[10px] font-bold text-zinc-100 hover:border-primary/50 hover:bg-zinc-800 backdrop-blur-md select-none transition-colors cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>CH{chCur}{chMax ? `/${chMax}` : ""}</span>
                      </Button>
                      <DropdownMenu placement="bottom start" className="w-auto min-w-[170px] whitespace-nowrap text-[10px] border border-frost bg-frost shadow-2xl backdrop-blur-2xl z-[100]">
                        <DropdownMenuItem onAction={() => config.onIncrement?.(1)} className="whitespace-nowrap text-[10px] py-1 px-2 min-h-6 font-medium">
                          <IconPlus className="size-3 me-1.5 text-primary shrink-0" />
                          +1 Ch
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          id="custom-ch"
                          textValue="Custom chapters"
                          shouldCloseOnSelect={false}
                          className="p-0 focus:bg-transparent focus:outline-none cursor-default min-h-6"
                        >
                          <BorealisProgressCustomInput
                            max={chMax && chMax > chCur ? chMax - chCur : undefined}
                            unit="chs"
                            onApply={(amount) => config.onIncrement?.(amount)}
                          />
                        </DropdownMenuItem>
                        {chMax && chMax > chCur + 1 && (
                          <DropdownMenuItem
                            onAction={() => config.onIncrement?.(chMax - chCur)}
                            className="text-emerald-400 font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                          >
                            <IconCheck className="size-3 me-1.5 text-emerald-400 shrink-0" />
                            Finish Chapters
                          </DropdownMenuItem>
                        )}
                      </DropdownMenu>
                    </DropdownMenuTrigger>
                  ) : (
                    <span className="font-mono text-[10px] font-medium text-muted-foreground tabular-nums">
                      CH{chCur}{chMax ? `/${chMax}` : ""}
                    </span>
                  )}
                </div>
              )
            }

            let progressDisplayLabel = ""
            if (isGameOrOther) {
              progressDisplayLabel = `${data.progress.current} Hours`
            } else {
              progressDisplayLabel = `${data.progress.current}${data.progress.max ? ` / ${data.progress.max}` : ""} ${data.progress.unit ?? "Ep"}`
            }

            return (
              <div className="flex items-center gap-1 ms-auto">
                {canIncrement ? (
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={config.isIncrementDisabled}
                      className="h-5 gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/80 px-1.5 font-mono text-[10px] font-bold text-zinc-100 hover:border-primary/50 hover:bg-zinc-800 backdrop-blur-md select-none transition-colors cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>{progressDisplayLabel}</span>
                    </Button>
                    <DropdownMenu placement="bottom start" className="w-auto min-w-[170px] whitespace-nowrap text-[10px] border border-frost bg-frost shadow-2xl backdrop-blur-2xl z-[100]">
                      {isGameOrOther ? (
                        <>
                          <DropdownMenuItem onAction={() => config.onIncrement?.(1)} className="whitespace-nowrap text-[10px] py-1 px-2 min-h-6 font-medium">
                            <IconPlus className="size-3 me-1.5 text-primary shrink-0" />
                            +1 Hour
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            id="custom-hours"
                            textValue="Custom hours"
                            shouldCloseOnSelect={false}
                            className="p-0 focus:bg-transparent focus:outline-none cursor-default min-h-6"
                          >
                            <BorealisProgressCustomInput
                              unit="hrs"
                              onApply={(amount) => config.onIncrement?.(amount)}
                            />
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onAction={() => config.onIncrement?.(1)} className="whitespace-nowrap text-[10px] py-1 px-2 min-h-6 font-medium">
                            <IconPlus className="size-3 me-1.5 text-primary shrink-0" />
                            +1 {data.progress!.unit}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            id="custom-units"
                            textValue="Custom units"
                            shouldCloseOnSelect={false}
                            className="p-0 focus:bg-transparent focus:outline-none cursor-default min-h-6"
                          >
                            <BorealisProgressCustomInput
                              max={
                                data.progress!.max && data.progress!.max > data.progress!.current
                                  ? data.progress!.max - data.progress!.current
                                  : undefined
                              }
                              unit={data.progress!.unit}
                              onApply={(amount) => config.onIncrement?.(amount)}
                            />
                          </DropdownMenuItem>
                          {data.progress!.max && data.progress!.max > data.progress!.current + 1 && (
                            <DropdownMenuItem
                              onAction={() =>
                                config.onIncrement?.(
                                  data.progress!.max! - data.progress!.current
                                )
                              }
                              className="text-emerald-400 font-semibold whitespace-nowrap text-[10px] py-1 px-2 min-h-6"
                            >
                              <IconCheck className="size-3 me-1.5 text-emerald-400 shrink-0" />
                              Finish Series
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenu>
                  </DropdownMenuTrigger>
                ) : (
                  <span className="font-mono text-[10px] font-medium text-muted-foreground tabular-nums">
                    {progressDisplayLabel}
                  </span>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // 4. Media Metadata Pills / Studio
  if (showMetaPills && (data.metaPills?.length || data.subtext)) {
    return (
      <div
        className={cn(
          "mt-auto flex items-center gap-1 border-t border-border/40 px-1 pt-1.5 pb-0.5 text-[10px] text-muted-foreground",
          className
        )}
      >
        {data.subtext ? (
          <span className="line-clamp-1 truncate font-medium text-muted-foreground/90">
            {data.subtext}
          </span>
        ) : data.metaPills && data.metaPills.length > 0 ? (
          <span className="line-clamp-1 truncate text-muted-foreground/75">
            {data.metaPills.join(" • ")}
          </span>
        ) : null}
      </div>
    )
  }

  return null
}

function formatDateToYmd(val?: any): string {
  if (!val) return ""
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      return val.slice(0, 10)
    }
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  return ""
}

// -----------------------------------------------------------------------------
// Helper: getRepeatLabel for canonical categories
// -----------------------------------------------------------------------------
function getRepeatLabel(category: string): { singular: string; plural: string } {
  const norm = (category || "").toLowerCase()
  switch (norm) {
    case "manga":
    case "book":
    case "books":
      return { singular: "Reread", plural: "Rereads" }
    case "game":
    case "games":
      return { singular: "Replay", plural: "Replays" }
    case "music":
      return { singular: "Relisten", plural: "Relistens" }
    case "other":
      return { singular: "Repeat", plural: "Repeats" }
    case "anime":
    case "tv":
    case "movie":
    case "movies":
    default:
      return { singular: "Rewatch", plural: "Rewatches" }
  }
}

function toBackendMediaType(type: string): string {
  switch (type) {
    case "anime":
      return "ANIME"
    case "manga":
      return "MANGA"
    case "movie":
    case "movies":
      return "MOVIE"
    case "tv":
      return "TV"
    case "game":
    case "games":
      return "GAME"
    case "book":
    case "books":
      return "BOOK"
    case "music":
      return "MUSIC"
    default:
      return "OTHER"
  }
}

function getBackendMediaId(data: any): number {
  if (!data) return 0
  const raw = data.raw ?? {}
  const rawMedia = raw.media ?? raw
  const possible =
    data.media?.id ??
    data.entry?.mediaId ??
    data.entry?.animeId ??
    data.entry?.mangaId ??
    data.entry?.tvId ??
    data.entry?.movieId ??
    data.entry?.gameId ??
    data.entry?.bookId ??
    data.entry?.musicId ??
    rawMedia?.id ??
    raw.mediaId ??
    raw.entry?.mediaId ??
    raw.entry?.animeId ??
    raw.entry?.mangaId ??
    raw.entry?.tvId ??
    raw.entry?.movieId ??
    raw.entry?.gameId ??
    raw.entry?.bookId ??
    raw.entry?.musicId ??
    raw.animeId ??
    raw.mangaId ??
    raw.tvId ??
    raw.movieId ??
    raw.gameId ??
    raw.bookId ??
    raw.musicId ??
    data.mediaId ??
    data.animeId ??
    data.mangaId ??
    data.tvId ??
    data.movieId ??
    data.gameId ??
    data.bookId ??
    data.musicId ??
    data.id

  if (typeof possible === "number") return possible
  if (typeof possible === "string") {
    // If string is e.g. "anime-17" or "17"
    const cleaned = possible.includes("-") ? possible.split("-").pop()! : possible
    const num = parseInt(cleaned, 10)
    return isNaN(num) ? 0 : num
  }
  return 0
}

interface CachedEpisodesData {
  episodes: any[]
  seasons: any[]
  timestamp: number
}

const HOVER_EPISODES_CACHE = new Map<string, CachedEpisodesData>()
const HOVER_EPISODES_INFLIGHT = new Map<string, Promise<{ episodes: any[]; seasons: any[] }>>()
const HOVER_EPISODES_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface MediaHoverExtra {
  relations?: any[]
  similar?: any[]
  description?: string
  gender?: string | null
  age?: string | null
}

const mediaHoverExtraCache = new Map<string, MediaHoverExtra>()
const inFlightMediaHoverExtra = new Map<string, Promise<MediaHoverExtra>>()

function getMediaApiPath(type?: string): string {
  if (!type) return "anime"
  const norm = type.toLowerCase()
  if (norm === "movie" || norm === "movies") return "movies"
  if (norm === "book" || norm === "books") return "books"
  if (norm === "game" || norm === "games") return "games"
  if (norm === "anime") return "anime"
  if (norm === "manga") return "manga"
  if (norm === "tv") return "tv"
  if (norm === "music") return "music"
  return norm
}

function formatEpisodeTitle(
  title: string | null | undefined,
  epNum: number
): string | null {
  if (!title) return null
  const trimmed = title.trim()
  if (!trimmed) return null
  const prefixRegex = new RegExp(
    `^(?:Episode|Ep\\.?|#|s\\d+e|\\d+x)\\s*0*${epNum}\\s*[:\\-–—.]\\s*`,
    "i"
  )
  let cleaned = trimmed.replace(prefixRegex, "").trim()
  const numPrefixRegex = new RegExp(`^0*${epNum}\\s*[:\\-–—.]\\s*`)
  cleaned = cleaned.replace(numPrefixRegex, "").trim()
  const exactRegex = new RegExp(
    `^(?:(?:Episode|Ep\\.?|#|s\\d+e|\\d+x)\\s*)?0*${epNum}$`,
    "i"
  )
  if (exactRegex.test(cleaned) || exactRegex.test(trimmed)) {
    return null
  }
  return cleaned || null
}

function getEpisodeDisplayTitle(
  ep: any,
  epNum: number,
  titlePreference?: "primary" | "secondary" | "native"
): string | null {
  if (!ep) return null

  const candidates: (string | null | undefined)[] = []
  if (titlePreference === "native") {
    candidates.push(ep.titleNative, ep.titleSecondary, ep.titlePrimary, ep.title, ep.name)
  } else if (titlePreference === "secondary") {
    candidates.push(ep.titleSecondary, ep.titlePrimary, ep.titleNative, ep.title, ep.name)
  } else {
    candidates.push(ep.titlePrimary, ep.titleSecondary, ep.titleNative, ep.title, ep.name)
  }

  const validStrings = candidates
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim())

  // 1. Try to find a distinct/meaningful title (stripping redundant "Episode 1:" prefix)
  for (const raw of validStrings) {
    const formatted = formatEpisodeTitle(raw, epNum)
    if (formatted) {
      return formatted
    }
  }

  // 2. Fallback: if all matched "Episode X" or similar, use the raw title unless purely numeric
  for (const raw of validStrings) {
    if (/^#?\s*0*\d+$/.test(raw)) continue
    return raw
  }

  return null
}

// -----------------------------------------------------------------------------
// 5b. BorealisCardHoverEditForm
// -----------------------------------------------------------------------------
function BorealisCardHoverEditForm({
  data,
  config,
  draftStatus,
  setDraftStatus,
  draftScore,
  setDraftScore,
  draftPriority,
  setDraftPriority,
  draftProgress,
  setDraftProgress,
  draftChaptersProgress,
  setDraftChaptersProgress,
  draftVolumesProgress,
  setDraftVolumesProgress,
  draftRewatched,
  setDraftRewatched,
  draftStartedAt,
  setDraftStartedAt,
  draftCompletedAt,
  setDraftCompletedAt,
  draftIsPrivate,
  setDraftIsPrivate,
  draftNotes,
  setDraftNotes,
}: {
  data: any
  config: any
  draftStatus: ListStatus
  setDraftStatus: (st: ListStatus) => void
  draftScore: number | null
  setDraftScore: (sc: number | null) => void
  draftPriority: string
  setDraftPriority: (pr: string) => void
  draftProgress: number
  setDraftProgress: (pr: number) => void
  draftChaptersProgress: number
  setDraftChaptersProgress: (cp: number) => void
  draftVolumesProgress: number
  setDraftVolumesProgress: (vp: number) => void
  draftRewatched: number
  setDraftRewatched: (rw: number) => void
  draftStartedAt: string
  setDraftStartedAt: (dt: string) => void
  draftCompletedAt: string
  setDraftCompletedAt: (dt: string) => void
  draftIsPrivate: boolean
  setDraftIsPrivate: (pr: boolean) => void
  draftNotes: string
  setDraftNotes: (nt: string) => void
}) {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statusDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (statusContainerRef.current && !statusContainerRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [statusDropdownOpen])

  const isMangaOrBook = data.type === "manga" || data.type === "book" || data.type === "books"
  const isGame = data.type === "game" || data.type === "games"
  const isMusic = data.type === "music"
  const isTvOrAnime = data.type === "tv" || data.type === "anime"

  const repeatLabel = getRepeatLabel(data.type).plural

  const maxUnits =
    typeof data.progress?.max === "number" && data.progress.max > 0
      ? data.progress.max
      : typeof data.hoverDetails?.episodeCount === "number" && data.hoverDetails.episodeCount > 0
        ? data.hoverDetails.episodeCount
        : null

  const maxChapters =
    typeof data.progress?.chapterMax === "number" && data.progress.chapterMax > 0
      ? data.progress.chapterMax
      : typeof data.hoverDetails?.chapterCount === "number" && data.hoverDetails.chapterCount > 0
        ? data.hoverDetails.chapterCount
        : null

  const maxVolumes =
    typeof data.progress?.volumeMax === "number" && data.progress.volumeMax > 0
      ? data.progress.volumeMax
      : typeof data.hoverDetails?.volumeCount === "number" && data.hoverDetails.volumeCount > 0
        ? data.hoverDetails.volumeCount
        : null

  const handleStatusChange = (newStatus: ListStatus) => {
    setDraftStatus(newStatus)
    const today = new Date().toISOString().slice(0, 10)

    if (newStatus === "IN_PROGRESS" || newStatus === "ON_HOLD") {
      // IN_PROGRESS then remove endDate, set startDate (if it doesnt exists) same for ON_HOLD
      setDraftCompletedAt("")
      if (!draftStartedAt) {
        setDraftStartedAt(today)
      }
    } else if (newStatus === "DROPPED") {
      // DROPPED then set end date
      if (!draftCompletedAt) {
        setDraftCompletedAt(today)
      }
    } else if (newStatus === "PLANNED" || newStatus === "MAYBE") {
      // PLANNED, MAYBE remove both dates
      setDraftStartedAt("")
      setDraftCompletedAt("")
    } else if (newStatus === "COMPLETED") {
      if (!draftCompletedAt) setDraftCompletedAt(today)
      if (!draftStartedAt) setDraftStartedAt(today)
      if (maxUnits && draftProgress < maxUnits) setDraftProgress(maxUnits)
      if (maxChapters && draftChaptersProgress < maxChapters) setDraftChaptersProgress(maxChapters)
      if (maxVolumes && draftVolumesProgress < maxVolumes) setDraftVolumesProgress(maxVolumes)
    }
  }

  const CurrentStatusIcon = getMediaListStatusIcon(draftStatus)
  const currentStatusColor = getMediaListStatusColor(draftStatus)
  const currentStatusLabel = getMediaListStatusText(draftStatus, data.type)

  return (
    <div className="flex flex-col gap-3 p-4 shrink-0 select-none">
      {/* Row 1: STATUS (Dropdown) | SCORE (with steppers) | REWATCHES (with steppers) */}
      <div className={cn("grid grid-cols-3 gap-2", statusDropdownOpen ? "relative z-50" : "relative z-20")}>
        {/* Status Dropdown - High Z-index with frosted blur surface */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
            <IconActivity className="size-3 shrink-0" />
            <span className="truncate">Status</span>
          </label>
          <div ref={statusContainerRef} className={cn("relative", statusDropdownOpen && "z-50")}>
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-frost bg-frost px-2 text-xs font-semibold text-white transition-colors hover:border-zinc-500 cursor-pointer backdrop-blur-md"
            >
              <div className="flex items-center gap-1.5 truncate">
                <CurrentStatusIcon className={cn("size-3.5 shrink-0", currentStatusColor)} />
                <span className="truncate text-[11px]">{currentStatusLabel}</span>
              </div>
              <IconChevronDown className="size-3 shrink-0 text-zinc-400" />
            </button>
            {statusDropdownOpen && (
              <div
                style={{
                  backgroundColor: "rgba(10, 10, 14, 0.82)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  zIndex: 99999,
                }}
                className="absolute top-full left-0 z-[99999] mt-1 w-48 rounded-2xl border border-frost bg-frost p-1.5 text-zinc-100 shadow-2xl backdrop-blur-2xl"
              >
                {STATUS_DROPDOWN_OPTIONS.map((st) => {
                  const IconComp = getMediaListStatusIcon(st)
                  const stColor = getMediaListStatusColor(st)
                  const label = getMediaListStatusText(st, data.type)
                  const isSelected = draftStatus === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        handleStatusChange(st)
                        setStatusDropdownOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary/25 font-bold text-white shadow-xs"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <IconComp className={cn("size-3.5 shrink-0", stColor)} />
                        <span className="truncate">{label}</span>
                      </div>
                      {isSelected && <IconCheck className="size-3 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Score (0-10) with Increment/Decrement Chevrons - Neutral color matching everything else */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
            <IconStar className="size-3 text-zinc-400 shrink-0" />
            <span className="truncate">Score</span>
          </label>
          <div className="flex h-8 items-center justify-between rounded-lg border border-frost bg-frost/80 px-2 backdrop-blur-md">
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              placeholder="0"
              value={draftScore !== null ? draftScore : ""}
              onChange={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value)
                if (val === null || isNaN(val)) setDraftScore(null)
                else setDraftScore(Math.min(10, Math.max(0, Math.round(val * 10) / 10)))
              }}
              className="w-full bg-transparent font-mono text-xs font-semibold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] font-bold text-zinc-500 pe-1 shrink-0">/10</span>
            <div className="flex flex-col gap-0.5 text-zinc-400 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const cur = draftScore !== null ? draftScore : 0
                  const next = Math.min(10, cur + 0.5)
                  setDraftScore(Math.round(next * 10) / 10)
                }}
                className="cursor-pointer hover:text-white"
                aria-label="Increment score"
              >
                <IconChevronUp className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const cur = draftScore !== null ? draftScore : 0
                  const next = Math.max(0, cur - 0.5)
                  setDraftScore(Math.round(next * 10) / 10)
                }}
                className="cursor-pointer hover:text-white"
                aria-label="Decrement score"
              >
                <IconChevronDown className="size-2.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Rewatches / Repeats with Increment/Decrement Chevrons */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate" title={repeatLabel}>
            <IconRotate2 className="size-3 text-zinc-400 shrink-0" />
            <span className="truncate">{repeatLabel}</span>
          </label>
          <div className="flex h-8 items-center justify-between rounded-lg border border-frost bg-frost/80 px-2 backdrop-blur-md">
            <input
              type="number"
              min={0}
              value={draftRewatched}
              onChange={(e) => setDraftRewatched(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-transparent font-mono text-xs font-semibold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex flex-col gap-0.5 text-zinc-400 shrink-0">
              <button
                type="button"
                onClick={() => setDraftRewatched(draftRewatched + 1)}
                className="cursor-pointer hover:text-white"
                aria-label="Increment repeats"
              >
                <IconChevronUp className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={() => setDraftRewatched(Math.max(0, draftRewatched - 1))}
                className="cursor-pointer hover:text-white"
                aria-label="Decrement repeats"
              >
                <IconChevronDown className="size-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Primary progress | Secondary progress (if only 1 exists then stretch it) */}
      {isMangaOrBook ? (
        <div className="grid grid-cols-2 gap-2 relative z-10">
          {/* Primary: Chapters */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
              <IconBook className="size-3 shrink-0" />
              <span className="truncate">Chapters</span>
            </label>
            <div className="flex h-8 items-center justify-between rounded-lg border border-frost bg-frost/80 px-2 backdrop-blur-md">
              <input
                type="number"
                min={0}
                max={maxChapters || undefined}
                value={draftChaptersProgress}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0)
                  const next = maxChapters ? Math.min(maxChapters, val) : val
                  setDraftChaptersProgress(next)
                  if (maxChapters && next >= maxChapters) {
                    handleStatusChange("COMPLETED")
                  }
                }}
                className="w-full bg-transparent font-mono text-xs font-semibold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {maxChapters ? (
                <span className="text-[10px] font-bold text-zinc-500 pe-1 shrink-0">/ {maxChapters}</span>
              ) : null}
              <div className="flex flex-col gap-0.5 text-zinc-400 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = draftChaptersProgress + 1
                    const clamped = maxChapters ? Math.min(maxChapters, next) : next
                    setDraftChaptersProgress(clamped)
                    if (maxChapters && clamped >= maxChapters) {
                      handleStatusChange("COMPLETED")
                    }
                  }}
                  className="cursor-pointer hover:text-white"
                  aria-label="Increment chapters"
                >
                  <IconChevronUp className="size-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDraftChaptersProgress(Math.max(0, draftChaptersProgress - 1))}
                  className="cursor-pointer hover:text-white"
                  aria-label="Decrement chapters"
                >
                  <IconChevronDown className="size-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Secondary: Volumes */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
              <IconBook2 className="size-3 shrink-0" />
              <span className="truncate">Volumes</span>
            </label>
            <div className="flex h-8 items-center justify-between rounded-lg border border-frost bg-frost/80 px-2 backdrop-blur-md">
              <input
                type="number"
                min={0}
                max={maxVolumes || undefined}
                value={draftVolumesProgress}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0)
                  setDraftVolumesProgress(maxVolumes ? Math.min(maxVolumes, val) : val)
                }}
                className="w-full bg-transparent font-mono text-xs font-semibold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {maxVolumes ? (
                <span className="text-[10px] font-bold text-zinc-500 pe-1 shrink-0">/ {maxVolumes}</span>
              ) : null}
              <div className="flex flex-col gap-0.5 text-zinc-400 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = draftVolumesProgress + 1
                    setDraftVolumesProgress(maxVolumes ? Math.min(maxVolumes, next) : next)
                  }}
                  className="cursor-pointer hover:text-white"
                  aria-label="Increment volumes"
                >
                  <IconChevronUp className="size-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDraftVolumesProgress(Math.max(0, draftVolumesProgress - 1))}
                  className="cursor-pointer hover:text-white"
                  aria-label="Decrement volumes"
                >
                  <IconChevronDown className="size-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : isGame ? (
        <div className="flex flex-col gap-1 w-full relative z-10">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <IconClock className="size-3" />
            <span>Playtime (Hours)</span>
          </label>
          <div className="flex h-8 items-center justify-between rounded-lg border border-frost bg-frost/80 px-2 backdrop-blur-md">
            <input
              type="number"
              min={0}
              placeholder="0"
              value={draftProgress}
              onChange={(e) => setDraftProgress(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-transparent font-mono text-xs font-semibold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] font-bold text-zinc-500 pe-1 shrink-0">hrs</span>
            <div className="flex flex-col gap-0.5 text-zinc-400 shrink-0">
              <button
                type="button"
                onClick={() => setDraftProgress(draftProgress + 1)}
                className="cursor-pointer hover:text-white"
                aria-label="Increment playtime"
              >
                <IconChevronUp className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={() => setDraftProgress(Math.max(0, draftProgress - 1))}
                className="cursor-pointer hover:text-white"
                aria-label="Decrement playtime"
              >
                <IconChevronDown className="size-2.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 w-full relative z-10">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <IconDeviceTv className="size-3" />
            <span>{isTvOrAnime ? "Episodes" : "Progress"}</span>
          </label>
          <div className="flex h-8 items-center justify-between rounded-lg border border-frost bg-frost/80 px-2 backdrop-blur-md">
            <input
              type="number"
              min={0}
              max={maxUnits || undefined}
              placeholder="0"
              value={draftProgress}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value) || 0)
                const next = maxUnits ? Math.min(maxUnits, val) : val
                setDraftProgress(next)
                if (maxUnits && next >= maxUnits) {
                  handleStatusChange("COMPLETED")
                }
              }}
              className="w-full bg-transparent font-mono text-xs font-semibold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {maxUnits ? (
              <span className="text-[10px] font-bold text-zinc-500 pe-1 shrink-0">/ {maxUnits}</span>
            ) : null}
            <div className="flex flex-col gap-0.5 text-zinc-400 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = draftProgress + 1
                  const clamped = maxUnits ? Math.min(maxUnits, next) : next
                  setDraftProgress(clamped)
                  if (maxUnits && clamped >= maxUnits) {
                    handleStatusChange("COMPLETED")
                  }
                }}
                className="cursor-pointer hover:text-white"
                aria-label="Increment episodes"
              >
                <IconChevronUp className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={() => setDraftProgress(Math.max(0, draftProgress - 1))}
                className="cursor-pointer hover:text-white"
                aria-label="Decrement episodes"
              >
                <IconChevronDown className="size-2.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 3: StartDate | End Date with BorealisDatePicker (Calendar component with constraints) */}
      <div className="grid grid-cols-2 gap-2 relative z-0">
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <IconCalendar className="size-3 shrink-0" />
            <span>Start Date</span>
          </label>
          <BorealisDatePicker
            value={draftStartedAt}
            maxValue={draftCompletedAt || undefined}
            onChange={(val) => setDraftStartedAt(val || "")}
            placeholder="Pick date"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <IconCalendar className="size-3 shrink-0" />
            <span>End Date</span>
          </label>
          <BorealisDatePicker
            value={draftCompletedAt}
            minValue={draftStartedAt || undefined}
            onChange={(val) => setDraftCompletedAt(val || "")}
            placeholder="Pick date"
          />
        </div>
      </div>

      {/* Row 4: Privacy Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-frost bg-frost/80 px-2.5 py-1.5 relative z-0 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <IconLock className="size-3.5 text-zinc-400" />
          <span className="text-[11px] font-semibold text-zinc-200">Private Entry</span>
        </div>
        <input
          type="checkbox"
          checked={draftIsPrivate}
          onChange={(e) => setDraftIsPrivate(e.target.checked)}
          className="size-4 rounded border-zinc-700 bg-zinc-900 text-primary accent-primary cursor-pointer"
        />
      </div>

      {/* Row 4b: Priority Segmented Control */}
      <div className="flex flex-col gap-1 relative z-0">
        <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          <IconFlag className="size-3" />
          <span>Priority</span>
        </label>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-frost bg-frost/80 p-1 backdrop-blur-md">
          {(["LOW", "MEDIUM", "HIGH", "ULTRA"] as const).map((p) => {
            const isSelected = (draftPriority || "LOW").toUpperCase() === p
            const label = p === "MEDIUM" ? "Med" : p.charAt(0) + p.slice(1).toLowerCase()
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDraftPriority(p)}
                className={cn(
                  "flex items-center justify-center rounded-lg py-1 text-[11px] font-semibold transition-all cursor-pointer select-none",
                  isSelected
                    ? p === "ULTRA"
                      ? "bg-purple-600/30 text-purple-300 shadow-xs border border-purple-500/50"
                      : p === "HIGH"
                        ? "bg-rose-600/30 text-rose-300 shadow-xs border border-rose-500/50"
                        : p === "MEDIUM"
                          ? "bg-amber-600/30 text-amber-300 shadow-xs border border-amber-500/50"
                          : "bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700/60"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Row 5: Notes */}
      <div className="flex flex-col gap-1 relative z-0">
        <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          <IconFileText className="size-3" />
          <span>Notes</span>
        </label>
        <textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="Personal thoughts or notes..."
          rows={2}
          className="w-full resize-none rounded-lg border border-frost bg-frost/80 p-2 text-xs text-white placeholder:text-zinc-500 focus:border-primary focus:outline-none backdrop-blur-md"
        />
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 5c. BorealisCardHoverEpisodesTab
// -----------------------------------------------------------------------------
const EMPTY_ARRAY: any[] = []

/**
 * Fetches /borealis/anime/:animeId/episodes (cached + deduped) and reports the
 * result through `onData`. Returns a cancel function.
 */
function loadHoverEpisodes(
  animeId: number,
  cacheKey: string,
  onData: (episodes: any[]) => void
): () => void {
  let cancelled = false
  const emit = (eps: any[]) => {
    if (!cancelled) onData(eps)
  }

  const cached = HOVER_EPISODES_CACHE.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < HOVER_EPISODES_CACHE_TTL) {
    emit(cached.episodes)
    return () => {
      cancelled = true
    }
  }

  let promise = HOVER_EPISODES_INFLIGHT.get(cacheKey)
  if (!promise) {
    promise = (async () => {
      const { data: res, error } = await (elysia as any).borealis
        .anime({ animeId })
        .episodes.get()
      if (error) throw error
      return { episodes: ((res as any)?.episodes ?? []) as any[], seasons: [] as any[] }
    })().finally(() => {
      HOVER_EPISODES_INFLIGHT.delete(cacheKey)
    })
    HOVER_EPISODES_INFLIGHT.set(cacheKey, promise)
  }

  promise
    .then((result) => {
      HOVER_EPISODES_CACHE.set(cacheKey, { ...result, timestamp: Date.now() })
      emit(result.episodes)
    })
    .catch(() => { })

  return () => {
    cancelled = true
  }
}

function BorealisCardHoverEpisodesTab({
  data,
  config,
  draftWatchedEpisodes,
  setDraftWatchedEpisodes,
  draftProgress,
  setDraftProgress,
  setDraftStatus,
  onEditStart,
}: {
  data: any
  config: any
  draftWatchedEpisodes: any[]
  setDraftWatchedEpisodes: (list: any[]) => void
  draftProgress: number
  setDraftProgress: (prog: number) => void
  setDraftStatus?: (st: ListStatus) => void
  onEditStart?: () => void
}) {
  const mediaId = getBackendMediaId(data)
  const backendMediaType = toBackendMediaType(data.type)
  const cacheKey = `${backendMediaType}:${mediaId || 0}`

  const rawMedia = data.raw?.media ?? data.raw
  const initialSeasons: any[] = useMemo(() => {
    if (Array.isArray(rawMedia?.seasons)) return rawMedia.seasons
    if (Array.isArray(data.hoverDetails?.seasons)) return data.hoverDetails.seasons
    return EMPTY_ARRAY
  }, [rawMedia?.seasons, data.hoverDetails?.seasons])

  const initialEpisodes: any[] = useMemo(() => {
    if (Array.isArray(rawMedia?.episodes)) return rawMedia.episodes
    if (Array.isArray(data.hoverDetails?.episodes)) return data.hoverDetails.episodes
    return EMPTY_ARRAY
  }, [rawMedia?.episodes, data.hoverDetails?.episodes])

  const [fetchedEpisodes, setFetchedEpisodes] = useState<any[] | null>(
    () => HOVER_EPISODES_CACHE.get(cacheKey)?.episodes ?? null
  )

  useEffect(() => {
    if (backendMediaType !== "ANIME" || !mediaId) return
    return loadHoverEpisodes(mediaId, cacheKey, setFetchedEpisodes)
  }, [cacheKey, mediaId, backendMediaType])

  const seasons: any[] = initialSeasons
  const episodes: any[] =
    fetchedEpisodes && fetchedEpisodes.length > 0 ? fetchedEpisodes : initialEpisodes

  const regularSeasons = seasons.filter((s) => s.seasonNumber > 0)
  const candidateSeasons = regularSeasons.length > 0 ? regularSeasons : seasons
  const hasMultipleSeasons = candidateSeasons.length > 1

  const isEpisodeWatched = (seasonNum: number, epNum: number) => {
    return draftWatchedEpisodes.some(
      (w) => (w.seasonNumber ?? 1) === seasonNum && (w.episodeNumber ?? w.number) === epNum
    )
  }

  // Auto-expand last or currently watched season by default
  const [expandedSeasonNum, setExpandedSeasonNum] = useState<number | null>(() => {
    if (candidateSeasons.length === 0) return null
    if (data.progress?.seasonNumber) {
      const match = candidateSeasons.find((s) => s.seasonNumber === data.progress.seasonNumber)
      if (match) return match.seasonNumber
    }
    // Find first season that has unwatched episodes (in progress)
    for (const s of candidateSeasons) {
      const sNum = s.seasonNumber
      const count = Math.max(s.episodeCount || 0, s.episodes?.length || 0, 0)
      const watched = draftWatchedEpisodes.filter((w) => (w.seasonNumber ?? 1) === sNum).length
      if (count > 0 && watched < count) {
        return sNum
      }
    }
    // If all completed, open the last season
    if (draftWatchedEpisodes.length > 0) {
      return candidateSeasons[candidateSeasons.length - 1].seasonNumber
    }
    return candidateSeasons[0]?.seasonNumber ?? 1
  })

  const toggleSeasonExpanded = (sNum: number) => {
    // Only 1 season modal/accordion can be open at a time
    setExpandedSeasonNum((prev) => (prev === sNum ? null : sNum))
  }

  const totalEpisodeCount =
    typeof data.progress?.max === "number" && data.progress.max > 0
      ? data.progress.max
      : typeof data.hoverDetails?.episodeCount === "number" && data.hoverDetails.episodeCount > 0
        ? data.hoverDetails.episodeCount
        : episodes.length > 0
          ? episodes.length
          : null

  const handleToggleWatched = (seasonNum: number, epNum: number) => {
    if (!config.canEdit) return
    onEditStart?.()

    const watched = isEpisodeWatched(seasonNum, epNum)
    let updated: any[]
    if (watched) {
      updated = draftWatchedEpisodes.filter(
        (w) => !((w.seasonNumber ?? 1) === seasonNum && (w.episodeNumber ?? w.number) === epNum)
      )
    } else {
      updated = [
        ...draftWatchedEpisodes,
        { seasonNumber: seasonNum, episodeNumber: epNum, watchedAt: new Date().toISOString() },
      ]
    }
    setDraftWatchedEpisodes(updated)
    const newCount = updated.length
    setDraftProgress(newCount)

    if (totalEpisodeCount && newCount >= totalEpisodeCount) {
      setDraftStatus?.("COMPLETED")
    }
  }

  const handleAnimeToggle = (epNum: number) => {
    if (!config.canEdit) return
    onEditStart?.()
    const next = epNum === draftProgress ? epNum - 1 : epNum
    setDraftProgress(next)
    if (totalEpisodeCount && next >= totalEpisodeCount) {
      setDraftStatus?.("COMPLETED")
    }
  }

  const titlePreference = config.titlePreference ?? data.titlePreference ?? "primary"

  const episodeMap = useMemo(() => {
    const map = new Map<number, any>()
    for (const ep of episodes) {
      const num = Number(ep.number ?? ep.episodeNumber)
      if (!isNaN(num) && num > 0) {
        map.set(num, ep)
      }
    }
    return map
  }, [episodes])

  return (
    <div className="flex flex-col gap-2 p-3 shrink-0">
      {hasMultipleSeasons ? (
        <div className="max-h-[380px] overflow-y-auto flex flex-col gap-2 pe-1 [scrollbar-width:thin]">
          {candidateSeasons.map((season) => {
            const seasonNum = season.seasonNumber
            const isExpanded = expandedSeasonNum === seasonNum
            const seasonEps = episodes.filter(
              (ep) => (ep.seasonNumber ?? ep.season ?? 1) === seasonNum
            )
            const count = Math.max(
              season.episodeCount || 0,
              season.episodes?.length || 0,
              seasonEps.length || 0
            )
            const watchedInSeason = draftWatchedEpisodes.filter(
              (w) => (w.seasonNumber ?? 1) === seasonNum
            ).length

            const rawTitle = season.title || season.name || season.titlePrimary
            const seasonTitle =
              rawTitle && rawTitle.trim().toLowerCase() !== `season ${seasonNum}`.toLowerCase()
                ? rawTitle.trim()
                : null

            return (
              <div
                key={seasonNum}
                className="shrink-0 min-h-[42px] overflow-hidden rounded-xl border border-frost bg-zinc-900/60 transition-all"
              >
                {/* Season Header Accordion Trigger */}
                <div
                  onClick={() => toggleSeasonExpanded(seasonNum)}
                  className="flex cursor-pointer items-center justify-between gap-2 p-2.5 transition-colors hover:bg-zinc-800/60 select-none"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-zinc-400">
                      {isExpanded ? (
                        <IconChevronDown className="size-4 shrink-0" />
                      ) : (
                        <IconChevronRight className="size-4 shrink-0" />
                      )}
                    </span>
                    <span className="truncate text-xs font-semibold text-white">
                      Season {seasonNum}
                      {seasonTitle ? ` • ${seasonTitle}` : ""}
                    </span>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-300 tabular-nums shrink-0">
                    {watchedInSeason} / {count}
                  </span>
                </div>

                {/* Episodes inside expanded season - Scrollable list */}
                {isExpanded && (
                  count > 0 ? (
                    <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 border-t border-frost bg-zinc-950/40 p-2 pe-1 [scrollbar-width:thin]">
                      {Array.from({ length: count }, (_, idx) => {
                        const epNum = idx + 1
                        const ep =
                          season.episodes?.find(
                            (e: any) => Number(e.episodeNumber ?? e.number) === epNum
                          ) ||
                          seasonEps.find(
                            (e: any) => Number(e.number ?? e.episodeNumber) === epNum
                          ) ||
                          episodeMap.get(epNum)
                        const watched = isEpisodeWatched(seasonNum, epNum)
                        const cleanTitle = getEpisodeDisplayTitle(ep, epNum, titlePreference)

                        return (
                          <button
                            key={epNum}
                            type="button"
                            onClick={() => handleToggleWatched(seasonNum, epNum)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-xs font-medium transition-colors select-none text-start",
                              config.canEdit ? "cursor-pointer" : "cursor-default",
                              watched
                                ? "border-primary/40 bg-primary/10"
                                : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "truncate font-mono text-xs text-primary",
                                  watched ? "font-bold" : "font-semibold"
                                )}
                                title={`#${epNum}${cleanTitle ? ` - ${cleanTitle}` : ""}`}
                              >
                                #{epNum}{cleanTitle ? ` - ${cleanTitle}` : ""}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                watched
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-zinc-700 bg-zinc-950 text-transparent hover:border-zinc-500"
                              )}
                            >
                              {watched && <IconCheck className="size-3 stroke-[2.5]" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-zinc-500">
                      No episodes listed
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      ) : totalEpisodeCount && totalEpisodeCount > 0 ? (
        <div className="max-h-[380px] overflow-y-auto flex flex-col gap-1.5 pe-1 [scrollbar-width:thin]">
          {Array.from({ length: totalEpisodeCount }, (_, idx) => {
            const epNum = idx + 1
            const watched = epNum <= draftProgress
            const epItem = episodeMap.get(epNum)
            const cleanTitle = getEpisodeDisplayTitle(epItem, epNum, titlePreference)

            return (
              <button
                key={epNum}
                type="button"
                onClick={() => handleAnimeToggle(epNum)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-xs font-medium transition-colors select-none text-start",
                  config.canEdit ? "cursor-pointer" : "cursor-default",
                  watched
                    ? "border-primary/40 bg-primary/10"
                    : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "truncate font-mono text-xs text-primary",
                      watched ? "font-bold" : "font-semibold"
                    )}
                    title={`#${epNum}${cleanTitle ? ` - ${cleanTitle}` : ""}`}
                  >
                    #{epNum}{cleanTitle ? ` - ${cleanTitle}` : ""}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    watched
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-zinc-700 bg-zinc-950 text-transparent hover:border-zinc-500"
                  )}
                >
                  {watched && <IconCheck className="size-3 stroke-[2.5]" />}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
          <IconDeviceTv className="size-6 text-zinc-600 mb-1" />
          <span className="text-xs">No episode list available</span>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// 5d. BorealisCardHoverRewatchesTab
// -----------------------------------------------------------------------------
function BorealisCardHoverRewatchesTab({
  data,
  config,
  draftHistory,
  setDraftHistory,
  draftRewatched,
  setDraftRewatched,
  isHoverCardEditing = false,
  onEditStart,
}: {
  data: any
  config: any
  draftHistory: any[]
  setDraftHistory: (h: any[]) => void
  draftRewatched: number
  setDraftRewatched: (rw: number) => void
  isHoverCardEditing?: boolean
  onEditStart?: () => void
}) {
  const repeatLabel = getRepeatLabel(data.type)

  // Ensure sessions list has items up to draftRewatched
  const sessions = useMemo(() => {
    const list = [...draftHistory]
    while (list.length < draftRewatched) {
      list.push({ startedAt: null, completedAt: null, notes: "" })
    }
    return list
  }, [draftHistory, draftRewatched])

  const handleUpdateSession = (idx: number, updates: any) => {
    onEditStart?.()
    const updated = [...sessions]
    updated[idx] = { ...updated[idx], ...updates }
    setDraftHistory(updated)
  }

  const handleRemoveSession = (idx: number) => {
    if (!config.canEdit) return
    onEditStart?.()
    const updated = sessions.filter((_: any, i: number) => i !== idx)
    setDraftHistory(updated)
    setDraftRewatched(updated.length)
  }

  return (
    <div className="flex flex-col gap-3 p-4 shrink-0">
      {sessions.length > 0 ? (
        <div className="max-h-60 overflow-y-auto overscroll-contain flex flex-col gap-2 pe-1 [scrollbar-width:thin]">
          {sessions.map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {repeatLabel.singular} #{idx + 1}
                  {idx === sessions.length - 1 ? (
                    <span className="ms-1.5 text-[10px] font-normal text-primary">
                      (Latest)
                    </span>
                  ) : null}
                </span>
                {isHoverCardEditing && config.canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSession(idx)}
                    className="cursor-pointer text-zinc-500 hover:text-red-400 transition-colors p-0.5"
                    aria-label={`Remove ${repeatLabel.singular} ${idx + 1}`}
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                )}
              </div>

              {isHoverCardEditing ? (
                <>
                  {/* Start Date & End Date Pickers */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-zinc-400">Start Date</span>
                      <BorealisDatePicker
                        value={item.startedAt}
                        maxValue={item.completedAt || undefined}
                        onChange={(d) => handleUpdateSession(idx, { startedAt: d || null })}
                        placeholder="Start date"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-zinc-400">End Date</span>
                      <BorealisDatePicker
                        value={item.completedAt}
                        minValue={item.startedAt || undefined}
                        onChange={(d) => handleUpdateSession(idx, { completedAt: d || null })}
                        placeholder="End date"
                      />
                    </div>
                  </div>

                  {/* Session notes */}
                  <input
                    type="text"
                    value={item.notes || ""}
                    onChange={(e) => handleUpdateSession(idx, { notes: e.target.value })}
                    placeholder="Optional notes for this session..."
                    className="w-full rounded-lg border border-frost bg-frost/80 px-2 py-1 text-xs text-white placeholder:text-zinc-500 backdrop-blur-md focus:border-primary focus:outline-none"
                  />
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                    <IconCalendar className="size-3.5 text-zinc-400 shrink-0" />
                    <span>
                      {item.startedAt || "—"} {item.completedAt ? `→ ${item.completedAt}` : ""}
                    </span>
                  </div>
                  {item.notes ? (
                    <p className="text-xs text-zinc-300 font-sans italic line-clamp-2">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
          <IconRotate2 className="size-6 text-zinc-600 mb-1" />
          <span className="text-xs font-medium text-zinc-400">
            No {repeatLabel.plural.toLowerCase()} recorded yet
          </span>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// 5e. BorealisCardHoverConnectionsTab
// -----------------------------------------------------------------------------
function BorealisCardHoverConnectionsTab({
  data,
  config,
  connections = {},
  onConnectionsChange,
  isHoverCardEditing = false,
  onEditStart,
}: {
  data: any
  config: any
  connections?: Record<string, any>
  onConnectionsChange?: (connections: Record<string, any>) => void
  isHoverCardEditing?: boolean
  onEditStart?: () => void
}) {
  const rawMedia = data.raw?.media ?? data.raw ?? {}

  const availableProviders = useMemo(() => {
    const list: Array<{
      key: string
      name: string
      badgeColor: string
      detectedId: string | number | null
      externalUrl: string | null
    }> = []
    const cat =
      data.type === "movies"
        ? "movie"
        : data.type === "books"
          ? "book"
          : data.type === "games"
            ? "game"
            : data.type

    if (cat === "anime") {
      list.push(
        {
          key: "anilist",
          name: "AniList",
          badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30",
          detectedId: rawMedia.anilistId ?? null,
          externalUrl: rawMedia.anilistId ? `https://anilist.co/anime/${rawMedia.anilistId}` : null,
        },
        {
          key: "mal",
          name: "MyAnimeList",
          badgeColor: "bg-blue-600/20 text-blue-400 border-blue-600/30",
          detectedId: rawMedia.malId ?? null,
          externalUrl: rawMedia.malId ? `https://myanimelist.net/anime/${rawMedia.malId}` : null,
        },
        {
          key: "simkl",
          name: "Simkl",
          badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
          detectedId: rawMedia.simklId ?? null,
          externalUrl: rawMedia.simklId ? `https://simkl.com/anime/${rawMedia.simklId}` : null,
        },
        {
          key: "bangumi",
          name: "Bangumi",
          badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
          detectedId: rawMedia.bangumiId ?? null,
          externalUrl: rawMedia.bangumiId ? `https://bgm.tv/subject/${rawMedia.bangumiId}` : null,
        },
        {
          key: "hikka",
          name: "Hikka",
          badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          detectedId: rawMedia.hikkaId ?? null,
          externalUrl: rawMedia.hikkaId ? `https://hikka.io/anime/${rawMedia.hikkaId}` : null,
        }
      )
    } else if (cat === "manga" || cat === "book" || cat === "novel" || cat === "light_novel") {
      list.push(
        {
          key: "anilist",
          name: "AniList",
          badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30",
          detectedId: rawMedia.anilistId ?? null,
          externalUrl: rawMedia.anilistId ? `https://anilist.co/manga/${rawMedia.anilistId}` : null,
        },
        {
          key: "mal",
          name: "MyAnimeList",
          badgeColor: "bg-blue-600/20 text-blue-400 border-blue-600/30",
          detectedId: rawMedia.malId ?? null,
          externalUrl: rawMedia.malId ? `https://myanimelist.net/manga/${rawMedia.malId}` : null,
        },
        {
          key: "bangumi",
          name: "Bangumi",
          badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
          detectedId: rawMedia.bangumiId ?? null,
          externalUrl: rawMedia.bangumiId ? `https://bgm.tv/subject/${rawMedia.bangumiId}` : null,
        },
        {
          key: "hikka",
          name: "Hikka",
          badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          detectedId: rawMedia.hikkaId ?? null,
          externalUrl: rawMedia.hikkaId ? `https://hikka.io/manga/${rawMedia.hikkaId}` : null,
        },
        {
          key: "mangaupdates",
          name: "MangaUpdates",
          badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
          detectedId: rawMedia.mangaupdatesId ?? null,
          externalUrl: rawMedia.mangaupdatesId ? `https://www.mangaupdates.com/series/${rawMedia.mangaupdatesId}` : null,
        },
        {
          key: "mangabaka",
          name: "MangaBaka",
          badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          detectedId: rawMedia.mangabakaId ?? null,
          externalUrl: rawMedia.mangabakaId ? `https://mangabaka.org/series/${rawMedia.mangabakaId}` : null,
        }
      )
      if (cat === "book") {
        list.push({
          key: "googlebooks",
          name: "Google Books",
          badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
          detectedId: rawMedia.googleBookId ?? null,
          externalUrl: rawMedia.googleBookId ? `https://books.google.com/books?id=${rawMedia.googleBookId}` : null,
        })
      }
    } else if (cat === "tv" || cat === "movie") {
      list.push(
        {
          key: "simkl",
          name: "Simkl",
          badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
          detectedId: rawMedia.simklId ?? null,
          externalUrl: rawMedia.simklId ? `https://simkl.com/${cat === "tv" ? "tv" : "movies"}/${rawMedia.simklId}` : null,
        },
        {
          key: "trakt",
          name: "Trakt",
          badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
          detectedId: rawMedia.traktId ?? null,
          externalUrl: rawMedia.traktId ? `https://trakt.tv/${cat === "tv" ? "shows" : "movies"}/${rawMedia.traktId}` : null,
        },
        {
          key: "tmdb",
          name: "TMDb",
          badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          detectedId: rawMedia.tmdbId ?? null,
          externalUrl: rawMedia.tmdbId ? `https://www.themoviedb.org/${cat === "tv" ? "tv" : "movie"}/${rawMedia.tmdbId}` : null,
        },
        {
          key: "imdb",
          name: "IMDb",
          badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          detectedId: rawMedia.imdbId ?? null,
          externalUrl: rawMedia.imdbId ? `https://www.imdb.com/title/${rawMedia.imdbId}` : null,
        }
      )
    } else if (cat === "game") {
      list.push(
        {
          key: "steam",
          name: "Steam",
          badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/30",
          detectedId: rawMedia.steamId ?? null,
          externalUrl: rawMedia.steamId ? `https://store.steampowered.com/app/${rawMedia.steamId}` : null,
        },
        {
          key: "igdb",
          name: "IGDB",
          badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
          detectedId: rawMedia.igdbId ?? null,
          externalUrl: rawMedia.igdbId ? `https://www.igdb.com/games/${rawMedia.igdbId}` : null,
        },
        {
          key: "bangumi",
          name: "Bangumi",
          badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
          detectedId: rawMedia.bangumiId ?? null,
          externalUrl: rawMedia.bangumiId ? `https://bgm.tv/subject/${rawMedia.bangumiId}` : null,
        }
      )
    } else if (cat === "music") {
      const lastFmUrl = rawMedia.lastFmUrl ?? null
      const lastFmSlug = lastFmUrl ? lastFmUrl.replace(/^https?:\/\/(www\.)?last\.fm\/music\//i, "") : null
      list.push(
        {
          key: "lastfm",
          name: "Last.fm",
          badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
          detectedId: lastFmSlug || rawMedia.musicBrainzId || null,
          externalUrl: lastFmUrl,
        },
        {
          key: "spotify",
          name: "Spotify",
          badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          detectedId: rawMedia.spotifyId ?? null,
          externalUrl: rawMedia.spotifyId ? `https://open.spotify.com/album/${rawMedia.spotifyId}` : null,
        }
      )
    }
    return list
  }, [data.type, rawMedia])

  // Connected providers list
  const connectedProviders = useMemo(() => {
    const map = new Map<string, any>()
    for (const p of availableProviders) {
      if (connections[p.key]) {
        map.set(p.key, {
          ...p,
          connData: connections[p.key],
          url: connections[p.key]?.externalUrl || p.externalUrl,
        })
      }
    }
    // Also include any unknown keys present in connections
    for (const [k, v] of Object.entries(connections)) {
      if (v && !map.has(k)) {
        map.set(k, {
          key: k,
          name: k.charAt(0).toUpperCase() + k.slice(1),
          badgeColor: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
          detectedId: (v as any).id ?? null,
          externalUrl: (v as any).externalUrl ?? null,
          connData: v,
          url: (v as any).externalUrl ?? null,
        })
      }
    }
    return Array.from(map.values())
  }, [availableProviders, connections])

  // Unconnected providers list
  const unconnectedProviders = useMemo(() => {
    return availableProviders.filter((p) => !connections[p.key])
  }, [availableProviders, connections])

  // Inline provider search state
  const [searchProvider, setSearchProvider] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const searchCategoryType = useMemo(() => {
    switch (data.type) {
      case "manga":
      case "book":
      case "books":
      case "novel":
      case "light_novel":
        return "MANGA"
      case "tv":
        return "TV"
      case "movie":
      case "movies":
        return "MOVIE"
      case "game":
      case "games":
        return "GAME"
      case "music":
        return rawMedia.format === "TRACK" ? "TRACK" : "ALBUM"
      default:
        return "ANIME"
    }
  }, [data.type, rawMedia.format])

  const executeSearch = useCallback(
    async (provider: any, queryText: string) => {
      const q = queryText.trim()
      if (!q) return
      setIsSearching(true)
      setSearchError(null)
      try {
        // Explicit ID / URL detection (title search is the default)
        const prefixMatch = q.match(
          /^(?:id:|anilist:|al:|mal:|simkl:|bgm:|bangumi:|hikka:|mu:|mangaupdates:|mb:|mangabaka:|trakt:|imdb:|gb:|googlebooks:|lastfm:|mbid:|#)\s*([^\s/#?]+)$/i
        )
        const urlMatch =
          q.match(/(?:anilist\.co|myanimelist\.net|simkl\.com|hikka\.io|trakt\.tv)\/(?:anime|manga|tv|movies|shows)\/([^/?#\s]+)/i) ||
          q.match(/(?:bgm|bangumi|chii)\.(?:tv|in)\/subject\/(\d+)/i) ||
          q.match(/(?:mangaupdates\.com|mangabaka\.org)\/series\/(\d+)/i) ||
          q.match(/[?&]id=([^&#\s]+)/i)
        const explicitId =
          prefixMatch?.[1] ||
          urlMatch?.[1] ||
          (/^\d+$/.test(q) || /^tt\d+$/i.test(q) ? q : undefined)

        const params = new URLSearchParams({
          provider: provider.key.toUpperCase(),
          q,
          type: searchCategoryType,
        })
        if (explicitId) params.set("id", explicitId)

        let raw: any[] = []
        if ((config as any).onSearchConnections) {
          raw = await (config as any).onSearchConnections(provider.key, q, searchCategoryType)
        }

        const mapped = raw
          .map((r: any, idx: number) => {
            const resolved = r.externalId ?? r.id
            const extId =
              resolved != null && !["", "undefined", "null"].includes(String(resolved).trim())
                ? String(resolved)
                : String(idx)
            const t = r.title
            const title =
              (typeof t === "string" ? t : t?.userPreferred || t?.english || t?.romaji) || "Untitled"
            return {
              externalId: extId,
              title,
              titleSecondary:
                typeof t === "object" && t?.english && t.english !== title
                  ? t.english
                  : typeof t === "object"
                    ? (t?.romaji ?? null)
                    : null,
              coverImage:
                r.coverImage?.extraLarge ||
                r.coverImage?.large ||
                r.coverImage?.medium ||
                (typeof r.coverImage === "string" ? r.coverImage : null),
              releaseYear: r.releaseYear ?? r.year ?? null,
              format: r.format ?? null,
              episodes: r.episodes ?? r.chapters ?? null,
              url: r.url ?? null,
            }
          })
          .filter((r) => r.externalId !== "undefined")

        setSearchResults(mapped)
        if (mapped.length === 0) setSearchError(`No results found on ${provider.name} for "${q}".`)
      } catch (err: any) {
        setSearchResults([])
        setSearchError(err?.message || "Failed to search provider.")
      } finally {
        setIsSearching(false)
      }
    },
    [searchCategoryType]
  )

  const openSearch = (provider: any) => {
    onEditStart?.()
    const initial =
      connections[provider.key]?.title || rawMedia.titlePrimary || data.title || ""
    setSearchProvider(provider)
    setSearchQuery(initial)
    setSearchResults([])
    setSearchError(null)
    if (initial) void executeSearch(provider, initial)
  }

  const handleSelectResult = (provider: any, result: any) => {
    const current = connections[provider.key] || {}
    const coverUrl =
      result.coverImage || current.cover || current.coverImage || data.image || null
    onConnectionsChange?.({
      ...connections,
      [provider.key]: {
        ...current,
        id: result.externalId,
        title: result.title,
        cover: coverUrl,
        coverImage: coverUrl,
        year: result.releaseYear ?? current.year ?? data.hoverDetails?.year ?? null,
        format: result.format ?? current.format ?? rawMedia.format ?? data.hoverDetails?.format ?? null,
        externalUrl: result.url || provider.externalUrl,
        extra: {
          ...(current.extra || {}),
          fetchedExternally: true,
        },
      },
    })
    setSearchProvider(null)
  }

  const handleDisconnect = (key: string) => {
    onEditStart?.()
    const next = { ...connections }
    delete next[key]
    onConnectionsChange?.(next)
  }

  if (searchProvider) {
    const activeId = connections[searchProvider.key]?.id
    return (
      <div className="flex flex-col gap-3 p-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchProvider(null)}
            className="flex size-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Back"
          >
            <IconChevronLeft className="size-3.5" />
          </button>
          <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0", searchProvider.badgeColor)}>
            {searchProvider.name}
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void executeSearch(searchProvider, searchQuery)
          }}
          className="flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <IconSearch className="absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, ID (id:123) or URL..."
              className="h-8 w-full rounded-lg border border-frost bg-frost/80 ps-8 pe-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/60 backdrop-blur-md"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="h-8 shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? <IconLoader2 className="size-3.5 animate-spin" /> : "Search"}
          </button>
        </form>

        <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 pe-1 [scrollbar-width:thin]">
          {isSearching && (
            <div className="flex items-center justify-center py-6 text-zinc-400">
              <IconLoader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!isSearching && searchError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              <IconAlertCircle className="size-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
          {!isSearching &&
            searchResults.map((result, idx) => {
              const isCurrent =
                activeId != null && String(activeId) === String(result.externalId)
              return (
                <div
                  key={`${result.externalId}-${idx}`}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border p-2",
                    isCurrent ? "border-primary/50 bg-primary/10" : "border-zinc-800 bg-zinc-900/60"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {result.coverImage ? (
                      <img
                        src={result.coverImage}
                        alt={result.title}
                        loading="lazy"
                        className="h-12 w-8 shrink-0 rounded-md border border-zinc-700 bg-zinc-800 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-500">
                        <IconPhotoOff className="size-3.5" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-zinc-100">{result.title}</span>
                      {result.titleSecondary && (
                        <span className="truncate text-[10px] text-zinc-400">{result.titleSecondary}</span>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-medium text-zinc-300">
                        {result.format && <span className="uppercase text-zinc-300">{result.format}</span>}
                        {result.releaseYear && <span className="text-zinc-300">{result.releaseYear}</span>}
                        <span className="text-zinc-400">#{result.externalId}</span>
                      </div>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary">
                      <IconCheck className="size-3" />
                      Linked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectResult(searchProvider, result)}
                      className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    >
                      Select
                    </button>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 min-h-0">
      {/* View mode: Render currently connected ones with full details */}
      {!isHoverCardEditing && (
        <div className="max-h-[380px] overflow-y-auto overscroll-contain flex flex-col gap-2 pe-1 [scrollbar-width:thin]">
          {connectedProviders.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {connectedProviders.map((prov) => (
                <div
                  key={prov.key}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {(prov.connData?.cover || prov.connData?.coverImage) && (
                      <img
                        src={prov.connData.cover || prov.connData.coverImage}
                        alt=""
                        loading="lazy"
                        className="h-9 w-6 shrink-0 rounded border border-zinc-700 object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className={cn("inline-flex w-fit items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0", prov.badgeColor)}>
                        {prov.name}
                      </span>
                      <span className="truncate text-xs font-semibold text-zinc-100">
                        {prov.connData?.title || (prov.detectedId ? `ID: ${prov.connData?.id || prov.detectedId}` : "Connected")}
                      </span>
                      {((prov.connData?.id && prov.connData.id !== "linked") || prov.detectedId || prov.connData?.year || prov.connData?.format) && (
                        <span className="truncate font-mono text-[10px] font-medium text-zinc-300">
                          {[prov.connData?.format, prov.connData?.year, prov.connData?.id && prov.connData.id !== "linked" ? `#${prov.connData.id}` : (prov.detectedId ? `#${prov.detectedId}` : null)].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {prov.url && (
                    <a
                      href={prov.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex size-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title={`Open ${prov.name}`}
                      aria-label={`Open ${prov.name}`}
                    >
                      <IconExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
              <IconLink className="size-6 text-zinc-600 mb-1" />
              <span className="text-xs font-medium text-zinc-400">No active connections</span>
            </div>
          )}
        </div>
      )}

      {/* Edit mode: Render currently connected ones + all available ones with Connect/Disconnect options */}
      {isHoverCardEditing && (
        <div className="max-h-[380px] overflow-y-auto overscroll-contain flex flex-col gap-2.5 pe-1 [scrollbar-width:thin]">
          {connectedProviders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {connectedProviders.map((prov) => (
                <div
                  key={prov.key}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {(prov.connData?.cover || prov.connData?.coverImage) && (
                      <img
                        src={prov.connData.cover || prov.connData.coverImage}
                        alt=""
                        loading="lazy"
                        className="h-9 w-6 shrink-0 rounded border border-zinc-700 object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className={cn("inline-flex w-fit items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0", prov.badgeColor)}>
                        {prov.name}
                      </span>
                      <span className="truncate text-xs font-semibold text-zinc-100">
                        {prov.connData?.title || (prov.detectedId ? `ID: ${prov.connData?.id || prov.detectedId}` : "Linked")}
                      </span>
                      {((prov.connData?.id && prov.connData.id !== "linked") || prov.detectedId || prov.connData?.year || prov.connData?.format) && (
                        <span className="truncate font-mono text-[10px] font-medium text-zinc-300">
                          {[prov.connData?.format, prov.connData?.year, prov.connData?.id && prov.connData.id !== "linked" ? `#${prov.connData.id}` : (prov.detectedId ? `#${prov.detectedId}` : null)].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openSearch(prov)}
                      className="flex size-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors cursor-pointer"
                      title={`Change ${prov.name} link`}
                      aria-label={`Change ${prov.name} link`}
                    >
                      <IconSearch className="size-3.5" />
                    </button>
                    {prov.url && (
                      <a
                        href={prov.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex size-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors shrink-0"
                        title={`Open ${prov.name}`}
                        aria-label={`Open ${prov.name}`}
                      >
                        <IconExternalLink className="size-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDisconnect(prov.key)}
                      className="flex size-7 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors cursor-pointer"
                      title={`Disconnect ${prov.name}`}
                      aria-label={`Disconnect ${prov.name}`}
                    >
                      <IconX className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {connectedProviders.length > 0 && unconnectedProviders.length > 0 && (
            <div className="border-t border-zinc-800 my-0.5" />
          )}

          {unconnectedProviders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {unconnectedProviders.map((prov) => (
                <div
                  key={prov.key}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0", prov.badgeColor)}>
                      {prov.name}
                    </span>
                    {prov.detectedId && (
                      <span className="truncate font-mono text-[11px] text-zinc-300 font-medium">
                        Detected: {prov.detectedId}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openSearch(prov)}
                    className="flex h-7 items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <IconPlus className="size-3.5" />
                    <span>Connect</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// 5f. BorealisCardHoverWatchlistsTab
// -----------------------------------------------------------------------------
interface CachedPlaylistsData {
  lists: Array<{ id: string; name: string; isPrivate: boolean; entriesCount: number; containsMedia?: boolean }>
  timestamp: number
}

const HOVER_PLAYLISTS_CACHE = new Map<string, CachedPlaylistsData>()
const HOVER_PLAYLISTS_INFLIGHT = new Map<string, Promise<any[]>>()
const HOVER_PLAYLISTS_CACHE_TTL = 60 * 1000 // 60 seconds

function BorealisCardHoverWatchlistsTab({
  data,
  config,
  isHoverCardEditing = false,
  onEditStart,
  listChanges,
  setListChanges,
  newLists,
  setNewLists,
  refreshKey = 0,
}: {
  data: any
  config: any
  isHoverCardEditing?: boolean
  onEditStart?: () => void
  listChanges: Record<string, boolean>
  setListChanges: (c: Record<string, boolean>) => void
  newLists: string[]
  setNewLists: (n: string[]) => void
  refreshKey?: number
}) {
  const mediaId = getBackendMediaId(data)
  const backendMediaType = toBackendMediaType(data.type)
  const cacheKey = `${backendMediaType}:${mediaId || 0}`

  const [lists, setLists] = useState<
    Array<{ id: string; name: string; isPrivate: boolean; entriesCount: number; containsMedia?: boolean }>
  >(() => {
    const cached = HOVER_PLAYLISTS_CACHE.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < HOVER_PLAYLISTS_CACHE_TTL) {
      return cached.lists
    }
    return []
  })
  const [loading, setLoading] = useState(() => {
    const cached = HOVER_PLAYLISTS_CACHE.get(cacheKey)
    return !(cached && Date.now() - cached.timestamp < HOVER_PLAYLISTS_CACHE_TTL)
  })
  const [newName, setNewName] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mediaId) {
      setLoading(false)
      return
    }
    const cached = HOVER_PLAYLISTS_CACHE.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < HOVER_PLAYLISTS_CACHE_TTL && refreshKey === 0) {
      setLists(cached.lists)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    let promise = HOVER_PLAYLISTS_INFLIGHT.get(cacheKey)
    if (!promise || refreshKey > 0) {
      promise = (async () => {
        const { data: res, error: err } = await (elysia as any).borealis.playlists.get({
          query: { mediaType: backendMediaType, mediaId, limit: 100 },
        })
        if (err) throw err
        return ((res as any)?.playlists ?? []) as any[]
      })().finally(() => {
        HOVER_PLAYLISTS_INFLIGHT.delete(cacheKey)
      })
      HOVER_PLAYLISTS_INFLIGHT.set(cacheKey, promise)
    }

    promise
      .then((fetched) => {
        HOVER_PLAYLISTS_CACHE.set(cacheKey, { lists: fetched, timestamp: Date.now() })
        if (!cancelled) setLists(fetched)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load custom lists")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey, mediaId, backendMediaType, refreshKey])

  const [operatingIds, setOperatingIds] = useState<Record<string, boolean>>({})
  const [isCreatingList, setIsCreatingList] = useState(false)

  const isChecked = (l: (typeof lists)[number]) =>
    Boolean(l.containsMedia)

  const toggle = async (list: (typeof lists)[number]) => {
    if (operatingIds[list.id]) return
    const currentlyChecked = isChecked(list)
    const next = !currentlyChecked

    const updated = lists.map((l) =>
      l.id === list.id
        ? {
          ...l,
          containsMedia: next,
          entriesCount: next ? l.entriesCount + 1 : Math.max(0, l.entriesCount - 1),
        }
        : l
    )
    setLists(updated)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name || isCreatingList) return

    const tempId = `temp-${Date.now()}`
    const updated = [
      {
        id: tempId,
        name,
        isPrivate: false,
        entriesCount: 1,
        containsMedia: true,
      },
      ...lists,
    ]
    setLists(updated)
    setNewName("")
  }

  const canEdit = config?.canEdit !== false

  return (
    <div className="flex flex-col gap-2 p-4 shrink-0">
      {canEdit && isHoverCardEditing && (
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list name..."
            disabled={isCreatingList}
            className="h-8 min-w-0 flex-1 rounded-lg border border-frost bg-frost/80 px-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/60 backdrop-blur-md"
          />
          <button
            type="submit"
            disabled={!newName.trim() || isCreatingList}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            {isCreatingList ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconPlus className="size-3.5" />
            )}
            <span>Create</span>
          </button>
        </form>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
          <IconAlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <IconLoader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : lists.length > 0 ? (
        <div className="flex flex-col gap-1.5 pe-1">
          {lists.map((wl) => {
            const checked = isChecked(wl)
            const isOperating = Boolean(operatingIds[wl.id])
            return (
              <div
                key={wl.id}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconFolder className="size-4 text-primary shrink-0" />
                  <span className="truncate text-xs font-semibold text-zinc-100">{wl.name}</span>
                  {wl.isPrivate && <IconLock className="size-3 text-zinc-400 shrink-0" />}
                  <span className="font-mono text-[10px] text-zinc-300 font-medium shrink-0">{wl.entriesCount}</span>
                </div>
                {canEdit && isHoverCardEditing ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={`Include in ${wl.name}`}
                    disabled={isOperating}
                    onClick={() => toggle(wl)}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-50",
                      checked
                        ? "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                        : "border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
                    )}
                  >
                    {isOperating ? (
                      <IconLoader2 className="size-3.5 animate-spin" />
                    ) : checked ? (
                      <IconCheck className="size-3.5 stroke-[3]" />
                    ) : (
                      <IconPlus className="size-3.5" />
                    )}
                  </button>
                ) : checked ? (
                  <div
                    className="flex size-7 shrink-0 items-center justify-center text-primary"
                    title="Included in list"
                  >
                    <IconCheck className="size-4 stroke-[2.5]" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
          <IconFolder className="size-6 text-zinc-600 mb-1" />
          <span className="text-xs font-medium text-zinc-400">No custom lists</span>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// 5. BorealisCard.HoverContent
// -----------------------------------------------------------------------------
export function BorealisCardHoverContent({
  className,
  placement,
}: BorealisCardHoverContentProps) {
  const {
    data,
    config,
    isHovered,
    popoverPlacement,
    containerRef,
    handleMouseEnter,
    handleMouseLeave,
    setLocalScore,
    setLocalStatus,
    setLocalProgress,
    isHoverCardEditing,
    setIsHoverCardEditing,
  } = useBorealisCard()

  const [activeTab, setActiveTab] = useState<
    "general" | "episodes" | "repeats" | "connections" | "watchlists"
  >("general")

  const rawEntry = data.raw?.entry ?? data.raw?.listEntry ?? data.raw
  const rawMedia = data.raw?.media ?? data.raw

  // Central Draft State shared across General, Episodes, and Rewatches tabs
  const [draftStatus, setDraftStatus] = useState<ListStatus>(() => {
    return normalizeListStatus(rawEntry?.status ?? data.hoverDetails?.listStatus) ?? "IN_PROGRESS"
  })

  const [draftScore, setDraftScore] = useState<number | null>(() => {
    const s = rawEntry?.score ?? data.hoverDetails?.userScore
    return typeof s === "number" && s > 0 ? (s > 10 ? s / 10 : s) : null
  })

  const maxUnits =
    typeof data.progress?.max === "number" && data.progress.max > 0
      ? data.progress.max
      : typeof data.hoverDetails?.episodeCount === "number" && data.hoverDetails.episodeCount > 0
        ? data.hoverDetails.episodeCount
        : null

  const maxChapters =
    typeof data.progress?.chapterMax === "number" && data.progress.chapterMax > 0
      ? data.progress.chapterMax
      : typeof data.hoverDetails?.chapterCount === "number" && data.hoverDetails.chapterCount > 0
        ? data.hoverDetails.chapterCount
        : null

  const maxVolumes =
    typeof data.progress?.volumeMax === "number" && data.progress.volumeMax > 0
      ? data.progress.volumeMax
      : typeof data.hoverDetails?.volumeCount === "number" && data.hoverDetails.volumeCount > 0
        ? data.hoverDetails.volumeCount
        : null

  const [draftProgress, setDraftProgress] = useState<number>(() => {
    const p = data.progress?.current ?? rawEntry?.progress ?? 0
    return maxUnits ? Math.min(maxUnits, p) : p
  })

  const [draftChaptersProgress, setDraftChaptersProgress] = useState<number>(() => {
    const cp = data.progress?.chapterCurrent ?? rawEntry?.chaptersProgress ?? rawEntry?.progressChapters ?? 0
    return maxChapters ? Math.min(maxChapters, cp) : cp
  })

  const [draftVolumesProgress, setDraftVolumesProgress] = useState<number>(() => {
    const vp = data.progress?.volumeCurrent ?? rawEntry?.volumesProgress ?? rawEntry?.progressVolumes ?? 0
    return maxVolumes ? Math.min(maxVolumes, vp) : vp
  })

  const initialHistory = useMemo(() => {
    const raw =
      rawEntry?.rereadHistory ??
      rawEntry?.rewatchHistory ??
      rawEntry?.replayHistory ??
      []
    let list: any[] = []
    if (Array.isArray(raw)) {
      list = raw
    } else if (typeof raw === "string") {
      try {
        let parsed = JSON.parse(raw)
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed)
          } catch { }
        }
        if (Array.isArray(parsed)) list = parsed
      } catch { }
    }
    return list.map((item: any) => ({
      ...item,
      startedAt: formatDateToYmd(item.startedAt),
      completedAt: formatDateToYmd(item.completedAt),
    }))
  }, [rawEntry])

  const [draftHistory, setDraftHistory] = useState<any[]>(() => initialHistory)

  const [draftRewatched, setDraftRewatched] = useState<number>(() => {
    const r = rawEntry?.rewatched ?? rawEntry?.reread ?? rawEntry?.replayed ?? rawEntry?.playCount ?? 0
    return Math.max(Number(r) || 0, initialHistory.length)
  })

  const [draftStartedAt, setDraftStartedAt] = useState<string>(() => {
    return formatDateToYmd(rawEntry?.startedAt)
  })

  const [draftCompletedAt, setDraftCompletedAt] = useState<string>(() => {
    return formatDateToYmd(rawEntry?.completedAt)
  })

  const [draftIsPrivate, setDraftIsPrivate] = useState<boolean>(() => {
    return Boolean(rawEntry?.private ?? rawEntry?.isPrivate ?? false)
  })

  const [draftPriority, setDraftPriority] = useState<string>(() => {
    return (rawEntry?.priority ?? "LOW").toUpperCase()
  })

  const [draftNotes, setDraftNotes] = useState<string>(() => {
    return rawEntry?.notes ?? ""
  })

  const [draftWatchedEpisodes, setDraftWatchedEpisodes] = useState<any[]>(() => {
    if (Array.isArray(rawEntry?.watchedEpisodes) && rawEntry.watchedEpisodes.length > 0) {
      return rawEntry.watchedEpisodes
    }
    const seasonsList: any[] = Array.isArray(rawMedia?.seasons)
      ? rawMedia.seasons
      : Array.isArray(data.hoverDetails?.seasons)
        ? data.hoverDetails.seasons
        : []
    const regularSeasons = seasonsList.filter((s: any) => s.seasonNumber > 0)
    const list = regularSeasons.length > 0 ? regularSeasons : seasonsList
    const curProg = Number(data.progress?.current ?? rawEntry?.progress ?? 0)
    if (list.length > 0 && curProg > 0) {
      const synthesized: any[] = []
      let rem = curProg
      const now = new Date().toISOString()
      for (const s of list) {
        if (rem <= 0) break
        const count = s.episodes?.length || s.episodeCount || 0
        const take = count > 0 ? Math.min(rem, count) : rem
        for (let ep = 1; ep <= take; ep++) {
          synthesized.push({
            seasonNumber: s.seasonNumber,
            episodeNumber: ep,
            watchedAt: now,
          })
        }
        rem -= take
      }
      return synthesized
    }
    return []
  })

  const [draftConnections, setDraftConnections] = useState<Record<string, any>>(() => {
    const c = rawEntry?.connections ?? data.hoverDetails?.connections
    if (c && typeof c === "object" && !Array.isArray(c)) {
      return { ...c }
    }
    return {}
  })

  const [draftListChanges, setDraftListChanges] = useState<Record<string, boolean>>({})
  const [draftNewLists, setDraftNewLists] = useState<string[]>([])
  const [playlistRefreshKey, setPlaylistRefreshKey] = useState<number>(0)

  const [isSaving, setIsSaving] = useState(false)

  // Only auto-complete when progress is actively increased by the user to reach or exceed maxCount
  const prevProgRef = useRef({ progress: draftProgress, chapters: draftChaptersProgress })
  useEffect(() => {
    const prev = prevProgRef.current
    const progIncreased = draftProgress > prev.progress || draftChaptersProgress > prev.chapters
    prevProgRef.current = { progress: draftProgress, chapters: draftChaptersProgress }

    if (progIncreased) {
      if (
        ((maxUnits && draftProgress >= maxUnits) ||
          (maxChapters && draftChaptersProgress >= maxChapters)) &&
        draftStatus !== "COMPLETED"
      ) {
        setDraftStatus("COMPLETED")
        const today = new Date().toISOString().slice(0, 10)
        if (!draftCompletedAt) setDraftCompletedAt(today)
        if (!draftStartedAt) setDraftStartedAt(today)
      }
    }
  }, [draftProgress, draftChaptersProgress, maxUnits, maxChapters, draftStatus, draftCompletedAt, draftStartedAt])

  useEffect(() => {
    if (!isHoverCardEditing) {
      setDraftNotes(rawEntry?.notes ?? "")
      setDraftStartedAt(formatDateToYmd(rawEntry?.startedAt))
      setDraftCompletedAt(formatDateToYmd(rawEntry?.completedAt))
      setDraftIsPrivate(Boolean(rawEntry?.private ?? rawEntry?.isPrivate ?? false))
      setDraftPriority((rawEntry?.priority ?? "LOW").toUpperCase())
    }
  }, [
    isHoverCardEditing,
    rawEntry?.notes,
    rawEntry?.startedAt,
    rawEntry?.completedAt,
    rawEntry?.private,
    rawEntry?.isPrivate,
    rawEntry?.priority,
  ])

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const payload: BorealisCardSavePayload = {
        status: draftStatus,
        priority: draftPriority,
        score: draftScore !== null && draftScore > 0 ? Math.round(Number(draftScore) * 10) / 10 : null,
        progress: draftProgress,
        chaptersProgress: draftChaptersProgress,
        volumesProgress: draftVolumesProgress,
        startedAt: draftStartedAt || null,
        completedAt: draftCompletedAt || null,
        rewatched: draftRewatched,
        isPrivate: draftIsPrivate,
        notes: draftNotes || null,
        watchedEpisodes: draftWatchedEpisodes,
        rewatchHistory: draftHistory,
        rereadHistory: draftHistory,
        connections: Object.keys(draftConnections).length > 0 ? draftConnections : null,
      }

      if (config.onSaveEntry) {
        await config.onSaveEntry(payload)
      }

      setDraftListChanges({})
      setDraftNewLists([])
      setPlaylistRefreshKey((k) => k + 1)


      setLocalScore?.(payload.score)
      setLocalStatus?.(payload.status)
      setLocalProgress?.(payload.progress)
      setIsHoverCardEditing?.(false)
    } catch (err: any) {
      console.error("Failed to save entry from hover card:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setDraftStatus(normalizeListStatus(rawEntry?.status ?? data.hoverDetails?.listStatus) ?? "IN_PROGRESS")
    const s = rawEntry?.score ?? data.hoverDetails?.userScore
    setDraftScore(typeof s === "number" && s > 0 ? (s > 10 ? s / 10 : s) : null)
    setDraftProgress(data.progress?.current ?? rawEntry?.progress ?? 0)
    setDraftChaptersProgress(data.progress?.chapterCurrent ?? rawEntry?.chaptersProgress ?? rawEntry?.progressChapters ?? 0)
    setDraftVolumesProgress(data.progress?.volumeCurrent ?? rawEntry?.volumesProgress ?? rawEntry?.progressVolumes ?? 0)
    setDraftHistory(initialHistory)
    setDraftRewatched(Math.max(Number(rawEntry?.rewatched ?? rawEntry?.reread ?? rawEntry?.replayed ?? 0), initialHistory.length))
    setDraftStartedAt(formatDateToYmd(rawEntry?.startedAt))
    setDraftCompletedAt(formatDateToYmd(rawEntry?.completedAt))
    setDraftIsPrivate(Boolean(rawEntry?.private ?? rawEntry?.isPrivate ?? false))
    setDraftNotes(rawEntry?.notes ?? "")
    setDraftWatchedEpisodes(Array.isArray(rawEntry?.watchedEpisodes) ? rawEntry.watchedEpisodes : [])
    const c = rawEntry?.connections ?? data.hoverDetails?.connections
    setDraftConnections(c && typeof c === "object" && !Array.isArray(c) ? { ...c } : {})
    setDraftListChanges({})
    setDraftNewLists([])
    setIsHoverCardEditing?.(false)
  }

  const mediaId = Number(
    rawMedia?.id ||
    data.id ||
    (rawEntry as any)?.animeId ||
    (rawEntry as any)?.mangaId ||
    (rawEntry as any)?.movieId ||
    (rawEntry as any)?.tvId ||
    (rawEntry as any)?.gameId ||
    (rawEntry as any)?.bookId ||
    (rawEntry as any)?.musicId ||
    (rawEntry as any)?.otherId
  )

  const effectiveDescription =
    data.hoverDetails?.description || rawMedia?.description || data.description || null
  const effectiveGender =
    data.hoverDetails?.gender || (data as any)?.gender || rawMedia?.gender || null
  const effectiveAge =
    data.hoverDetails?.age || (data as any)?.age || rawMedia?.age || null

  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    maxHeight: number
    placement: "left" | "right"
  } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if ((!isHovered && !isHoverCardEditing) || !containerRef?.current || typeof window === "undefined") {
      if (!isHoverCardEditing) {
        setCoords(null)
      }
      return
    }

    const updatePosition = () => {
      if (!containerRef?.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const popoverWidth = Math.min(384, viewportWidth - 24)
      const gap = 14

      const spaceRight = viewportWidth - rect.right
      const spaceLeft = rect.left

      const requestedPlacement = placement ?? popoverPlacement
      let chosenPlacement: "left" | "right" =
        requestedPlacement === "left" ? "left" : "right"

      // Automatically place on the side that has sufficient space, avoiding clipping
      if (
        chosenPlacement === "right" &&
        spaceRight < popoverWidth + gap &&
        spaceLeft >= popoverWidth + gap
      ) {
        chosenPlacement = "left"
      } else if (
        chosenPlacement === "left" &&
        spaceLeft < popoverWidth + gap &&
        spaceRight >= popoverWidth + gap
      ) {
        chosenPlacement = "right"
      }

      let left = 0
      if (chosenPlacement === "right") {
        left = rect.right + gap
      } else {
        left = rect.left - popoverWidth - gap
      }

      // Clamp left within viewport bounds
      left = Math.max(12, Math.min(left, viewportWidth - popoverWidth - 12))

      // Vertical placement: measure popover if available, else conservative fallback
      const measuredHeight = popoverRef.current?.offsetHeight ?? 480
      const maxAllowedHeight = Math.max(180, viewportHeight - 32)
      const targetHeight = Math.min(measuredHeight, maxAllowedHeight)

      let top = rect.top
      // If hovering near the bottom of the viewport, shift up so popover is 100% visible
      if (top + targetHeight > viewportHeight - 16) {
        top = viewportHeight - targetHeight - 16
      }
      top = Math.max(16, top)
      const maxHeight = Math.max(180, viewportHeight - top - 16)

      setCoords({ top, left, maxHeight, placement: chosenPlacement })
    }

    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && popoverRef.current) {
      observer = new ResizeObserver(() => {
        updatePosition()
      })
      observer.observe(popoverRef.current)
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
      observer?.disconnect()
    }
  }, [isHovered, isHoverCardEditing, containerRef, placement, popoverPlacement])

  // Synchronously adjust coords if popover DOM height shifts after render
  useEffect(() => {
    if ((isHovered || isHoverCardEditing) && popoverRef.current && containerRef?.current && typeof window !== "undefined") {
      const rect = containerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const measuredHeight = popoverRef.current.offsetHeight
      const maxAllowedHeight = Math.max(180, viewportHeight - 32)
      const targetHeight = Math.min(measuredHeight, maxAllowedHeight)

      let top = rect.top
      if (top + targetHeight > viewportHeight - 16) {
        top = viewportHeight - targetHeight - 16
      }
      top = Math.max(16, top)
      const maxHeight = Math.max(180, viewportHeight - top - 16)

      setCoords((prev) => {
        if (!prev) return null
        if (Math.abs(prev.top - top) < 1 && Math.abs(prev.maxHeight - maxHeight) < 1) {
          return prev
        }
        return { ...prev, top, maxHeight }
      })
    }
  })

  if (!config.showHoverCard || (!isHovered && !isHoverCardEditing) || !mounted || !coords) {
    return null
  }

  const details = data.hoverDetails
  // Remove subtitle from hoverCard by default as requested
  const shouldShowSubtitle = config.showHoverSubtitle === true

  const showEpisodesTab =
    data.type === "tv" ||
    data.type === "anime" ||
    Boolean(
      data.hoverDetails?.episodeCount ||
      rawMedia?.episodes ||
      rawMedia?.seasons
    )
  const showRepeatsTab = data.type !== "music"
  const showConnectionsTab = data.type !== "other"
  const repeatLabel = getRepeatLabel(data.type)

  const relationsCount = Array.isArray(rawMedia?.relations)
    ? rawMedia.relations.length
    : Array.isArray(data.hoverDetails?.relations)
      ? data.hoverDetails.relations.length
      : 0
  const watchlists: any[] = Array.isArray(rawEntry?.watchlists)
    ? rawEntry.watchlists
    : Array.isArray(rawEntry?.customLists)
      ? rawEntry.customLists
      : []
  const watchlistsCount = watchlists.length

  const totalEpisodeCount = data.hoverDetails?.episodeCount ?? rawMedia?.episodeCount ?? data.progress?.max

  const editActions = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isSaving}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleSave()
        }}
        className="flex size-7 items-center justify-center rounded-lg !bg-white !text-zinc-950 font-bold hover:!bg-zinc-200 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        style={{ backgroundColor: "#ffffff", color: "#09090b" }}
        aria-label="Save"
        title="Save"
      >
        {isSaving ? (
          <IconLoader2 className="size-3.5 animate-spin" />
        ) : (
          <IconCheck className="size-3.5 stroke-[2.5]" />
        )}
      </button>
      <button
        type="button"
        disabled={isSaving}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleCancel()
        }}
        className="flex size-7 items-center justify-center rounded-lg border border-frost bg-frost/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer disabled:opacity-50 backdrop-blur-md"
        aria-label="Cancel"
        title="Cancel"
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  )

  const content = (
    <div
      ref={popoverRef}
      role="tooltip"
      onClick={(e) => {
        e.stopPropagation()
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => {
        if (!isHoverCardEditing) {
          handleMouseLeave()
        }
      }}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        maxHeight: `${coords.maxHeight}px`,
        zIndex: 9999,
      }}
      className={cn(
        "flex w-80 max-w-[calc(100vw-24px)] sm:w-96 h-auto min-h-0 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-frost bg-frost text-zinc-100 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150 select-text cursor-auto pointer-events-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]",
        className
      )}
    >
      {/* Invisible Hover Bridge spanning the 14px gap between card & popover - strictly outside popover */}
      <div
        className={cn(
          "absolute top-0 bottom-0 pointer-events-auto bg-transparent z-0",
          coords.placement === "right" ? "-left-[14px] w-[14px]" : "-right-[14px] w-[14px]"
        )}
        aria-hidden="true"
      />

      {/* Banner Backdrop or blurred scaled coverImage fallback */}
      {(() => {
        const isPersonOrCharacter =
          data.type === "character" ||
          data.type === "characters" ||
          data.type === "staff" ||
          data.type === "people"
        if (isPersonOrCharacter) return null

        const heroBanner = details?.bannerImage
        const heroCover =
          data.image ||
          details?.coverImage ||
          (rawMedia as any)?.coverImage ||
          (rawMedia as any)?.posterImage
        const activeHero = heroBanner || heroCover

        if (!activeHero) return null

        return (
          <div className="relative h-28 w-full shrink-0 overflow-hidden bg-muted rounded-t-2xl">
            <img
              src={activeHero}
              alt=""
              className={cn(
                "size-full object-cover",
                !heroBanner && "scale-125 blur-md brightness-60"
              )}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          </div>
        )
      })()}

      {/* Tabs Icon Navigation Bar - Active tab expands icon with text label (only visible when showTabNav is true) */}
      {config.showTabNav && (
        <div className="relative z-20 flex items-center justify-between gap-1 border-b border-frost bg-frost/80 px-2.5 py-1.5 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              title="General"
              aria-label="General"
              className={cn(
                "relative z-20 flex h-7 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer border select-none backdrop-blur-md",
                activeTab === "general"
                  ? "border-zinc-700/80 bg-zinc-800/80 text-zinc-100 shadow-xs px-2.5"
                  : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 px-2"
              )}
            >
              <IconLayoutGrid className="size-4 shrink-0" />
              {activeTab === "general" && <span className="whitespace-nowrap">General</span>}
            </button>
            {showEpisodesTab && (
              <button
                type="button"
                onClick={() => setActiveTab("episodes")}
                title="Episodes"
                aria-label="Episodes"
                className={cn(
                  "relative z-20 flex h-7 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer border select-none backdrop-blur-md",
                  activeTab === "episodes"
                    ? "border-zinc-700/80 bg-zinc-800/80 text-zinc-100 shadow-xs px-2.5"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 px-2"
                )}
              >
                <IconDeviceTv className="size-4 shrink-0" />
                {activeTab === "episodes" && <span className="whitespace-nowrap">Episodes</span>}
              </button>
            )}
            {showRepeatsTab && (
              <button
                type="button"
                onClick={() => setActiveTab("repeats")}
                title={repeatLabel.plural}
                aria-label={repeatLabel.plural}
                className={cn(
                  "relative z-20 flex h-7 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer border select-none backdrop-blur-md",
                  activeTab === "repeats"
                    ? "border-zinc-700/80 bg-zinc-800/80 text-zinc-100 shadow-xs px-2.5"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 px-2"
                )}
              >
                <IconRotate2 className="size-4 shrink-0" />
                {activeTab === "repeats" && <span className="whitespace-nowrap">{repeatLabel.plural}</span>}
              </button>
            )}
            {showConnectionsTab && (
              <button
                type="button"
                onClick={() => setActiveTab("connections")}
                title="Connections"
                aria-label="Connections"
                className={cn(
                  "relative z-20 flex h-7 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer border select-none backdrop-blur-md",
                  activeTab === "connections"
                    ? "border-zinc-700/80 bg-zinc-800/80 text-zinc-100 shadow-xs px-2.5"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 px-2"
                )}
              >
                <IconLink className="size-4 shrink-0" />
                {activeTab === "connections" && <span className="whitespace-nowrap">Connections</span>}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("watchlists")}
              title="Custom Lists"
              aria-label="Custom Lists"
              className={cn(
                "relative z-20 flex h-7 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer border select-none backdrop-blur-md",
                activeTab === "watchlists"
                  ? "border-zinc-700/80 bg-zinc-800/80 text-zinc-100 shadow-xs px-2.5"
                  : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 px-2"
              )}
            >
              <IconFolder className="size-4 shrink-0" />
              {activeTab === "watchlists" && <span className="whitespace-nowrap">Custom Lists</span>}
            </button>
          </div>

          {/* Edit button (pencil) -> save + cancel icons while editing */}
          {config.canEdit && !isHoverCardEditing && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsHoverCardEditing?.(true)
              }}
              className="relative z-20 ms-auto flex size-7 items-center justify-center rounded-lg border border-frost bg-frost/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer shrink-0 backdrop-blur-md"
              aria-label="Edit list entry"
              title="Edit list entry"
            >
              <IconPencil className="size-3.5" />
            </button>
          )}
          {config.canEdit && isHoverCardEditing && (
            <div className="relative z-20 ms-auto">{editActions}</div>
          )}
        </div>
      )}

      {/* Tab 1: General */}
      {activeTab === "general" && (
        isHoverCardEditing ? (
          <BorealisCardHoverEditForm
            data={data}
            config={config}
            draftStatus={draftStatus}
            setDraftStatus={setDraftStatus}
            draftScore={draftScore}
            setDraftScore={setDraftScore}
            draftPriority={draftPriority}
            setDraftPriority={setDraftPriority}
            draftProgress={draftProgress}
            setDraftProgress={setDraftProgress}
            draftChaptersProgress={draftChaptersProgress}
            setDraftChaptersProgress={setDraftChaptersProgress}
            draftVolumesProgress={draftVolumesProgress}
            setDraftVolumesProgress={setDraftVolumesProgress}
            draftRewatched={draftRewatched}
            setDraftRewatched={setDraftRewatched}
            draftStartedAt={draftStartedAt}
            setDraftStartedAt={setDraftStartedAt}
            draftCompletedAt={draftCompletedAt}
            setDraftCompletedAt={setDraftCompletedAt}
            draftIsPrivate={draftIsPrivate}
            setDraftIsPrivate={setDraftIsPrivate}
            draftNotes={draftNotes}
            setDraftNotes={setDraftNotes}
          />
        ) : (
          <div className="flex flex-col gap-3 p-4 shrink-0">
            {/* Title Header */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-start justify-between gap-2">
                <h4 className="line-clamp-2 text-sm sm:text-base font-extrabold text-white font-mono">
                  {data.title}
                </h4>
                {config.canEdit && !config.showTabNav && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsHoverCardEditing?.(true)
                    }}
                    className="flex size-7 items-center justify-center rounded-lg border border-frost bg-frost/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer shrink-0 backdrop-blur-md"
                    aria-label="Edit list entry"
                    title="Edit list entry"
                  >
                    <IconPencil className="size-3.5" />
                  </button>
                )}
              </div>

              {shouldShowSubtitle && (data.titleNative || data.titleSecondary) && (
                <span className="font-mono text-xs text-zinc-400 font-medium">
                  {data.titleNative ?? data.titleSecondary}
                </span>
              )}

              {Boolean((rawMedia as any)?.episodeTitle || (data.raw as any)?.episodeTitle) && (
                <p className="text-xs text-zinc-300 italic line-clamp-2 mt-0.5 text-start">
                  &ldquo;{(rawMedia as any)?.episodeTitle || (data.raw as any)?.episodeTitle}&rdquo;
                </p>
              )}
            </div>

            {/* Quick Meta Stats Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 font-medium">
              {details?.format && (
                <span className="inline-flex items-center rounded-md border border-frost bg-frost px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-100 uppercase">
                  {details.format}
                </span>
              )}

              {details?.isQueued && (
                <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 uppercase shadow-xs">
                  Queued
                </span>
              )}

              {/* Score next to format badge */}
              {details?.scoreFormatted && (
                <div className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-frost px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 shadow-xs">
                  <IconStar className="size-3 fill-amber-300" />
                  <span>{details.scoreFormatted}</span>
                </div>
              )}

              {/* Media Release Status Badge */}
              {details?.status && (
                <MediaStatusBadge
                  status={details.status}
                  showIcon
                />
              )}

              {/* User Personal List Status Badge */}
              {details?.listStatus && (
                <MediaListStatusBadge
                  status={details.listStatus}
                  mediaType={data.type}
                  showIcon
                />
              )}

              {/* Air Date / Year or Release Period */}
              {(details?.airDate || details?.year) && (
                <div className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                  <IconCalendar className="size-3 text-zinc-500" />
                  <span>{details.airDate ?? details.year}</span>
                </div>
              )}

              {/* Duration */}
              {details?.duration && (
                <div className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                  <IconClock className="size-3 text-zinc-500" />
                  <span>{typeof details.duration === "number" ? `${details.duration}m` : details.duration}</span>
                </div>
              )}

              {/* Gender badge for characters/people */}
              {effectiveGender && (
                <span className="inline-flex items-center rounded-md border border-frost bg-frost px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-100 uppercase">
                  {effectiveGender}
                </span>
              )}

              {/* Age badge for characters/people */}
              {effectiveAge && (
                <span className="inline-flex items-center rounded-md border border-frost bg-frost px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-300">
                  {effectiveAge.toLowerCase().includes("age") ? effectiveAge : `Age: ${effectiveAge}`}
                </span>
              )}
            </div>

            {/* User List Entry Details: Dates, Private, Notes (Owner only) */}
            {config.canEdit && (draftStartedAt || draftCompletedAt || draftIsPrivate || draftNotes) && (
              <div className="flex flex-col gap-2 rounded-xl border border-frost bg-frost/70 p-2.5 text-xs backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  {(draftStartedAt || draftCompletedAt) ? (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                      <IconCalendar className="size-3.5 text-zinc-400 shrink-0" />
                      <span>
                        {draftStartedAt || "—"} {draftCompletedAt ? `→ ${draftCompletedAt}` : ""}
                      </span>
                    </div>
                  ) : <span />}

                  <div className="flex items-center gap-1.5">
                    {draftPriority && draftPriority !== "LOW" && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md",
                          draftPriority === "ULTRA" && "border-purple-500/50 bg-purple-500/20 text-purple-300",
                          draftPriority === "HIGH" && "border-rose-500/50 bg-rose-500/20 text-rose-300",
                          draftPriority === "MEDIUM" && "border-amber-500/50 bg-amber-500/20 text-amber-300"
                        )}
                      >
                        <IconFlag className="size-3" />
                        <span>{draftPriority === "MEDIUM" ? "Med" : draftPriority.charAt(0) + draftPriority.slice(1).toLowerCase()}</span>
                      </span>
                    )}

                    {draftIsPrivate && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-frost bg-frost/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-300 backdrop-blur-md">
                        <IconLock className="size-3 text-zinc-400" />
                        Private
                      </span>
                    )}
                  </div>
                </div>

                {draftNotes && (
                  <div className="flex flex-col gap-0.5 border-t border-frost/60 pt-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      <IconFileText className="size-3" />
                      Notes
                    </span>
                    <p className="whitespace-pre-wrap font-sans text-xs text-zinc-300 line-clamp-3 select-text">
                      {draftNotes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Formatted Description (only render if user is not the owner) */}
            {!config.canEdit && effectiveDescription ? (
              <BorealisFormattedText
                text={effectiveDescription}
                className="select-text font-mono text-xs text-zinc-300 leading-relaxed"
              />
            ) : null}

            {/* Voice Actor Spotlight for Characters */}
            {details?.actor && (
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5 select-text">
                {details.actor.image ? (
                  <img
                    src={details.actor.image}
                    alt={details.actor.namePrimary}
                    className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border/50"
                  />
                ) : (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    <IconMicrophone className="size-4" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                    Voice Actor ({details.actor.language ?? "VA"})
                  </span>
                  <a
                    href={`/borealis/people/${details.actor.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                  >
                    {details.actor.namePrimary}
                  </a>
                  {details.actor.nameNative && (
                    <span className="font-mono truncate text-[10px] text-zinc-400">
                      {details.actor.nameNative}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Genres Pill List */}
            {details?.genres && details.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-zinc-800/80 pt-2.5">
                {details.genres.map((genre, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-zinc-700/60 bg-zinc-900/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-200 shadow-xs"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Tab 2: Episodes */}
      {activeTab === "episodes" && (
        <BorealisCardHoverEpisodesTab
          data={data}
          config={config}
          draftWatchedEpisodes={draftWatchedEpisodes}
          setDraftWatchedEpisodes={setDraftWatchedEpisodes}
          draftProgress={draftProgress}
          setDraftProgress={setDraftProgress}
          setDraftStatus={setDraftStatus}
          onEditStart={() => setIsHoverCardEditing?.(true)}
        />
      )}

      {/* Tab 3: Rewatches */}
      {activeTab === "repeats" && (
        <BorealisCardHoverRewatchesTab
          data={data}
          config={config}
          draftHistory={draftHistory}
          setDraftHistory={setDraftHistory}
          draftRewatched={draftRewatched}
          setDraftRewatched={setDraftRewatched}
          isHoverCardEditing={isHoverCardEditing}
          onEditStart={() => setIsHoverCardEditing?.(true)}
        />
      )}

      {/* Tab 4: Connections */}
      {activeTab === "connections" && (
        <BorealisCardHoverConnectionsTab
          data={data}
          config={config}
          connections={draftConnections}
          onConnectionsChange={setDraftConnections}
          isHoverCardEditing={isHoverCardEditing}
          onEditStart={() => setIsHoverCardEditing?.(true)}
        />
      )}

      {/* Tab 5: Custom Lists */}
      {activeTab === "watchlists" && (
        <BorealisCardHoverWatchlistsTab
          data={data}
          config={config}
          isHoverCardEditing={isHoverCardEditing}
          onEditStart={() => setIsHoverCardEditing?.(true)}
          listChanges={draftListChanges}
          setListChanges={setDraftListChanges}
          newLists={draftNewLists}
          setNewLists={setDraftNewLists}
          refreshKey={playlistRefreshKey}
        />
      )}

      {/* Edit mode actions: replace pencil with save (check) + cancel (x) */}
      {isHoverCardEditing && !config.showTabNav && (
        <div className="flex items-center justify-end border-b border-frost/60 bg-frost/60 px-3 py-2 backdrop-blur-md">
          {editActions}
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}

// -----------------------------------------------------------------------------
// 5.5 BorealisCard.ExpandedContent
// -----------------------------------------------------------------------------
export function BorealisCardExpandedContent({
  imagePosition,
  priority = false,
  showHoverCard = true,
  className,
}: BorealisCardExpandedContentProps) {
  const { data, config } = useBorealisCard()
  const [imageError, setImageError] = useState(false)

  const effectiveRatio = config.aspectRatio ?? data.aspectRatio ?? "video"
  const details = data.hoverDetails
  const shouldShowSubtitle = config.showSubtitle ?? true
  const shouldShowDescription = config.showDescription ?? false
  const descriptionText = data.description || details?.description

  return (
    <>
      {/* 1. Thumbnail Image on Left or Right */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-muted shrink-0 select-none",
          effectiveRatio === "video" && "w-32 sm:w-44 md:w-52 aspect-video",
          effectiveRatio === "poster" && "w-20 sm:w-28 aspect-2/3",
          effectiveRatio === "square" && "w-20 sm:w-28 aspect-square",
          className
        )}
      >
        <a
          href={data.href && data.href !== "#" ? data.href : undefined}
          onClick={(e) => {
            if (!data.href || data.href === "#") {
              e.preventDefault()
            }
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="block size-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {data.image && !imageError ? (
            <img
              src={data.image}
              alt={data.title}
              loading={priority ? "eager" : "lazy"}
              onError={() => setImageError(true)}
              className="size-full rounded-xl object-cover transition-transform duration-300 group-hover/bcard:scale-105"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground/60">
              {getEntityFallbackIcon(data.type)}
              <span className="text-center text-[10px] font-medium capitalize">
                {data.type}
              </span>
            </div>
          )}
        </a>
      </div>

      {/* 2. Header Content next to Image (matching hoverCard header) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 pe-1">
        {/* Title */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <a
            href={data.href && data.href !== "#" ? data.href : undefined}
            onClick={(e) => {
              if (!data.href || data.href === "#") {
                e.preventDefault()
              }
            }}
            title={data.title}
            className="line-clamp-2 font-mono text-sm sm:text-base font-bold tracking-tight text-foreground transition-colors group-hover/bcard:text-primary group-hover/bcard:underline"
          >
            {data.title}
          </a>

          {shouldShowSubtitle && (data.titleNative || data.titleSecondary) && (
            <span
              title={data.titleNative ?? data.titleSecondary ?? ""}
              className="line-clamp-1 font-mono text-xs text-muted-foreground/80 tracking-tight"
            >
              {data.titleNative ?? data.titleSecondary}
            </span>
          )}
        </div>

        {/* Quick Meta Row: Badges, Air Date, Duration */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
          {/* Badges (EP badge, Airing, Upcoming, Filler, Recap, Format, Queued, etc.) */}
          {data.badges && data.badges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {data.badges.map((b, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase shadow-xs select-none",
                    b.className || "border border-border/60 bg-muted/50 text-foreground"
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Air Date / Year with Calendar Icon */}
          {(details?.airDate || details?.year) && (
            <span className="inline-flex items-center gap-1 select-none text-muted-foreground">
              <IconCalendar className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden="true" />
              <span>{details.airDate ?? details.year}</span>
            </span>
          )}

          {/* Duration with Clock Icon */}
          {details?.duration && (
            <span className="inline-flex items-center gap-1 select-none text-muted-foreground">
              <IconClock className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden="true" />
              <span>
                {typeof details.duration === "number"
                  ? `${details.duration}m`
                  : details.duration}
              </span>
            </span>
          )}
        </div>

        {/* Optional Description / Synopsis */}
        {shouldShowDescription && descriptionText && (
          <p
            title={descriptionText}
            className="line-clamp-2 text-xs text-muted-foreground/80 leading-relaxed mt-0.5 select-none"
          >
            {descriptionText}
          </p>
        )}
      </div>

      {/* 3. Hover Card popover */}
      {showHoverCard && <BorealisCardHoverContent />}
    </>
  )
}

// -----------------------------------------------------------------------------
// 6. Main Compound Component: BorealisCard
// -----------------------------------------------------------------------------
export function BorealisCard({
  type,
  data,
  href,
  expanded = false,
  imagePosition = "left",
  showExtras = true,
  showBadges = true,
  showSubtitle = true,
  showHoverSubtitle = false,
  showTabNav = false,
  showDescription = false,
  showHoverCard = true,
  showProgress = true,
  statusIconOnly = false,
  canEdit = false,
  onStatusChange,
  onScoreChange,
  onSaveEntry,
  onEdit,
  onIncrement,
  onIncrementVolume,
  isIncrementDisabled = false,
  titlePreference = "primary",
  progress,
  aspectRatio,
  size = "md",
  hoverPlacement,
  hoverDelay = 150,
  className,
  priority = false,
  children,
}: BorealisCardProps) {
  const normalized = normalizeBorealisData(type, data, href, { titlePreference })
  if (progress) {
    normalized.progress = progress
  }

  return (
    <BorealisCardRoot
      data={normalized}
      expanded={expanded}
      imagePosition={imagePosition}
      showExtras={showExtras}
      showBadges={showBadges}
      showSubtitle={showSubtitle}
      showHoverSubtitle={showHoverSubtitle}
      showTabNav={showTabNav}
      showDescription={showDescription}
      showHoverCard={showHoverCard}
      showProgress={showProgress}
      statusIconOnly={statusIconOnly}
      canEdit={canEdit}
      onStatusChange={onStatusChange}
      onScoreChange={onScoreChange}
      onSaveEntry={onSaveEntry}
      onEdit={onEdit}
      onIncrement={onIncrement}
      onIncrementVolume={onIncrementVolume}
      isIncrementDisabled={isIncrementDisabled}
      aspectRatio={aspectRatio}
      size={size}
      hoverPlacement={hoverPlacement}
      hoverDelay={hoverDelay}
      className={className}
    >
      {children ? (
        children
      ) : expanded ? (
        <BorealisCardExpandedContent
          imagePosition={imagePosition}
          priority={priority}
          showHoverCard={showHoverCard}
        />
      ) : (
        <>
          <BorealisCardImage priority={priority} />
          <BorealisCardTitle />
          <BorealisCardExtras />
          {showHoverCard && <BorealisCardHoverContent />}
        </>
      )}
    </BorealisCardRoot>
  )
}

export function BorealisCardExpanded(props: BorealisCardProps) {
  return <BorealisCard {...props} expanded />
}

// Compound API Attachments
BorealisCard.Root = BorealisCardRoot
BorealisCard.Image = BorealisCardImage
BorealisCard.Title = BorealisCardTitle
BorealisCard.Extras = BorealisCardExtras
BorealisCard.HoverContent = BorealisCardHoverContent
BorealisCard.ExpandedContent = BorealisCardExpandedContent
BorealisCard.Expanded = BorealisCardExpanded
BorealisCard.StatusBadge = StatusBadge
BorealisCard.MediaStatusBadge = MediaStatusBadge
BorealisCard.MediaListStatusBadge = MediaListStatusBadge
