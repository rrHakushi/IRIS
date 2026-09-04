"use client"

import React, { useState, useMemo } from "react"
import {
  DialogTrigger,
  Popover,
  Dialog,
} from "react-aria-components"
import {
  IconChevronDown,
  IconCheck,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

export interface MultiSelectOption {
  value: string
  label: string
  count?: number
}

export interface MultiSelectFilterPopoverProps {
  label: string
  allLabel?: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  searchable?: boolean
  className?: string
}

export function MultiSelectFilterPopover({
  label,
  allLabel = `All ${label}`,
  options,
  selected,
  onChange,
  searchable = true,
  className,
}: MultiSelectFilterPopoverProps): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const lower = searchTerm.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(lower))
  }, [options, searchTerm])

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val))
    } else {
      onChange([...selected, val])
    }
  }

  const clearAll = () => {
    onChange([])
    setSearchTerm("")
  }

  const hasSelection = selected.length > 0
  const triggerText = hasSelection
    ? `${label} (${selected.length})`
    : allLabel

  return (
    <DialogTrigger>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 gap-1.5 rounded-2xl border px-3 text-xs font-medium transition-colors select-none",
          hasSelection
            ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          className
        )}
      >
        <span>{triggerText}</span>
        <IconChevronDown className="size-3.5 opacity-60 shrink-0" />
      </Button>

      <Popover
        placement="bottom start"
        offset={6}
        className={cn(
          "z-50 w-64 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-0 text-popover-foreground shadow-2xl backdrop-blur-2xl outline-hidden duration-100",
          "data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95"
        )}
      >
        <Dialog className="flex flex-col outline-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
            <span className="text-xs font-semibold text-foreground">{label}</span>
            {hasSelection && (
              <Button
                variant="link"
                size="xs"
                onPress={clearAll}
                className="h-auto p-0 text-[11px] font-medium text-primary hover:underline"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Search bar inside popover */}
          {searchable && options.length > 7 && (
            <div className="relative border-b border-border/40 p-2">
              <IconSearch className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground z-10" />
              <Input
                type="text"
                placeholder={`Filter ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 w-full rounded-xl border-none bg-muted/40 ps-7 pe-6 text-xs text-foreground placeholder:text-muted-foreground focus-visible:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring/30"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onPress={clearAll}
                  aria-label="Clear filter search"
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 size-5 rounded-full text-muted-foreground hover:text-foreground z-10"
                >
                  <IconX className="size-3" />
                </Button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="no-scrollbar max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.value)
                return (
                  <Button
                    key={opt.value}
                    variant="ghost"
                    size="sm"
                    onPress={() => toggleOption(opt.value)}
                    className={cn(
                      "flex h-auto w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-start select-none",
                      isChecked
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15"
                        : "text-foreground hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-md border text-[10px] transition-colors",
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/80 bg-background/50"
                        )}
                      >
                        {isChecked && <IconCheck className="size-3" />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {opt.count !== undefined && (
                      <span
                        className={cn(
                          "text-[11px] font-mono",
                          isChecked
                            ? "text-primary/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {opt.count}
                      </span>
                    )}
                  </Button>
                )
              })
            )}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
