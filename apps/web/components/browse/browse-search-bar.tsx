"use client"

import React, { useRef, useEffect, useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  IconSearch,
  IconX,
  IconLoader2,
  IconTag,
  IconWorldDownload,
  IconCheck,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  type BrowseCategory,
  BROWSE_CATEGORIES,
  parseCategoryTag,
} from "@/lib/browse-history"
import { getCategoryLabel } from "./browse-category-nav"

interface BrowseSearchBarProps {
  category?: BrowseCategory
  categoryLabel?: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
  onSwitchCategory?: (category: BrowseCategory) => void
  onSubmit?: (e: React.FormEvent) => void
  isLoading?: boolean
  showExternalButton?: boolean
  isSearchingExternal?: boolean
  isExternalDisabled?: boolean
  onSearchExternal?: () => void
  className?: string
}

export function BrowseSearchBar({
  category,
  value,
  onChange,
  onClear,
  onSwitchCategory,
  onSubmit,
  isLoading = false,
  showExternalButton = false,
  isSearchingExternal = false,
  isExternalDisabled = false,
  onSearchExternal,
  className,
}: BrowseSearchBarProps) {
  const t = useTranslations("browse")
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const placeholderText = useMemo(() => {
    if (category === "music") {
      return t("searchPlaceholderMusic")
    }
    return mounted && isMobile
      ? t("searchPlaceholderPhone")
      : t("searchPlaceholderDesktop")
  }, [category, mounted, isMobile, t])

  // Detect if user is currently typing an @tag prefix e.g. "@", "@an", "@mov"
  const tagQuery = useMemo(() => {
    const match = value.match(/(?:^|\s)@([a-zA-Z0-9]*)$/)
    return match ? match[1]!.toLowerCase() : null
  }, [value])

  const suggestions = useMemo(() => {
    if (tagQuery === null) return []
    return BROWSE_CATEGORIES.filter(
      (c) =>
        c.key.toLowerCase().startsWith(tagQuery) ||
        c.singularLabel.toLowerCase().startsWith(tagQuery) ||
        c.tag.toLowerCase().includes(tagQuery)
    )
  }, [tagQuery])

  useEffect(() => {
    if (tagQuery !== null && suggestions.length > 0) {
      setShowSuggestions(true)
      setActiveSuggestionIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }, [tagQuery, suggestions.length])

  // Handle value change with instant @category switching
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    // Check if the typed value contains a completed @category tag
    if (onSwitchCategory) {
      const parsed = parseCategoryTag(raw)
      if (parsed.hasTag && parsed.category) {
        onSwitchCategory(parsed.category)
        onChange(parsed.cleanQuery)
        setShowSuggestions(false)
        return
      }
    }

    onChange(raw)
  }

  const handleSelectCategorySuggestion = (cat: BrowseCategory) => {
    if (onSwitchCategory) {
      onSwitchCategory(cat)
    }
    // Remove the trailing @tag from the input
    const cleaned = value.replace(/(?:^|\s)@[a-zA-Z0-9]*$/, "").trim()
    onChange(cleaned)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveSuggestionIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length
        )
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const selected = suggestions[activeSuggestionIndex]
        if (selected) {
          e.preventDefault()
          handleSelectCategorySuggestion(selected.key)
          return
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (showSuggestions && suggestions[activeSuggestionIndex]) {
          handleSelectCategorySuggestion(
            suggestions[activeSuggestionIndex]!.key
          )
          return
        }
        onSubmit?.(e)
      }}
      role="search"
      className={cn("relative w-full", className)}
    >
      <label htmlFor="browse-search-input" className="sr-only">
        {t("searchTitles")}
      </label>

      <div className="relative flex w-full items-center">
        {/* Search Icon or Spinner */}
        <div className="pointer-events-none absolute inset-y-0 start-0 z-10 flex items-center ps-3.5 text-muted-foreground">
          {isLoading ? (
            <IconLoader2
              className="size-4.5 animate-spin text-primary"
              aria-hidden="true"
            />
          ) : (
            <IconSearch className="size-4.5" aria-hidden="true" />
          )}
        </div>

        {/* Shadcn UI Input */}
        <Input
          ref={inputRef}
          id="browse-search-input"
          type="text"
          name="browse-search"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay closing to allow clicks on suggestions
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          onFocus={() => {
            if (tagQuery !== null && suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder={placeholderText}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "h-11 w-full rounded-2xl border border-input/60 bg-muted/40 ps-10 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20",
            showExternalButton && value
              ? "pe-18"
              : showExternalButton || value
                ? "pe-10"
                : "pe-4"
          )}
        />

        {/* Right Action Container: External Search Button & Clear Button */}
        <div className="absolute inset-y-0 end-0 z-10 flex items-center gap-1 pe-2">
          {showExternalButton && (
            <Button
              type="button"
              variant={isExternalDisabled ? "outline" : "ghost"}
              size="icon-xs"
              isDisabled={isSearchingExternal || isExternalDisabled}
              onPress={() => onSearchExternal?.()}
              aria-label={
                isExternalDisabled
                  ? "External sources already fetched"
                  : "Search external sources"
              }
              className={cn(
                "size-7 rounded-lg transition-all",
                isExternalDisabled
                  ? "border-primary/40 text-primary opacity-80"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              {isSearchingExternal ? (
                <IconLoader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              ) : isExternalDisabled ? (
                <IconCheck className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <IconWorldDownload className="size-4" aria-hidden="true" />
              )}
            </Button>
          )}

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onPress={() => {
                onClear()
                setShowSuggestions(false)
                inputRef.current?.focus()
              }}
              aria-label={t("clearSearch")}
              className="size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Category Autocomplete Dropdown when typing @ */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute start-0 top-full z-30 mt-1.5 w-72 rounded-2xl border border-border bg-popover p-1.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <IconTag className="size-3" aria-hidden="true" />
            <span>{t("switchCategory")}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {suggestions.map((cat, idx) => (
              <Button
                key={cat.key}
                type="button"
                variant={idx === activeSuggestionIndex ? "default" : "ghost"}
                size="sm"
                onPress={() => handleSelectCategorySuggestion(cat.key)}
                className={cn(
                  "h-auto w-full justify-between rounded-xl px-2.5 py-1.5 text-start text-xs font-normal transition-colors",
                  idx === activeSuggestionIndex
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="font-mono">{cat.tag}</span>
                <span
                  className={cn(
                    "text-[11px]",
                    idx === activeSuggestionIndex
                      ? "text-primary-foreground/90"
                      : "text-muted-foreground"
                  )}
                >
                  {getCategoryLabel(cat.key, t)}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
