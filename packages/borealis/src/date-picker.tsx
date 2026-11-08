"use client"

import * as React from "react"
import {
  parseDate,
  type CalendarDate,
  getLocalTimeZone,
  today,
} from "@internationalized/date"
import { Dialog, Heading } from "react-aria-components"
import { IconCalendar, IconX } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

export interface BorealisDatePickerProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  ariaLabel?: string
  align?: "start" | "end"
  minValue?: string | null
  maxValue?: string | null
}

function formatDateToYmd(val: any): string {
  if (!val) return ""
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return ""
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  return ""
}

export function BorealisDatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  className = "",
  disabled = false,
  ariaLabel = "Date picker",
  align = "start",
  minValue,
  maxValue,
}: BorealisDatePickerProps) {
  const date = React.useMemo<CalendarDate | null>(() => {
    if (!value) return null
    try {
      const ymd = formatDateToYmd(value)
      return ymd ? parseDate(ymd) : null
    } catch {
      return null
    }
  }, [value])

  const minDate = React.useMemo<CalendarDate | null>(() => {
    if (!minValue) return null
    try {
      const ymd = formatDateToYmd(minValue)
      return ymd ? parseDate(ymd) : null
    } catch {
      return null
    }
  }, [minValue])

  const maxDate = React.useMemo<CalendarDate | null>(() => {
    if (!maxValue) return null
    try {
      const ymd = formatDateToYmd(maxValue)
      return ymd ? parseDate(ymd) : null
    } catch {
      return null
    }
  }, [maxValue])

  const handleSelect = (newDate: CalendarDate | null, close?: () => void) => {
    if (newDate) {
      if (minDate && newDate.compare(minDate) < 0) return
      if (maxDate && newDate.compare(maxDate) > 0) return
      onChange(newDate.toString())
    } else {
      onChange(null)
    }
    if (close) close()
  }

  const isTodayDisabled = React.useMemo(() => {
    const todayDate = today(getLocalTimeZone())
    if (minDate && todayDate.compare(minDate) < 0) return true
    if (maxDate && todayDate.compare(maxDate) > 0) return true
    return false
  }, [minDate, maxDate])

  const handleSetToday = (close?: () => void) => {
    if (isTodayDisabled) return
    const todayDate = today(getLocalTimeZone())
    onChange(todayDate.toString())
    if (close) close()
  }

  const formattedDisplay = React.useMemo(() => {
    if (!date) return ""
    try {
      return date.toDate(getLocalTimeZone()).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    } catch {
      return date.toString()
    }
  }, [date])

  const triggerRef = React.useRef<HTMLButtonElement>(null)

  return (
    <PopoverTrigger>
      <Button
        ref={triggerRef}
        variant="ghost"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "relative flex h-8 w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-normal text-white transition-colors hover:border-zinc-600 hover:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          <IconCalendar className="size-3.5 shrink-0 text-zinc-400" />
          <span
            className={cn(
              "truncate font-mono text-[11px]",
              formattedDisplay ? "font-medium text-white" : "text-zinc-500"
            )}
          >
            {formattedDisplay || placeholder}
          </span>
        </div>

        {value ? (
          <span
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation()
                onChange(null)
              }
            }}
            className="cursor-pointer p-0.5 text-zinc-400 transition-colors hover:text-white"
            aria-label="Clear date"
          >
            <IconX className="size-3" />
          </span>
        ) : null}
      </Button>

      <Popover
        aria-label={ariaLabel || "Select date"}
        shouldFlip
        containerPadding={12}
        placement={align === "end" ? "bottom end" : "bottom start"}
        className="w-auto overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl backdrop-blur-xl z-[10000]"
        shouldCloseOnInteractOutside={(element) => {
          if (!element) return true
          const isTrigger = triggerRef.current?.contains(element)
          const isPopover = Boolean(
            element.closest?.(
              '[data-slot="popover-content"], .react-aria-Popover, [data-slot="calendar"]'
            )
          )
          if (isTrigger) return false
          if (isPopover) return false
          return true
        }}
      >
        <Dialog
          aria-label={ariaLabel || "Choose date"}
          className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto outline-none"
        >
          {({ close }: any) => (
            <>
              <Heading slot="title" className="sr-only">
                {ariaLabel || "Choose date"}
              </Heading>
              <Calendar
                aria-label={ariaLabel || "Choose date"}
                value={date as any}
                minValue={minDate || undefined}
                maxValue={maxDate || undefined}
                onChange={(val: any) => handleSelect(val as CalendarDate, close)}
                className="bg-transparent p-3"
              />
              <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
                <button
                  type="button"
                  disabled={isTodayDisabled}
                  onClick={() => handleSetToday(close)}
                  className={cn(
                    "cursor-pointer font-medium text-primary transition-colors hover:underline text-[11px]",
                    isTodayDisabled && "cursor-not-allowed opacity-40 hover:no-underline"
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null)
                    if (close) close()
                  }}
                  className="cursor-pointer text-zinc-400 transition-colors hover:text-red-400 text-[11px]"
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </Dialog>
      </Popover>
    </PopoverTrigger>
  )
}

