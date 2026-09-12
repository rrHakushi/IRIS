"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { hasPermission } from "@IRIS/permissions"
import { cn } from "@workspace/ui/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Badge } from "@workspace/ui/components/badge"
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  SidebarSection,
} from "@/types/sidebar-config"
import { formatBadgeNumber } from "@/lib/numbers"
import { useIrisSidebar } from "./sidebar-provider"
import { IrisBottomDock } from "./iris-bottom-dock"
import { IrisAppMenu } from "./iris-app-menu"
import { IrisUserMenu } from "./iris-user-menu"

function normalizePath(path: string): string {
  if (!path) return "/"
  const trimmed = path.replace(/\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

function isRouteActive(currentPath: string, href?: string): boolean {
  if (!href || href === "#") return false
  const path = normalizePath(currentPath)
  const target = normalizePath(href)

  if (path === target) return true

  // App roots and single-segment roots (e.g. "/", "/IRIS-list") must be exact match
  const segments = target.split("/").filter(Boolean)
  if (segments.length <= 1) return false

  return path.startsWith(`${target}/`)
}

function formatBadge(badge: string | number | undefined): string | null {
  if (badge === undefined || badge === null || badge === "") return null
  if (typeof badge === "number") {
    return formatBadgeNumber(badge, 2)
  }
  const numeric = Number(badge)
  if (!isNaN(numeric) && String(badge).trim() !== "") {
    return formatBadgeNumber(numeric, 2)
  }
  return String(badge)
}

export interface IrisSidebarProps extends Omit<
  React.ComponentProps<typeof Sidebar>,
  "children"
> {
  initialConfig?: SidebarConfig
  onOpenSettings?: () => void
}

export function IrisSidebar({
  initialConfig,
  onOpenSettings,
  className,
  variant = "inset",
  ...props
}: IrisSidebarProps): React.JSX.Element {
  const t = useTranslations("navigation.sidebar")
  const { data: session } = useSession()
  const pathname = usePathname() || "/"
  const { isMobile, setOpenMobile, state } = useSidebar()
  const { sidebarConfig, position } = useIrisSidebar(initialConfig)
  const activeConfig =
    sidebarConfig && sidebarConfig.length > 0
      ? sidebarConfig
      : initialConfig || []

  // Track expanded state of menu items with submenus
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  // Track expanded state for sections (open by default)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})

  const toggleSection = (secKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [secKey]: prev[secKey] !== undefined ? !prev[secKey] : false,
    }))
  }

  const toggleItem = (key: string, currentOpen?: boolean) => {
    setOpenItems((prev) => ({
      ...prev,
      [key]: currentOpen !== undefined ? !currentOpen : !prev[key],
    }))
  }

  // Filter and sort items based on permissions and position
  const userPermissions = (session?.user as any)?.permissions ?? null

  const resolvedConfig = useMemo(() => {
    return activeConfig
      .filter((section: SidebarSection) => {
        const secName = section.section?.toLowerCase() || ""
        // Exclude mobile-only dock sections (starting with #$) from desktop sidebar
        if (secName.startsWith("#$")) return false
        if (
          section.permissions &&
          !hasPermission(userPermissions, section.permissions, "any")
        ) {
          return false
        }
        return true
      })
      .map((section: SidebarSection) => {
        const filteredItems = section.items
          .filter((item: SidebarItem) => {
            if (
              item.permissions &&
              !hasPermission(userPermissions, item.permissions, "any")
            ) {
              return false
            }
            return true
          })
          .map((item: SidebarItem) => {
            if (!item.children) return item
            const filteredChildren = item.children.filter(
              (child: SidebarItemChild) => {
                if (
                  child.permissions &&
                  !hasPermission(userPermissions, child.permissions, "any")
                ) {
                  return false
                }
                return true
              }
            )
            return { ...item, children: filteredChildren }
          })

        // Sort positive at top (1, 2, ...), undefined in middle (0), negative in footer (-1, -2, ...)
        const indexed = filteredItems.map((item, idx) => ({ item, idx }))
        indexed.sort((a, b) => {
          const posA = a.item.position !== undefined ? a.item.position : 0
          const posB = b.item.position !== undefined ? b.item.position : 0
          if (posA > 0 && posB > 0) return posA - posB || a.idx - b.idx
          if (posA > 0) return -1
          if (posB > 0) return 1
          if (posA < 0 && posB < 0) return posA - posB || a.idx - b.idx
          if (posA < 0) return 1
          if (posB < 0) return -1
          return a.idx - b.idx
        })

        return {
          ...section,
          items: indexed.map((x) => x.item),
        }
      })
  }, [sidebarConfig, userPermissions])

  const isRight = position === "right"

  // Ensure parent items of active children are opened on route change
  useEffect(() => {
    resolvedConfig.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((child) =>
            isRouteActive(pathname, child.href)
          )
          if (hasActiveChild) {
            const key = item.dataKey || item.label
            setOpenItems((prev) => ({ ...prev, [key]: true }))
          }
        }
      })
    })
  }, [pathname, resolvedConfig])

  return (
    <>
      <Sidebar
        side={isRight ? "right" : "left"}
        variant={variant}
        className={cn(className)}
        {...props}
      >
        {/* Header: App Context Switcher */}
        <SidebarHeader className="border-b border-sidebar-border/60 p-2">
          <IrisAppMenu />
        </SidebarHeader>

        {/* Content: Categorized Menu Sections */}
        <SidebarContent className="no-scrollbar">
          {resolvedConfig.map((section: SidebarSection, sectionIdx: number) => {
            const visibleItems = section.items.filter(
              (item: SidebarItem) => (item.position ?? 0) >= 0
            )
            if (visibleItems.length === 0) return null

            const secKey =
              section.dataKey || section.section || `sec-${sectionIdx}`
            const isExpanded =
              state === "collapsed" ? true : (expandedSections[secKey] ?? true)

            return (
              <SidebarGroup key={sectionIdx} className="space-y-1 px-2 py-1">
                {section.section && (
                  <SidebarGroupLabel
                    elementType="button"
                    onClick={() => toggleSection(secKey)}
                    className="flex w-full cursor-pointer items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors select-none group-data-[collapsible=icon]:hidden hover:text-foreground"
                  >
                    <span>{section.section}</span>
                    <IconChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                  </SidebarGroupLabel>
                )}

                {isExpanded && (
                  <SidebarMenu className="gap-1 rounded-2xl border border-border/50 bg-card/50 p-1.5 shadow-xs transition-all group-data-[collapsible=icon]:border-border/40 group-data-[collapsible=icon]:bg-card/40 group-data-[collapsible=icon]:p-1">
                    {visibleItems.map((item: SidebarItem, itemIdx: number) => {
                      const itemKey = item.dataKey || item.label
                      const hasChildren = !!(
                        item.children && item.children.length > 0
                      )
                      const isChildActive =
                        hasChildren &&
                        item.children!.some((child: SidebarItemChild) =>
                          isRouteActive(pathname, child.href)
                        )
                      const isDirectActive = isRouteActive(pathname, item.href)
                      const isActive = isDirectActive || isChildActive

                      const isOpen =
                        openItems[itemKey] !== undefined
                          ? openItems[itemKey]
                          : isChildActive

                      // If item is a custom component, render it directly
                      if (item.component) {
                        return (
                          <SidebarMenuItem key={itemIdx}>
                            {item.component}
                          </SidebarMenuItem>
                        )
                      }

                      return (
                        <SidebarMenuItem key={itemIdx}>
                          {hasChildren ? (
                            <div className="flex w-full flex-col">
                              <div className="relative flex w-full items-center">
                                <SidebarMenuButton
                                  href={item.href}
                                  isActive={isActive}
                                  tooltip={
                                    state === "collapsed"
                                      ? item.label
                                      : undefined
                                  }
                                  className={cn(
                                    "w-full justify-between gap-2 pe-7",
                                    isDirectActive
                                      ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary"
                                      : isChildActive
                                        ? "font-medium text-foreground"
                                        : ""
                                  )}
                                  onClick={
                                    !item.href
                                      ? () => toggleItem(itemKey, isOpen)
                                      : undefined
                                  }
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {item.icon && (
                                      <span className="shrink-0">
                                        {item.icon}
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {item.label}
                                    </span>
                                  </span>
                                  {item.badge && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 shrink-0 px-1.5 text-[10px]"
                                    >
                                      {formatBadge(item.badge)}
                                    </Badge>
                                  )}
                                </SidebarMenuButton>

                                {/* Dedicated Chevron button to expand/collapse */}
                                <SidebarMenuAction
                                  showOnHover={false}
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    toggleItem(itemKey, isOpen)
                                  }}
                                  aria-label={
                                    isOpen ? t("collapse") : t("expand")
                                  }
                                >
                                  <IconChevronDown
                                    className={cn(
                                      "size-3.5 transition-transform duration-200",
                                      isOpen && "rotate-180"
                                    )}
                                  />
                                </SidebarMenuAction>
                              </div>

                              {isOpen && (
                                <SidebarMenuSub className="ms-3.5 me-0 mt-1 border-s border-sidebar-border/60 ps-2 pe-0">
                                  {item.children!.map(
                                    (
                                      child: SidebarItemChild,
                                      childIdx: number
                                    ) => {
                                      const isSubActive = isRouteActive(
                                        pathname,
                                        child.href
                                      )

                                      if (child.component) {
                                        return (
                                          <SidebarMenuSubItem key={childIdx}>
                                            {child.component}
                                          </SidebarMenuSubItem>
                                        )
                                      }

                                      return (
                                        <SidebarMenuSubItem key={childIdx}>
                                          <SidebarMenuSubButton
                                            href={child.href || "#"}
                                            isActive={isSubActive}
                                            className={cn(
                                              "w-full justify-between gap-2",
                                              isSubActive &&
                                                "bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary"
                                            )}
                                          >
                                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                              {child.icon && (
                                                <span className="shrink-0">
                                                  {child.icon}
                                                </span>
                                              )}
                                              <span className="truncate">
                                                {child.label}
                                              </span>
                                            </span>
                                            {child.badge && (
                                              <Badge
                                                variant="secondary"
                                                className="ml-auto h-4 shrink-0 px-1.5 text-[10px]"
                                              >
                                                {formatBadge(child.badge)}
                                              </Badge>
                                            )}
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      )
                                    }
                                  )}
                                </SidebarMenuSub>
                              )}
                            </div>
                          ) : (
                            <SidebarMenuButton
                              href={item.href || "#"}
                              isActive={isDirectActive}
                              tooltip={
                                state === "collapsed" ? item.label : undefined
                              }
                              className={cn(
                                "w-full justify-between gap-2",
                                isDirectActive &&
                                  "bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary"
                              )}
                              onClick={item.onClick}
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                                {item.icon && (
                                  <span className="shrink-0">{item.icon}</span>
                                )}
                                <span className="truncate">{item.label}</span>
                              </span>
                              {item.badge && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto h-4 shrink-0 px-1.5 text-[10px]"
                                >
                                  {formatBadge(item.badge)}
                                </Badge>
                              )}
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                )}
              </SidebarGroup>
            )
          })}
        </SidebarContent>

        {/* Footer: Custom widgets (negative position items) & User profile */}
        <SidebarFooter className="border-t border-sidebar-border/60 p-2">
          {resolvedConfig
            .flatMap((s) => s.items)
            .filter((item) => (item.position ?? 0) < 0)
            .map((item, idx) => (
              <div key={idx} className="w-full">
                {item.component ? item.component : null}
              </div>
            ))}

          <IrisUserMenu onOpenSettings={onOpenSettings} />
        </SidebarFooter>
      </Sidebar>

      {/* Mobile Bottom Dock (rendered on phones only) */}
      {isMobile ? (
        <IrisBottomDock
          pathname={pathname}
          navConfig={activeConfig}
          setOpenMobile={setOpenMobile}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
    </>
  )
}
