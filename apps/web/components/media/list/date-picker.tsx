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
import { formatDateToYmd } from "./types"

export interface DatePickerProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  ariaLabel?: string
  align?: "start" | "end"
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  className = "",
  disabled = false,
  ariaLabel = "Date picker",
  align = "start",
}: DatePickerProps) {
  // Parse date using @internationalized/date package
  const date = React.useMemo<CalendarDate | null>(() => {
    if (!value) return null
    try {
      const ymd = formatDateToYmd(value)
      return ymd ? parseDate(ymd) : null
    } catch {
      return null
    }
  }, [value])

  const handleSelect = (newDate: CalendarDate | null, close?: () => void) => {
    if (newDate) {
      onChange(newDate.toString())
    } else {
      onChange(null)
    }
    if (close) close()
  }

  const handleSetToday = (close?: () => void) => {
    const todayDate = today(getLocalTimeZone())
    onChange(todayDate.toString())
    if (close) close()
  }

  const handleClear = (close?: () => void) => {
    onChange(null)
    if (close) close()
  }

  // Format display string using @internationalized/date package
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

  return (
    <PopoverTrigger>
      <Button
        variant="ghost"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "relative flex h-9 w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-normal text-foreground transition-colors hover:border-border/80 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <IconCalendar className="size-3.5 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "truncate text-xs",
              formattedDisplay ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {formattedDisplay || placeholder}
          </span>
        </div>

        {value ? (
          <span
            role="button"
            tabIndex={0}
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
            className="cursor-pointer text-muted-foreground hover:text-foreground p-0.5 z-10 transition-colors"
            aria-label="Clear date"
          >
            <IconX className="size-3" />
          </span>
        ) : null}
      </Button>

      <Popover
        aria-label={ariaLabel || "Select date"}
        shouldFlip={false}
        placement={align === "end" ? "bottom end" : "bottom start"}
        className="w-auto p-0 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
      >
        {({ close }: any) => (
          <Dialog
            aria-label={ariaLabel || "Choose date"}
            className="outline-none flex flex-col"
          >
            <Heading slot="title" className="sr-only">
              {ariaLabel || "Choose date"}
            </Heading>
            <Calendar
              aria-label={ariaLabel || "Choose date"}
              value={date as any}
              onChange={(val: any) => handleSelect(val as CalendarDate, close)}
              className="bg-transparent p-3"
            />
            {/* Quick action buttons: Today / Clear */}
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs bg-muted/30">
              <button
                type="button"
                onClick={() => handleSetToday(close)}
                className="cursor-pointer font-medium text-primary hover:underline transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleClear(close)}
                className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear
              </button>
            </div>
          </Dialog>
        )}
      </Popover>
    </PopoverTrigger>
  )
}
