"use client"

import React, { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconChevronDown,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react"
import { useUser } from "@/context/user-context"
import { useAllAppSidebarConfigs } from "@/config/sidebars"
import { applySidebarCustomization } from "@/lib/navigation"
import {
  getAppSidebarCustomization,
  type AppSidebarCustomization,
} from "@IRIS/shared"
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
import { IrisUserMenu, openSettingsModal } from "./iris-user-menu"
import { useDragScroll } from "@/hooks/use-drag-scroll"

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

  // Handle query parameter based routes like ?tab=xxx
  if (href.startsWith("?") || target.startsWith("?")) {
    if (typeof window !== "undefined") {
      const search = window.location.search
      return search === href || search === target
    }
  }

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
  appId?: string
}

export function IrisSidebar({
  initialConfig,
  onOpenSettings,
  className,
  variant = "inset",
  ...props
}: IrisSidebarProps): React.JSX.Element {
  const t = useTranslations("navigation.sidebar")
  const tSettings = useTranslations("navigation.sidebarSettings")
  const { data: session } = useSession()
  const { user, updateSidebar } = useUser()
  const allAppConfigs = useAllAppSidebarConfigs(session)
  const pathname = usePathname() || "/"
  const router = useRouter()
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
  }, [activeConfig, userPermissions])

  const isRight = position === "right"
  const isTop = position === "top"
  const isBottom = position === "bottom"
  const isHorizontal = isTop || isBottom

  const horizontalNavDragScroll = useDragScroll<HTMLElement>({
    enableWheel: true,
    speed: 1.2,
  })

  const currentAppId =
    props.appId || (pathname.startsWith("/IRIS-pass") ? "iris-pass" : "iris-list")

  // Real-time synchronization of per-app sidebar layout customization
  const [appCustomization, setAppCustomization] = useState<
    AppSidebarCustomization | undefined
  >(() => {
    if (user?.customization) {
      return getAppSidebarCustomization(user.customization, currentAppId)
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("iris-sidebar-customization")
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.[currentAppId]) return parsed[currentAppId]
        }
      } catch {}
    }
    return undefined
  })

  useEffect(() => {
    if (user?.customization) {
      setAppCustomization(
        getAppSidebarCustomization(user.customization, currentAppId)
      )
    }
  }, [user?.customization, currentAppId])

  useEffect(() => {
    const handleCustChange = (e: Event) => {
      const customEvent = e as CustomEvent<
        Record<string, AppSidebarCustomization>
      >
      if (customEvent.detail?.[currentAppId]) {
        setAppCustomization(customEvent.detail[currentAppId])
      }
    }
    window.addEventListener("iris-sidebar-customization-changed", handleCustChange)
    return () => {
      window.removeEventListener(
        "iris-sidebar-customization-changed",
        handleCustChange
      )
    }
  }, [currentAppId])

  // Resolved hierarchy with user customizations applied
  const customizedConfig = useMemo(() => {
    return applySidebarCustomization(
      resolvedConfig,
      appCustomization,
      allAppConfigs
    )
  }, [resolvedConfig, appCustomization, allAppConfigs])


  // Ensure parent items of active children are opened on route change
  useEffect(() => {
    customizedConfig.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((child) =>
            isRouteActive(pathname, child.href)
          )
          if (hasActiveChild) {
            const key = item.dataKey || item.label
            setOpenItems((prev) => {
              if (prev[key]) return prev
              return { ...prev, [key]: true }
            })
          }
        }
      })
    })
  }, [pathname, customizedConfig])

  // --- TOP / BOTTOM HORIZONTAL BAR MODE ---
  if (isHorizontal && !isMobile) {
    return (
      <header
        className={cn(
          "sticky z-40 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8 select-none transition-colors",
          isTop
            ? "top-0 md:rounded-t-2xl"
            : "bottom-0 mt-auto md:rounded-b-2xl border-t border-b-0",
          className
        )}
      >
        {/* Left: App Branding Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-[240px] shrink-0">
            <IrisAppMenu />
          </div>
        </div>

        {/* Center: Horizontally Scrollable Segmented Navigation with Section Dropdowns (mouse drag-to-scroll) */}
        <div className="relative flex min-w-0 flex-1 items-center overflow-hidden">
          <nav
            ref={horizontalNavDragScroll.ref}
            {...horizontalNavDragScroll.events}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-start overflow-x-auto no-scrollbar scrollbar-none px-2 py-1 select-none",
              horizontalNavDragScroll.isDragging
                ? "cursor-grabbing"
                : "cursor-grab"
            )}
          >
            <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1 shadow-2xs backdrop-blur-md shrink-0 mx-auto">
            {customizedConfig.map((section: SidebarSection, sectionIdx: number) => {
              const visibleItems = section.items.filter(
                (item: SidebarItem) => (item.position ?? 0) >= 0
              )
              if (visibleItems.length === 0) return null

              const hasSectionTitle = Boolean(
                section.section && section.section.trim() !== ""
              )

              // CASE 1: Dropdown by section (if label not empty)
              if (hasSectionTitle) {
                const isSectionActive = visibleItems.some((item) => {
                  if (item.isActive) return true
                  if (isRouteActive(pathname, item.href)) return true
                  if (
                    item.children?.some((c) => isRouteActive(pathname, c.href))
                  )
                    return true
                  return false
                })

                const sectionHref = (section as any).href as string | undefined
                const hasValidSectionHref = Boolean(
                  sectionHref && sectionHref !== "#"
                )

                const menuContent = (
                  <DropdownMenu
                    placement={isBottom ? "top start" : "bottom start"}
                    offset={8}
                    className="min-w-48 rounded-2xl p-1.5 shadow-xl"
                  >
                    <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {section.section}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {visibleItems.map((item, itemIdx) => {
                      const isDirectActive =
                        item.isActive !== undefined
                          ? item.isActive
                          : isRouteActive(pathname, item.href)
                      const hasChildren = Boolean(
                        item.children && item.children.length > 0
                      )
                      const isChildActive =
                        hasChildren &&
                        item.children!.some((c) =>
                          isRouteActive(pathname, c.href)
                        )
                      const isActive = isDirectActive || isChildActive

                      if (item.component) {
                        return (
                          <div key={itemIdx} className="p-1">
                            {item.component}
                          </div>
                        )
                      }

                      if (hasChildren) {
                        return (
                          <DropdownMenuSub key={itemIdx}>
                            <DropdownMenuSubTrigger
                              textValue={item.label}
                              className={cn(
                                "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs",
                                isChildActive &&
                                  "bg-primary/10 font-bold text-primary"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                {item.icon && (
                                  <span className="size-3.5 shrink-0">
                                    {item.icon}
                                  </span>
                                )}
                                <span>{item.label}</span>
                              </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent
                              placement="end top"
                              offset={6}
                              className="min-w-44 rounded-2xl p-1.5 shadow-xl"
                            >
                              {item.children!.map((child, cIdx) => {
                                const isSubActive =
                                  child.isActive !== undefined
                                    ? child.isActive
                                    : isRouteActive(pathname, child.href)
                                return (
                                  <DropdownMenuItem
                                    key={cIdx}
                                    textValue={child.label}
                                    className={cn(
                                      "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs",
                                      isSubActive &&
                                        "bg-primary/10 font-bold text-primary"
                                    )}
                                    onAction={() => {
                                      if (child.href) router.push(child.href)
                                      else child.onClick?.()
                                    }}
                                  >
                                    <span className="flex items-center gap-2">
                                      {child.icon && (
                                        <span className="size-3.5 shrink-0">
                                          {child.icon}
                                        </span>
                                      )}
                                      <span>{child.label}</span>
                                    </span>
                                    {child.badge && (
                                      <Badge
                                        variant="secondary"
                                        className="h-4 px-1.5 text-[9px]"
                                      >
                                        {formatBadge(child.badge)}
                                      </Badge>
                                    )}
                                  </DropdownMenuItem>
                                )
                              })}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )
                      }

                      return (
                        <DropdownMenuItem
                          key={itemIdx}
                          textValue={item.label}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs",
                            isActive && "bg-primary/10 font-bold text-primary"
                          )}
                          onAction={() => {
                            if (item.href) router.push(item.href)
                            else item.onClick?.()
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {item.icon && (
                              <span className="size-3.5 shrink-0">
                                {item.icon}
                              </span>
                            )}
                            <span>{item.label}</span>
                          </span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1.5 text-[9px]"
                            >
                              {formatBadge(item.badge)}
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenu>
                )

                if (hasValidSectionHref) {
                  return (
                    <div
                      key={sectionIdx}
                      className={cn(
                        "group flex shrink-0 items-center rounded-xl transition-all duration-200 border",
                        isSectionActive
                          ? "border-primary/40 bg-primary/15 text-primary shadow-xs ring-1 ring-primary/20"
                          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <Link
                        href={sectionHref!}
                        draggable={false}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-s-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors select-none",
                          isRouteActive(pathname, sectionHref)
                            ? "font-bold text-primary"
                            : "text-inherit hover:text-foreground"
                        )}
                      >
                        <span>{section.section}</span>
                      </Link>
                      <span
                        className={cn(
                          "h-3.5 w-px shrink-0 transition-colors",
                          isSectionActive ? "bg-primary/30" : "bg-border/60"
                        )}
                      />
                      <DropdownMenuTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "flex h-7 w-6 cursor-pointer items-center justify-center rounded-none rounded-e-xl p-0 transition-colors",
                            isSectionActive
                              ? "hover:bg-primary/20 text-primary"
                              : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                          )}
                          aria-label={`${section.section} options`}
                        >
                          <IconChevronDown className="size-3.5 opacity-70" />
                        </Button>
                        {menuContent}
                      </DropdownMenuTrigger>
                    </div>
                  )
                }

                return (
                  <DropdownMenuTrigger key={sectionIdx}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                        isSectionActive
                          ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                      )}
                    >
                      <span>{section.section}</span>
                      <IconChevronDown className="size-3.5 opacity-60" />
                    </Button>
                    {menuContent}
                  </DropdownMenuTrigger>
                )
              }

              // CASE 2: Section label is empty -> Render items directly as pills in the segmented bar!
              return visibleItems.map((item, itemIdx) => {
                const hasChildren = Boolean(
                  item.children && item.children.length > 0
                )
                const isChildActive =
                  hasChildren &&
                  item.children!.some((c) => isRouteActive(pathname, c.href))
                const isDirectActive =
                  item.isActive !== undefined
                    ? item.isActive
                    : isRouteActive(pathname, item.href)
                const isActive = isDirectActive || isChildActive
                const hasValidHref = Boolean(item.href && item.href !== "#")

                if (item.component) {
                  return (
                    <div key={itemIdx} className="shrink-0">
                      {item.component}
                    </div>
                  )
                }

                if (hasChildren) {
                  const childrenMenu = (
                    <DropdownMenu
                      placement={isBottom ? "top start" : "bottom start"}
                      offset={8}
                      className="min-w-44 rounded-2xl p-1.5 shadow-xl"
                    >
                      {item.children!.map((child, cIdx) => {
                        const isSubActive =
                          child.isActive !== undefined
                            ? child.isActive
                            : isRouteActive(pathname, child.href)
                        return (
                          <DropdownMenuItem
                            key={cIdx}
                            textValue={child.label}
                            className={cn(
                              "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs",
                              isSubActive &&
                                "bg-primary/10 font-bold text-primary"
                            )}
                            onAction={() => {
                              if (child.href) router.push(child.href)
                              else child.onClick?.()
                            }}
                          >
                            <span className="flex items-center gap-2">
                              {child.icon && (
                                <span className="size-3.5 shrink-0">
                                  {child.icon}
                                </span>
                              )}
                              <span>{child.label}</span>
                            </span>
                            {child.badge && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1.5 text-[9px]"
                              >
                                {formatBadge(child.badge)}
                              </Badge>
                            )}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenu>
                  )

                  if (hasValidHref) {
                    return (
                      <div
                        key={itemIdx}
                        className={cn(
                          "group flex shrink-0 items-center rounded-xl transition-all duration-200 border",
                          isActive
                            ? "border-primary/40 bg-primary/15 text-primary shadow-xs ring-1 ring-primary/20"
                            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <Link
                          href={item.href!}
                          draggable={false}
                          onClick={item.onClick}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-s-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors select-none",
                            isDirectActive
                              ? "font-bold text-primary"
                              : "text-inherit hover:text-foreground"
                          )}
                        >
                          {item.icon && (
                            <span className="size-3.5 shrink-0">{item.icon}</span>
                          )}
                          <span>{item.label}</span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1.5 text-[9px]"
                            >
                              {formatBadge(item.badge)}
                            </Badge>
                          )}
                        </Link>

                        <span
                          className={cn(
                            "h-3.5 w-px shrink-0 transition-colors",
                            isActive ? "bg-primary/30" : "bg-border/60"
                          )}
                        />

                        <DropdownMenuTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "flex h-7 w-6 cursor-pointer items-center justify-center rounded-none rounded-e-xl p-0 transition-colors",
                              isActive
                                ? "hover:bg-primary/20 text-primary"
                                : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            )}
                            aria-label={`${item.label} options`}
                          >
                            <IconChevronDown className="size-3.5 opacity-70" />
                          </Button>
                          {childrenMenu}
                        </DropdownMenuTrigger>
                      </div>
                    )
                  }

                  return (
                    <DropdownMenuTrigger key={itemIdx}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                          isActive
                            ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                        )}
                      >
                        {item.icon && (
                          <span className="size-3.5 shrink-0">{item.icon}</span>
                        )}
                        <span>{item.label}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 text-[9px]"
                          >
                            {formatBadge(item.badge)}
                          </Badge>
                        )}
                        <IconChevronDown className="size-3.5 opacity-60" />
                      </Button>
                      {childrenMenu}
                    </DropdownMenuTrigger>
                  )
                }

                // Standard Pill Button / Link
                if (hasValidHref) {
                  return (
                    <Link
                      key={itemIdx}
                      href={item.href!}
                      draggable={false}
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none",
                        isDirectActive
                          ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                      )}
                      onClick={item.onClick}
                    >
                      {item.icon && (
                        <span className="size-3.5 shrink-0">{item.icon}</span>
                      )}
                      <span>{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[9px]"
                        >
                          {formatBadge(item.badge)}
                        </Badge>
                      )}
                    </Link>
                  )
                }

                return (
                  <button
                    key={itemIdx}
                    type="button"
                    draggable={false}
                    onClick={item.onClick}
                    className={cn(
                      "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none",
                      isActive
                        ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                    )}
                  >
                    {item.icon && (
                      <span className="size-3.5 shrink-0 pointer-events-none">{item.icon}</span>
                    )}
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[9px]"
                      >
                        {formatBadge(item.badge)}
                      </Badge>
                    )}
                  </button>
                )
              })
            })}
          </div>
        </nav>
      </div>

        {/* Right: Merged User Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-[240px] shrink-0 flex justify-end">
            <IrisUserMenu
              onOpenSettings={onOpenSettings}
              placement={isBottom ? "top end" : "bottom end"}
            />
          </div>
        </div>
      </header>
    )
  }

  // --- VERTICAL SIDEBAR MODE (LEFT / RIGHT) ---
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
          {customizedConfig.map((section: SidebarSection, sectionIdx: number) => {
            const visibleItems = section.items.filter(
              (item: SidebarItem) => (item.position ?? 0) >= 0
            )
            if (visibleItems.length === 0) return null

            const secKey =
              section.dataKey || section.section || `sec-${sectionIdx}`
            const isExpanded =
              state === "collapsed" ? true : (expandedSections[secKey] ?? true)
            const isCustomSec = secKey.startsWith("group-sec:")

            return (
              <SidebarGroup key={sectionIdx} className="space-y-1 px-2 py-1">
                {section.section && (
                  <SidebarGroupLabel
                    elementType="div"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggleSection(secKey)
                      }
                    }}
                    onClick={() => toggleSection(secKey)}
                    className="group/section flex w-full cursor-pointer items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors select-none group-data-[collapsible=icon]:hidden hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{section.section}</span>
                      {isCustomSec && (
                        <Badge
                          variant="secondary"
                          className="h-3.5 px-1 text-[8px] uppercase tracking-normal"
                        >
                          {tSettings("customBadge")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openSettingsModal("sidebar")
                        }}
                        className="opacity-0 group-hover/section:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
                        title={tSettings("customizeSidebar")}
                        aria-label={tSettings("customizeSidebar")}
                      >
                        <IconAdjustmentsHorizontal className="size-3" />
                      </button>
                      <IconChevronDown
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          !isExpanded && "-rotate-90"
                        )}
                      />
                    </div>
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
                          child.isActive !== undefined
                            ? child.isActive
                            : isRouteActive(pathname, child.href)
                        )
                      const isDirectActive =
                        item.isActive !== undefined
                          ? item.isActive
                          : isRouteActive(pathname, item.href)
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
                                      const isSubActive =
                                        child.isActive !== undefined
                                          ? child.isActive
                                          : isRouteActive(pathname, child.href)

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
                              {...(item.dataKey?.startsWith("link:") &&
                              item.href?.startsWith("http")
                                ? {
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                  }
                                : {})}
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

        {/* Footer: Custom widgets (negative position items) & Merged User profile menu */}
        <SidebarFooter className="border-t border-sidebar-border/60 p-2">
          {customizedConfig
            .flatMap((s) => s.items)
            .filter((item) => (item.position ?? 0) < 0)
            .map((item, idx) => (
              <div key={idx} className="w-full">
                {item.component ? item.component : null}
              </div>
            ))}

          <IrisUserMenu
            onOpenSettings={onOpenSettings}
            placement={isMobile ? "top" : undefined}
          />
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

export default IrisSidebar
