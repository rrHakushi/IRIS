"use client"

import React, { useState, useMemo } from "react"
import {
  DialogTrigger,
  Popover,
  Dialog,
  Heading,
  Button as RACButton,
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
  const triggerText = hasSelection ? `${label} (${selected.length})` : allLabel

  return (
    <DialogTrigger>
      <RACButton
        className={cn(
          "inline-flex shrink-0 items-center justify-center font-medium transition-all outline-hidden select-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
          "h-8 gap-1.5 rounded-2xl border px-3 text-xs backdrop-blur-md",
          hasSelection
            ? "border-primary/50 bg-primary/20 text-primary hover:bg-primary/25"
            : "border-frost bg-frost/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white",
          className
        )}
      >
        <span>{triggerText}</span>
        <IconChevronDown className="size-3.5 shrink-0 opacity-60" />
      </RACButton>

      <Popover
        placement="bottom start"
        offset={6}
        className={cn(
          "z-50 w-64 overflow-hidden rounded-2xl border border-frost bg-frost p-0 text-zinc-100 shadow-2xl outline-hidden backdrop-blur-2xl duration-100",
          "data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95"
        )}
      >
        <Dialog aria-label={label} className="flex flex-col outline-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-frost/50 px-3 py-2">
            <Heading slot="title" className="text-xs font-semibold text-zinc-100">
              {label}
            </Heading>
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
            <div className="relative border-b border-frost/40 p-2">
              <IconSearch className="pointer-events-none absolute start-4 top-1/2 z-10 size-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                aria-label={`Filter ${label.toLowerCase()}`}
                placeholder={`Filter ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 w-full rounded-xl border border-frost bg-zinc-900/80 ps-7 pe-6 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-primary backdrop-blur-md"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onPress={clearAll}
                  aria-label="Clear filter search"
                  className="absolute end-3.5 top-1/2 z-10 size-5 -translate-y-1/2 rounded-full text-zinc-400 hover:text-white"
                >
                  <IconX className="size-3" />
                </Button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="no-scrollbar max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-500">
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
                      "flex h-auto w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-start text-xs select-none",
                      isChecked
                        ? "bg-primary/20 font-medium text-primary hover:bg-primary/25"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-md border text-[10px] transition-colors",
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-zinc-700 bg-zinc-900/60"
                        )}
                      >
                        {isChecked && <IconCheck className="size-3" />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {opt.count !== undefined && (
                      <span
                        className={cn(
                          "font-mono text-[11px]",
                          isChecked
                            ? "text-primary/80"
                            : "text-zinc-500"
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

