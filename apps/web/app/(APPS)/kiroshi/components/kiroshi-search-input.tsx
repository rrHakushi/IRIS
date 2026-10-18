"use client"

import React, { useState, useEffect, useRef, useCallback, memo } from "react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { IconSearch, IconX } from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { cn } from "@workspace/ui/lib/utils"

export interface KiroshiSearchInputProps {
  initialValue?: string
  variant?: "hero" | "compact"
  placeholder?: string
  autoFocus?: boolean
  onSubmit: (query: string) => void
  className?: string
}

export const KiroshiSearchInput = memo(function KiroshiSearchInput({
  initialValue = "",
  variant = "compact",
  placeholder = "Search the web...",
  autoFocus = false,
  onSubmit,
  className,
}: KiroshiSearchInputProps): React.JSX.Element {
  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  const hasUserTypedRef = useRef(false)
  const lastRequestIdRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync internal state if initialValue changes externally
  useEffect(() => {
    setQuery(initialValue)
    hasUserTypedRef.current = false
    setShowSuggestions(false)
  }, [initialValue])

  // Click outside to dismiss suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
        setIsFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Debounced autocomplete fetch.
  // ONLY fetch when the user has actively focused and typed into the input.
  useEffect(() => {
    if (!hasUserTypedRef.current || !isFocused) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const requestId = ++lastRequestIdRef.current

    const timer = setTimeout(async () => {
      try {
        const res = await elysia.kiroshi.suggestions.get({
          query: { q: trimmed },
        })

        if (requestId !== lastRequestIdRef.current) return

        if (res.data) {
          let list: string[] = []
          if ("suggestions" in res.data && Array.isArray(res.data.suggestions)) {
            list = res.data.suggestions.filter(
              (item): item is string => typeof item === "string"
            )
          } else if (Array.isArray(res.data) && Array.isArray(res.data[1])) {
            list = res.data[1].filter(
              (item): item is string => typeof item === "string"
            )
          }

          if (list.length > 0 && isFocused) {
            setSuggestions(list.slice(0, 8))
            setShowSuggestions(true)
            setFocusedIndex(-1)
          } else {
            setSuggestions([])
            setShowSuggestions(false)
          }
        }
      } catch {
        if (requestId === lastRequestIdRef.current) {
          setSuggestions([])
          setShowSuggestions(false)
        }
      }
    }, 150)

    return () => {
      clearTimeout(timer)
    }
  }, [query, isFocused])

  const handleSubmit = useCallback(
    (targetQuery: string) => {
      const trimmed = targetQuery.trim()
      if (!trimmed) return
      hasUserTypedRef.current = false
      setShowSuggestions(false)
      setIsFocused(false)
      inputRef.current?.blur()
      onSubmit(trimmed)
    },
    [onSubmit]
  )

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (focusedIndex >= 0 && suggestions[focusedIndex]) {
      handleSubmit(suggestions[focusedIndex])
    } else {
      handleSubmit(query)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const isHero = variant === "hero"

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      role="combobox"
      aria-expanded={showSuggestions && suggestions.length > 0}
      aria-haspopup="listbox"
    >
      <form onSubmit={handleFormSubmit} className="relative w-full">
        <div
          className={cn(
            "group relative flex w-full items-center border transition-all duration-200",
            isHero
              ? "rounded-2xl border-border/70 bg-muted/30 shadow-lg shadow-black/5 backdrop-blur-md focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20"
              : "rounded-full border-border/60 bg-muted/40 focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20"
          )}
        >
          <IconSearch
            className={cn(
              "shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary",
              isHero
                ? "ms-3.5 sm:ms-4.5 size-4.5 sm:size-5"
                : "ms-3 size-4 text-muted-foreground/80"
            )}
          />

          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              hasUserTypedRef.current = true
              setQuery(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true)
              if (hasUserTypedRef.current && suggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={cn(
              "flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0",
              isHero
                ? "h-12 sm:h-14 px-2.5 sm:px-3 text-sm sm:text-base placeholder:text-muted-foreground/60"
                : "h-9 sm:h-10 px-2 text-xs sm:text-sm placeholder:text-muted-foreground/60"
            )}
          />

          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setSuggestions([])
                setShowSuggestions(false)
                hasUserTypedRef.current = false
                inputRef.current?.focus()
              }}
              className="me-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Clear input"
            >
              <IconX className={cn(isHero ? "size-4" : "size-3.5")} />
            </button>
          )}

          {isHero ? (
            <Button
              type="submit"
              size="icon"
              className="me-2 size-8 sm:size-10 rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 shrink-0"
              aria-label="Search"
            >
              <IconSearch className="size-4 sm:size-5" />
            </Button>
          ) : (
            <button
              type="submit"
              className="pe-3 ps-1 text-muted-foreground/80 transition-colors hover:text-primary"
              aria-label="Search"
            >
              <IconSearch className="size-4" />
            </button>
          )}
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          role="listbox"
          className={cn(
            "absolute top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1 text-start shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100",
            isHero ? "mt-2" : "mt-1"
          )}
        >
          {suggestions.map((sug, idx) => {
            const isFocused = focusedIndex === idx
            return (
              <button
                key={sug}
                type="button"
                role="option"
                aria-selected={isFocused}
                onClick={() => handleSubmit(sug)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-start",
                  isFocused
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <IconSearch className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{sug}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
