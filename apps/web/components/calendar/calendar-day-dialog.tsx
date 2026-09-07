"use client"

import React from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Badge } from "@workspace/ui/components/badge"
import { CalendarItemCard } from "./calendar-item-card"
import type { CalendarItem } from "./calendar-types"

interface CalendarDayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | null
  items: CalendarItem[]
  titlePreference?: "primary" | "secondary" | "native"
}

export function CalendarDayDialog({
  open,
  onOpenChange,
  date,
  items,
  titlePreference,
}: CalendarDayDialogProps) {
  if (!date) return null

  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-h-[85vh] w-full p-5 sm:max-w-xl sm:rounded-3xl sm:p-6 md:max-w-2xl"
    >
      <DialogHeader className="gap-1.5 border-b border-border/40 pb-3">
        <div className="flex items-center justify-between pe-8">
          <DialogTitle className="text-base font-bold text-foreground sm:text-lg">
            {formattedDate}
          </DialogTitle>
          <Badge
            variant="secondary"
            className="rounded-full text-xs font-medium"
          >
            {items.length} {items.length === 1 ? "release" : "releases"}
          </Badge>
        </div>
      </DialogHeader>

      <div className="flex max-h-[65vh] flex-col gap-2.5 overflow-y-auto pe-1 pt-2">
        {items.map((item) => (
          <CalendarItemCard
            key={item.id}
            item={item}
            variant="agenda"
            titlePreference={titlePreference}
            onClick={() => onOpenChange(false)}
          />
        ))}
      </div>
    </Dialog>
  )
}
