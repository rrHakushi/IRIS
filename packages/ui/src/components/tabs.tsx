"use client"

import * as React from "react"
import {
  Tabs as TabsPrimitive,
  TabList as TabListPrimitive,
  Tab as TabPrimitive,
  TabPanel as TabPanelPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabListProps as TabListPrimitiveProps,
  type TabProps as TabPrimitiveProps,
  type TabPanelProps as TabPanelPrimitiveProps,
} from "react-aria-components"
import { cn } from "@workspace/ui/lib/utils"

function Tabs({ className, ...props }: TabsPrimitiveProps) {
  return (
    <TabsPrimitive
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabList<T extends object>({
  className,
  ...props
}: TabListPrimitiveProps<T>) {
  return (
    <TabListPrimitive
      data-slot="tab-list"
      className={cn(
        "inline-flex h-9 items-center justify-start gap-1 rounded-2xl bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function Tab({ className, ...props }: TabPrimitiveProps) {
  return (
    <TabPrimitive
      data-slot="tab"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl px-3 py-1 text-xs font-medium whitespace-nowrap outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-selected:bg-background data-selected:text-foreground data-selected:shadow-xs",
        "hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabPanel({ className, ...props }: TabPanelPrimitiveProps) {
  return (
    <TabPanelPrimitive
      data-slot="tab-panel"
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabList, Tab, TabPanel }
