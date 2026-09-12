"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@workspace/ui/components/dropdown-menu"
import {
  IconChevronDown,
  IconPlus,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react"
import type {
  SidebarItem,
  SidebarItemChild,
  DockPositions,
} from "@/types/sidebar-config"
import type { CustomDockGroup } from "@IRIS/shared"
import { renderDockGroupIcon } from "@/config/dock-group-icons"

export interface DockShortcutsGridProps {
  groupedItems: Record<string, SidebarItem[]>
  tempPositions: DockPositions
  focusedSlot: string | null
  onSelectItem: (itemKey: string) => void
  customGroups?: CustomDockGroup[]
  onCreateGroup?: () => void
  onEditGroup?: (group: CustomDockGroup) => void
  onDeleteGroup?: (groupId: string) => void
}

/**
 * Grid rendering categorized navigation shortcuts available to be assigned to mobile dock slots.
 */
export function DockShortcutsGrid({
  groupedItems,
  tempPositions,
  focusedSlot,
  onSelectItem,
  customGroups = [],
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: DockShortcutsGridProps): React.JSX.Element {
  const t = useTranslations("navigation.dockSettings")

  return (
    <div className="flex flex-col gap-5">
      {/* Custom Groups Section */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            {t("customGroups")}
          </span>
          {onCreateGroup && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onPress={onCreateGroup}
              className="cursor-pointer gap-1 rounded-xl text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
            >
              <IconPlus data-icon="inline-start" className="size-3" />
              <span>{t("createGroup")}</span>
            </Button>
          )}
        </div>

        {customGroups.length === 0 ? (
          onCreateGroup ? (
            <button
              type="button"
              onClick={onCreateGroup}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/40 p-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary select-none"
            >
              <IconPlus className="size-4" />
              <span>{t("createFirstGroupPrompt")}</span>
            </button>
          ) : null
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {customGroups.map((group) => {
              const itemKey = `group:${group.id}`
              const assignedPos = Object.keys(tempPositions).find(
                (key) => tempPositions[key] === itemKey
              )
              const isAssigned = !!assignedPos

              return (
                <div
                  key={group.id}
                  className={cn(
                    "group flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border p-2 text-xs font-medium transition-all select-none",
                    isAssigned
                      ? "border-primary/40 bg-primary/5 text-primary shadow-2xs"
                      : "border-border/70 bg-card/60 text-foreground hover:border-border hover:bg-muted/40"
                  )}
                >
                  <button
                    type="button"
                    disabled={!focusedSlot}
                    onClick={() => onSelectItem(itemKey)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-start outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/40 text-primary [&>svg]:size-4">
                      {renderDockGroupIcon(group.icon, "size-4")}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold text-foreground">
                        {group.label}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {t("itemsCount", { count: group.itemKeys.length })}
                      </span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {isAssigned && (
                      <Badge
                        variant="secondary"
                        className="h-4.5 shrink-0 border-primary/20 bg-primary/10 px-1.5 text-[10px] font-bold text-primary"
                      >
                        {t("posLabel")} {assignedPos}
                      </Badge>
                    )}

                    {onEditGroup && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onPress={() => onEditGroup(group)}
                        className="size-6 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
                        aria-label={t("editGroup")}
                      >
                        <IconPencil className="size-3" />
                      </Button>
                    )}

                    {onDeleteGroup && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onPress={() => onDeleteGroup(group.id)}
                        className="size-6 cursor-pointer rounded-lg text-muted-foreground hover:text-destructive"
                        aria-label={t("deleteGroup")}
                      >
                        <IconTrash className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* App Navigation Sections */}
      {Object.entries(groupedItems).map(([secName, items]) => {
        if (!items || items.length === 0) return null

        return (
          <div key={secName} className="flex flex-col gap-2.5">
            <div className="px-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {secName}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((item) => {
                const itemKey =
                  item.href ||
                  item.dataKey ||
                  (item.component ? `label:${item.label}` : undefined)
                const hasChildren = item.children && item.children.length > 0
                const visibleChildren: SidebarItemChild[] = (
                  item.children || []
                ).filter(Boolean)

                if (!itemKey && visibleChildren.length === 0) return null

                // Item with dropdown children (e.g. Browse, Library)
                if (hasChildren && visibleChildren.length > 0) {
                  const parentAssignedPos = itemKey
                    ? Object.keys(tempPositions).find(
                        (key) => tempPositions[key] === itemKey
                      )
                    : undefined

                  const assignedChildren = visibleChildren
                    .map((child: SidebarItemChild) => {
                      const childKey =
                        child.href ||
                        (child as any).dataKey ||
                        (child.component ? `label:${child.label}` : undefined)
                      const pos = childKey
                        ? Object.keys(tempPositions).find(
                            (key) => tempPositions[key] === childKey
                          )
                        : undefined
                      return pos ? { label: child.label, pos } : null
                    })
                    .filter(
                      (c): c is { label: string; pos: string } => c !== null
                    )

                  const isAnyAssigned =
                    !!parentAssignedPos || assignedChildren.length > 0

                  let badgeText = ""
                  if (parentAssignedPos && assignedChildren.length > 0) {
                    badgeText = `${t("posLabel")} ${parentAssignedPos}, ${assignedChildren.map((c) => c.pos).join(", ")}`
                  } else if (parentAssignedPos) {
                    badgeText = `${t("posLabel")} ${parentAssignedPos}`
                  } else if (assignedChildren.length > 0) {
                    badgeText = `${t("posLabel")} ${assignedChildren.map((c) => c.pos).join(", ")}`
                  }

                  return (
                    <DropdownMenuTrigger
                      key={itemKey || `group:${item.label}`}
                    >
                      <Button
                        variant="outline"
                        isDisabled={!focusedSlot}
                        className={cn(
                          "group flex h-auto min-h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-2xl border p-2.5 text-start text-xs font-medium transition-all select-none disabled:cursor-not-allowed disabled:opacity-50",
                          isAnyAssigned
                            ? "border-primary/40 bg-primary/5 text-primary font-semibold shadow-2xs"
                            : "border-border/70 bg-card/60 text-foreground hover:border-border hover:bg-muted/50"
                        )}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/40 text-muted-foreground group-hover:text-foreground [&>svg]:size-4">
                            {item.icon}
                          </span>
                          <span className="truncate font-semibold text-foreground">
                            {item.label}
                          </span>
                        </span>

                        <span className="ms-1 flex shrink-0 items-center gap-1.5">
                          {badgeText && (
                            <Badge
                              variant="secondary"
                              className="h-4.5 border-primary/20 bg-primary/10 px-1.5 text-[10px] font-bold text-primary"
                            >
                              {badgeText}
                            </Badge>
                          )}
                          <IconChevronDown className="size-3.5 opacity-60 transition-transform group-data-[state=open]:rotate-180" />
                        </span>
                      </Button>

                      <DropdownMenu
                        placement="bottom start"
                        className="w-56 rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-xl backdrop-blur-xl"
                      >
                        <DropdownMenuLabel>
                          {t("addToPosition", { pos: focusedSlot || "1" })}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                          {itemKey && (
                            <DropdownMenuItem
                              onAction={() => onSelectItem(itemKey)}
                              className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
                            >
                              <span className="font-semibold text-foreground">
                                {item.label} ({t("main")})
                              </span>
                              {parentAssignedPos && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 border-primary/20 bg-primary/10 px-1.5 text-[9px] font-bold text-primary"
                                >
                                  {t("posLabel")} {parentAssignedPos}
                                </Badge>
                              )}
                            </DropdownMenuItem>
                          )}

                          {itemKey && visibleChildren.length > 0 && (
                            <DropdownMenuSeparator />
                          )}

                          {visibleChildren.map((child: SidebarItemChild) => {
                            const childKey =
                              child.href ||
                              (child as any).dataKey ||
                              (child.component
                                ? `label:${child.label}`
                                : undefined)
                            if (!childKey) return null

                            const childAssignedPos = Object.keys(
                              tempPositions
                            ).find((key) => tempPositions[key] === childKey)

                            return (
                              <DropdownMenuItem
                                key={childKey}
                                onAction={() => onSelectItem(childKey)}
                                className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="flex size-5 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/40 text-muted-foreground [&>svg]:size-3">
                                    {child.icon}
                                  </span>
                                  <span className="truncate">{child.label}</span>
                                </span>
                                {childAssignedPos && (
                                  <Badge
                                    variant="secondary"
                                    className="h-4 border-primary/20 bg-primary/10 px-1.5 text-[9px] font-bold text-primary"
                                  >
                                    {t("posLabel")} {childAssignedPos}
                                  </Badge>
                                )}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuGroup>
                      </DropdownMenu>
                    </DropdownMenuTrigger>
                  )
                }

                // Single item without children
                if (itemKey) {
                  const assignedPos = Object.keys(tempPositions).find(
                    (key) => tempPositions[key] === itemKey
                  )
                  const isAssigned = !!assignedPos

                  return (
                    <Button
                      key={itemKey}
                      variant="outline"
                      isDisabled={!focusedSlot}
                      onPress={() => onSelectItem(itemKey)}
                      className={cn(
                        "group flex h-auto min-h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-2xl border p-2.5 text-start text-xs font-medium transition-all select-none disabled:cursor-not-allowed disabled:opacity-50",
                        isAssigned
                          ? "border-primary/40 bg-primary/5 text-primary font-semibold shadow-2xs"
                          : "border-border/70 bg-card/60 text-foreground hover:border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/40 text-muted-foreground group-hover:text-foreground [&>svg]:size-4">
                          {item.icon}
                        </span>
                        <span className="truncate font-semibold text-foreground">
                          {item.label}
                        </span>
                      </span>

                      {isAssigned && (
                        <Badge
                          variant="secondary"
                          className="h-4.5 shrink-0 border-primary/20 bg-primary/10 px-1.5 text-[10px] font-bold text-primary"
                        >
                          {t("posLabel")} {assignedPos}
                        </Badge>
                      )}
                    </Button>
                  )
                }

                return null
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
