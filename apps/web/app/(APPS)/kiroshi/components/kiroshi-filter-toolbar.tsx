"use client"

import React, { memo } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { IconChevronDown } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export const TIME_RANGES = [
  { id: "anytime", label: "Anytime", value: "" },
  { id: "day", label: "Past day", value: "day" },
  { id: "week", label: "Past week", value: "week" },
  { id: "month", label: "Past month", value: "month" },
  { id: "year", label: "Past year", value: "year" },
]

export const LANGUAGES = [
  { id: "auto", label: "Auto-detect (en-US)", value: "auto" },
  { id: "en-US", label: "English (US)", value: "en-US" },
  { id: "ja-JP", label: "Japanese (日本語)", value: "ja-JP" },
  { id: "de-DE", label: "German (Deutsch)", value: "de-DE" },
  { id: "fr-FR", label: "French (Français)", value: "fr-FR" },
  { id: "all", label: "All Languages", value: "all" },
]

export const SAFE_SEARCH_OPTIONS = [
  { id: "0", label: "SafeSearch: Off", value: "0" },
  { id: "1", label: "SafeSearch: Moderate", value: "1" },
  { id: "2", label: "SafeSearch: Strict", value: "2" },
]

export interface KiroshiFilterToolbarProps {
  timeRange: string
  language: string
  safeSearch: string
  responseTimeMs?: number
  numberOfResults?: number
  onChangeFilter: (key: "timeRange" | "language" | "safeSearch", value: string) => void
  className?: string
}

export const KiroshiFilterToolbar = memo(function KiroshiFilterToolbar({
  timeRange,
  language,
  safeSearch,
  responseTimeMs = 0,
  numberOfResults = 0,
  onChangeFilter,
  className,
}: KiroshiFilterToolbarProps): React.JSX.Element {
  const currentLangLabel =
    LANGUAGES.find((l) => l.value === language)?.label || "Auto-detect"
  const currentTimeLabel =
    TIME_RANGES.find((t) => t.value === timeRange)?.label || "Anytime"
  const currentSafeLabel =
    SAFE_SEARCH_OPTIONS.find((s) => s.value === safeSearch)?.label || "SafeSearch"

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 pt-0.5 sm:pt-1 text-xs text-muted-foreground overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0",
        className
      )}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Language Dropdown */}
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 sm:h-7 gap-1 px-1.5 sm:px-2 text-[11px] sm:text-xs font-normal text-muted-foreground hover:text-foreground shrink-0"
          >
            <span>{currentLangLabel}</span>
            <IconChevronDown className="size-3 opacity-60" />
          </Button>
          <DropdownMenu placement="bottom start">
            {LANGUAGES.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onAction={() => onChangeFilter("language", l.value)}
                className={cn(language === l.value && "font-semibold text-primary")}
              >
                {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        </DropdownMenuTrigger>

        {/* Time Range Dropdown */}
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 sm:h-7 gap-1 px-1.5 sm:px-2 text-[11px] sm:text-xs font-normal text-muted-foreground hover:text-foreground shrink-0"
          >
            <span>{currentTimeLabel}</span>
            <IconChevronDown className="size-3 opacity-60" />
          </Button>
          <DropdownMenu placement="bottom start">
            {TIME_RANGES.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onAction={() => onChangeFilter("timeRange", t.value)}
                className={cn(timeRange === t.value && "font-semibold text-primary")}
              >
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        </DropdownMenuTrigger>

        {/* SafeSearch Dropdown */}
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 sm:h-7 gap-1 px-1.5 sm:px-2 text-[11px] sm:text-xs font-normal text-muted-foreground hover:text-foreground shrink-0"
          >
            <span>{currentSafeLabel}</span>
            <IconChevronDown className="size-3 opacity-60" />
          </Button>
          <DropdownMenu placement="bottom start">
            {SAFE_SEARCH_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onAction={() => onChangeFilter("safeSearch", s.value)}
                className={cn(safeSearch === s.value && "font-semibold text-primary")}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        </DropdownMenuTrigger>
      </div>

      {/* Response time stat */}
      {responseTimeMs > 0 && (
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground/80 shrink-0">
          <span>▸ Response time: {(responseTimeMs / 1000).toFixed(1)}s</span>
          {numberOfResults > 0 && (
            <span className="hidden sm:inline">
              ({numberOfResults.toLocaleString()} results)
            </span>
          )}
        </div>
      )}
    </div>
  )
})
