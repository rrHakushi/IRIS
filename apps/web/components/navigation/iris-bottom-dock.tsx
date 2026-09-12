"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { formatBadgeNumber } from "@/lib/numbers"
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  DockItemData,
} from "@/types/sidebar-config"
import { IconLayoutGrid, IconX } from "@tabler/icons-react"
import { IrisMobileLauncher } from "./iris-mobile-launcher"
import { useUser } from "@/context/user-context"
import { getDockCustomization, type CustomDockGroup } from "@IRIS/shared"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { useAllAppSidebarConfigs } from "@/config/sidebars"
import { renderDockGroupIcon } from "@/config/dock-group-icons"

export interface IrisBottomDockProps {
  pathname: string
  navConfig?: SidebarConfig
  setOpenMobile?: (open: boolean) => void
  onOpenSettings?: () => void
  items?: DockItemData[]
  className?: string
  /** Whether the dock is being rendered in preview mode */
  isPreview?: boolean
  /** Currently focused position slot (1-4) in preview mode */
  focusedSlot?: string | null
  /** Callback when a position slot is focused */
  onFocusSlot?: (pos: string) => void
  /** Callback when a position slot is cleared */
  onClearSlot?: (pos: string) => void
  /** Lookup function for item metadata in preview mode */
  findItemByKey?: (key: string | null | undefined) => SidebarItem | undefined
  /** Temporary position slots mapping in preview mode */
  tempPositions?: Record<string, string | null>
  /** Optional label for empty slots */
  emptySlotLabel?: string
  /** Custom groups list (optional override) */
  customGroups?: CustomDockGroup[]
}

/**
 * Hook to hide the bottom dock when the page is scrolled past the top ~10%,
 * and restore visibility when back near the top of the page.
 */
function useDockScrollVisibility(
  pathname?: string,
  isPreview = false
): boolean {
  const [isVisible, setIsVisible] = useState(true)
  const isVisibleRef = useRef(true)

  useEffect(() => {
    if (isPreview) return

    // Immediately restore visibility on route changes
    setIsVisible(true)
    isVisibleRef.current = true

    let rafId: number | null = null

    const checkScroll = (e?: Event) => {
      let scrollTop = 0
      let maxScroll = 0

      const target = e?.target

      if (
        target instanceof HTMLElement &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        const isMain =
          target.tagName === "MAIN" ||
          target.getAttribute("data-slot") === "sidebar-inset"
        if (isMain || target.scrollHeight > window.innerHeight) {
          scrollTop = target.scrollTop
          maxScroll = target.scrollHeight - target.clientHeight
        } else {
          return
        }
      } else {
        const mainEl =
          (document.querySelector(
            'main[data-slot="sidebar-inset"]'
          ) as HTMLElement | null) ||
          (document.querySelector("main") as HTMLElement | null)

        if (mainEl && mainEl.scrollHeight > mainEl.clientHeight + 5) {
          scrollTop = mainEl.scrollTop
          maxScroll = mainEl.scrollHeight - mainEl.clientHeight
        } else {
          const doc = document.documentElement
          scrollTop =
            window.scrollY || doc.scrollTop || document.body.scrollTop || 0
          maxScroll =
            Math.max(doc.scrollHeight, document.body.scrollHeight) -
            (window.innerHeight || doc.clientHeight)
        }
      }

      // Show when at top ~10% of page or within initial 60px buffer
      let nextVisible = true
      if (maxScroll > 0) {
        const scrollPercentage = (scrollTop / maxScroll) * 100
        nextVisible = scrollPercentage <= 10 || scrollTop <= 60
      }

      if (isVisibleRef.current !== nextVisible) {
        isVisibleRef.current = nextVisible
        setIsVisible(nextVisible)
      }
    }

    const handleScroll = (e?: Event) => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        checkScroll(e)
      })
    }

    const initTimer = setTimeout(() => {
      checkScroll()
    }, 50)

    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    })

    return () => {
      clearTimeout(initTimer)
      window.removeEventListener("scroll", handleScroll, { capture: true })
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [pathname, isPreview])

  return isVisible
}

export function IrisBottomDock({
  pathname,
  navConfig,
  setOpenMobile,
  onOpenSettings,
  items: customItems,
  className,
  isPreview = false,
  focusedSlot,
  onFocusSlot,
  onClearSlot,
  findItemByKey,
  tempPositions,
  emptySlotLabel,
  customGroups: customGroupsProp,
}: IrisBottomDockProps): React.JSX.Element | null {
  const t = useTranslations("navigation.dock")
  const { user } = useUser()
  const isMobile = useIsMobile()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const isScrollVisible = useDockScrollVisibility(pathname, isPreview)
  const resolvedEmptyLabel = emptySlotLabel || t("empty")

  const allAppConfigs = useAllAppSidebarConfigs(null)

  const [localMap, setLocalMap] = useState<Record<string, string | null> | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("iris-phone-dock-items-default")
        return stored ? JSON.parse(stored) : null
      } catch {
        return null
      }
    }
    return null
  })

  const [localGroups, setLocalGroups] = useState<CustomDockGroup[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("iris-phone-dock-custom-groups")
        if (stored) return JSON.parse(stored)
      } catch {
        // ignore
      }
    }
    return []
  })

  const resolvedGroups = useMemo((): CustomDockGroup[] => {
    if (customGroupsProp) return customGroupsProp
    if (user?.customization) {
      const groups = getDockCustomization(user.customization).customGroups
      if (Array.isArray(groups) && groups.length > 0) return groups
    }
    return localGroups
  }, [customGroupsProp, user?.customization, localGroups])

  // Read initial local storage on mount (client-only)
  useEffect(() => {
    if (isPreview) return
    try {
      const stored = localStorage.getItem("iris-phone-dock-items-default")
      if (stored) {
        setLocalMap(JSON.parse(stored))
      }
      const storedGroups = localStorage.getItem("iris-phone-dock-custom-groups")
      if (storedGroups) {
        setLocalGroups(JSON.parse(storedGroups))
      }
    } catch {
      // ignore
    }
  }, [isPreview])

  // Listen for iris-sidebar-changed to reactively reload local storage
  useEffect(() => {
    if (isPreview) return
    const handleSidebarChanged = () => {
      try {
        const stored = localStorage.getItem("iris-phone-dock-items-default")
        setLocalMap(stored ? JSON.parse(stored) : null)
        const storedGroups = localStorage.getItem("iris-phone-dock-custom-groups")
        setLocalGroups(storedGroups ? JSON.parse(storedGroups) : [])
      } catch {
        // ignore
      }
    }
    window.addEventListener("iris-sidebar-changed", handleSidebarChanged)
    return () => {
      window.removeEventListener("iris-sidebar-changed", handleSidebarChanged)
    }
  }, [isPreview])

  // Sync server customization to localStorage when available
  useEffect(() => {
    if (isPreview) return
    if (user?.customization) {
      const dockCust = getDockCustomization(user.customization)
      const serverPositions = dockCust.positions
      if (serverPositions && Object.values(serverPositions).some(Boolean)) {
        try {
          localStorage.setItem(
            "iris-phone-dock-items-default",
            JSON.stringify(serverPositions)
          )
          setLocalMap(serverPositions)
        } catch {
          // ignore
        }
      }
      if (Array.isArray(dockCust.customGroups)) {
        try {
          localStorage.setItem(
            "iris-phone-dock-custom-groups",
            JSON.stringify(dockCust.customGroups)
          )
          setLocalGroups(dockCust.customGroups)
        } catch {
          // ignore
        }
      }
    }
  }, [user?.customization, isPreview])

  // Only render on phones (mobile) unless in preview mode (e.g. inside settings modal)
  if (!isPreview && !isMobile) {
    return null
  }
  // If custom items are provided, render custom scrolling dock
  if (customItems) {
    return (
      <IrisCustomBottomDock
        customItems={customItems}
        pathname={pathname}
        className={className}
      />
    )
  }

  // Preview mode (interactive slot selection inside settings modal)
  if (isPreview) {
    const renderPreviewSlot = (pos: string) => {
      const href = tempPositions ? tempPositions[pos] : undefined
      const item = findItemByKey ? findItemByKey(href) : undefined
      const isFocused = focusedSlot === pos
      const isAssigned = !!item

      return (
        <div
          key={pos}
          className="group/slot relative flex max-w-16 min-w-0 flex-1 flex-col items-center"
        >
          <button
            type="button"
            onClick={() => onFocusSlot?.(pos)}
            className={cn(
              "relative flex min-h-12 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-all duration-200 outline-none select-none",
              isFocused
                ? "z-10 border border-primary bg-primary/15 font-semibold text-foreground shadow-xs"
                : isAssigned
                  ? "border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  : "border border-dashed border-border/80 text-muted-foreground/60 hover:border-border hover:bg-muted/30"
            )}
          >
            {isAssigned ? (
              <>
                <span className="relative z-10 [&>svg]:size-5">
                  {item.icon}
                </span>
                <span className="relative z-10 max-w-full truncate px-0.5 text-center text-[10px] leading-tight font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-bold opacity-60">+{pos}</span>
                <span className="text-[9px] font-medium opacity-50">
                  {resolvedEmptyLabel}
                </span>
              </>
            )}
          </button>

          {isAssigned && onClearSlot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClearSlot(pos)
              }}
              className={cn(
                "text-destructive-foreground absolute -top-1 -right-1 z-20 flex size-4 cursor-pointer items-center justify-center rounded-full bg-destructive shadow-xs transition-all duration-150 hover:bg-destructive/90",
                isFocused
                  ? "scale-100 opacity-100"
                  : "scale-75 opacity-0 group-hover/slot:scale-100 group-hover/slot:opacity-100"
              )}
              aria-label={t("clearPosition", { pos })}
            >
              <IconX className="size-2.5 stroke-[3]" />
            </button>
          )}
        </div>
      )
    }

    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "pointer-events-auto relative flex w-full max-w-md items-center justify-between gap-1 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md select-none sm:gap-2",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center justify-around gap-1">
          {renderPreviewSlot("1")}
          {renderPreviewSlot("2")}
        </div>

        <div
          className="mx-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
          aria-label={t("toggleDrawer")}
        >
          <IconLayoutGrid className="size-5" />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-around gap-1">
          {renderPreviewSlot("3")}
          {renderPreviewSlot("4")}
        </div>
      </div>
    )
  }

  // Standalone Mobile Bottom Dock
  if (!navConfig || navConfig.length === 0) return null

  // Look for mobile dock section starting with #$ (e.g. #$Phone)
  const phoneSection = navConfig.find((s) => {
    const sec = s.section?.toLowerCase() || ""
    const dk = s.dataKey?.toLowerCase() || ""
    return (
      sec.startsWith("#$") ||
      sec === "phone" ||
      sec === "#$phone" ||
      dk.startsWith("#$") ||
      dk === "phone" ||
      dk === "mobile-dock"
    )
  })

  const rawItems = phoneSection?.items ?? []

  // Determine active custom dock slots: user profile customization > local storage
  const userPositions = user?.customization
    ? getDockCustomization(user.customization).positions
    : null
  const hasUserPositions =
    userPositions && Object.values(userPositions).some(Boolean)
  const customMap = hasUserPositions ? userPositions : localMap

  // Lookup helper across active config and all registered apps
  const lookupItem = (
    key: string | null | undefined
  ): SidebarItem | undefined => {
    if (!key) return undefined

    // 1. Check current app navConfig
    if (navConfig) {
      for (const sec of navConfig) {
        for (const it of sec.items) {
          const itemKey =
            it.href || it.dataKey || (it.component ? `label:${it.label}` : undefined)
          if (itemKey === key) return it
          if (it.children) {
            for (const ch of it.children) {
              const childKey =
                ch.href ||
                (ch as any).dataKey ||
                (ch.component ? `label:${ch.label}` : undefined)
              if (childKey === key) return ch as SidebarItem
            }
          }
        }
      }
    }

    // 2. Cross-app fallback: search all registered app configs
    for (const app of allAppConfigs) {
      for (const sec of app.config) {
        for (const it of sec.items) {
          const itemKey =
            it.href || it.dataKey || (it.component ? `label:${it.label}` : undefined)
          if (itemKey === key) return it
          if (it.children) {
            for (const ch of it.children) {
              const childKey =
                ch.href ||
                (ch as any).dataKey ||
                (ch.component ? `label:${ch.label}` : undefined)
              if (childKey === key) return ch as SidebarItem
            }
          }
        }
      }
    }

    return undefined
  }

  const resolveSlotItem = (pos: string): SidebarItem | undefined => {
    if (customMap) {
      if (pos in customMap) {
        const key = customMap[pos]
        if (!key) return undefined

        // Handle custom groups
        if (key.startsWith("group:")) {
          const groupId = key.slice("group:".length)
          const group = resolvedGroups.find((g: CustomDockGroup) => g.id === groupId)
          if (group) {
            const children = group.itemKeys
              .map((k: string) => lookupItem(k))
              .filter(Boolean) as SidebarItem[]
            return {
              label: group.label,
              icon: renderDockGroupIcon(group.icon, "size-5"),
              dataKey: key,
              children: children.map((c) => ({
                label: c.label,
                href: c.href,
                icon: c.icon,
              })),
            }
          }
          return undefined
        }

        return lookupItem(key)
      }
    }
    return rawItems.find((i) => i.position === Number(pos))
  }

  const item1 = resolveSlotItem("1")
  const item2 = resolveSlotItem("2")
  const item3 = resolveSlotItem("3")
  const item4 = resolveSlotItem("4")

  if (!item1 && !item2 && !item3 && !item4 && rawItems.length === 0 && !customMap) {
    return null
  }

  const checkActive = (item: SidebarItem) => {
    const isChildActive =
      item.children && item.children.some((child) => pathname === child.href)
    return (item.href && pathname === item.href) || !!isChildActive
  }

  const mapItem = (item?: SidebarItem) => {
    if (!item) {
      return (
        <div className="flex max-w-16 min-w-0 flex-1 justify-center">
          <div className="min-h-11 w-full" aria-hidden="true" />
        </div>
      )
    }
    return (
      <div className="flex max-w-16 min-w-0 flex-1 justify-center">
        <IrisDockItem
          key={item.href || item.label}
          item={{
            label: item.label,
            icon: item.icon,
            href: item.href,
            isActive: checkActive(item),
            component: item.component,
            children: item.children,
            onClick: item.onClick,
          }}
          pathname={pathname}
        />
      </div>
    )
  }

  const shouldShow = isPreview || launcherOpen || isScrollVisible

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-between gap-1 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-xl backdrop-blur-md transition-all duration-300 ease-in-out select-none sm:gap-2 md:hidden",
        shouldShow
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-28 opacity-0",
        className
      )}
    >
      {/* Left items (1 and 2) */}
      <div className="flex min-w-0 flex-1 items-center justify-around gap-1">
        {mapItem(item1)}
        {mapItem(item2)}
      </div>

      {/* Middle Mobile Launcher Button */}
      <button
        type="button"
        onClick={() => setLauncherOpen(true)}
        className="mx-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:opacity-90 active:scale-95"
        aria-label={t("toggleLauncher")}
      >
        <IconLayoutGrid className="size-5" />
      </button>

      {/* Right items (3 and 4) */}
      <div className="flex min-w-0 flex-1 items-center justify-around gap-1">
        {mapItem(item3)}
        {mapItem(item4)}
      </div>

      {/* Dedicated Mobile Launcher Bottom Sheet */}
      <IrisMobileLauncher
        open={launcherOpen}
        onOpenChange={setLauncherOpen}
        navConfig={navConfig}
        onOpenSettings={onOpenSettings}
      />
    </div>
  )
}

function IrisDockItem({
  item,
  pathname,
}: {
  item: DockItemData
  pathname?: string
}): React.JSX.Element {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  const cleanupContextMenuRef = useRef<(() => void) | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close dropdown when clicking or tapping anywhere outside
  useEffect(() => {
    if (!dropdownOpen) return

    const handleOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false)
      }
    }

    document.addEventListener("pointerdown", handleOutside, { capture: true })
    document.addEventListener("touchstart", handleOutside, { capture: true })
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handleOutside, {
        capture: true,
      })
      document.removeEventListener("touchstart", handleOutside, {
        capture: true,
      })
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [dropdownOpen])

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    if ("button" in e && e.button !== 0) return
    if (!item.children || item.children.length === 0) return

    if (cleanupContextMenuRef.current) {
      cleanupContextMenuRef.current()
    }

    isLongPressRef.current = false

    const blockContextMenu = (ev: Event) => {
      ev.preventDefault()
      ev.stopPropagation()
    }
    window.addEventListener("contextmenu", blockContextMenu, { capture: true })

    const cleanup = () => {
      setTimeout(() => {
        window.removeEventListener("contextmenu", blockContextMenu, {
          capture: true,
        })
      }, 500)
      window.removeEventListener("mouseup", cleanup)
      window.removeEventListener("touchend", cleanup)
      window.removeEventListener("touchcancel", cleanup)
      cleanupContextMenuRef.current = null
    }

    cleanupContextMenuRef.current = cleanup

    window.addEventListener("mouseup", cleanup)
    window.addEventListener("touchend", cleanup)
    window.addEventListener("touchcancel", cleanup)

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      setDropdownOpen(true)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(50)
        } catch {
          // ignore
        }
      }
    }, 250)
  }

  const endPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (isLongPressRef.current) {
      e.preventDefault()
      e.stopPropagation()
      setTimeout(() => {
        isLongPressRef.current = false
      }, 100)
    }
  }

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (cleanupContextMenuRef.current) {
      cleanupContextMenuRef.current()
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (item.onClick) {
      e.preventDefault()
      item.onClick()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  const buttonClass = cn(
    "pointer-events-auto relative flex min-h-11 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full px-1.5 py-1 transition-colors duration-150 select-none",
    item.isActive
      ? "font-semibold text-primary"
      : "text-muted-foreground hover:text-foreground"
  )

  const content = (
    <>
      {item.isActive && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full border border-primary/20 bg-primary/10"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "relative z-10 transition-transform duration-150 [&>svg]:size-5",
          item.isActive && "scale-105"
        )}
      >
        {item.icon}
      </span>
      <span className="relative z-10 max-w-full truncate px-0.5 text-center text-[10px] leading-tight font-medium whitespace-nowrap">
        {item.label}
      </span>
    </>
  )

  // If item has sub-items (children), handle both tap navigation and long-press dropdown
  if (item.children && item.children.length > 0) {
    return (
      <div ref={menuRef} className="relative flex w-full flex-col items-center">
        {item.href ? (
          <Link
            href={item.href}
            className={buttonClass}
            style={{ WebkitTouchCallout: "none" }}
            onClick={handleClick}
            onMouseDown={startPress}
            onTouchStart={startPress}
            onMouseUp={endPress}
            onTouchEnd={endPress}
            onMouseLeave={cancelPress}
            onTouchMove={cancelPress}
            onTouchCancel={cancelPress}
            onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
          >
            {content}
          </Link>
        ) : (
          <button
            type="button"
            className={buttonClass}
            style={{ WebkitTouchCallout: "none" }}
            onClick={handleClick}
            onMouseDown={startPress}
            onTouchStart={startPress}
            onMouseUp={endPress}
            onTouchEnd={endPress}
            onMouseLeave={cancelPress}
            onTouchMove={cancelPress}
            onTouchCancel={cancelPress}
            onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
          >
            {content}
          </button>
        )}

        {/* Long-press floating sub-items menu */}
        {dropdownOpen && (
          <>
            <div
              className="backdrop-blur-2xs fixed inset-0 z-40 bg-black/20 md:hidden"
              onClick={(e) => {
                e.stopPropagation()
                setDropdownOpen(false)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setDropdownOpen(false)
              }}
            />
            <div
              className="no-scrollbar absolute bottom-full left-1/2 z-50 mb-3 flex max-h-[276px] max-w-60 min-w-44 -translate-x-1/2 animate-in flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-2xl duration-150 fade-in-0 select-none touch-pan-y zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              {item.children.map((child) => {
                const isChildActive = pathname === child.href
                return child.component ? (
                  <div
                    key={child.label}
                    className="shrink-0"
                    onClick={() => setDropdownOpen(false)}
                  >
                    {child.component}
                  </div>
                ) : (
                  <Link
                    key={child.label}
                    href={child.href || "#"}
                    onClick={() => setDropdownOpen(false)}
                    className={cn(
                      "flex h-9 shrink-0 w-full items-center justify-between rounded-xl px-3 text-xs font-medium transition-colors duration-150",
                      isChildActive
                        ? "bg-primary/15 font-semibold text-primary"
                        : "text-foreground/90 hover:bg-muted/70 hover:text-foreground active:bg-muted"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      {child.icon && (
                        <span className="shrink-0 text-foreground [&>svg]:size-4.5">
                          {child.icon}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium">
                        {child.label}
                      </span>
                    </span>
                    {child.badge && (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-4 shrink-0 px-1.5 text-[10px]"
                      >
                        {formatBadgeNumber(Number(child.badge) || 0, 2)}
                      </Badge>
                    )}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  if (item.component) {
    return <>{item.component}</>
  }

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={buttonClass}>
        {content}
      </button>
    )
  }

  return (
    <Link href={item.href || "#"} className={buttonClass}>
      {content}
    </Link>
  )
}

function IrisCustomBottomDock({
  customItems,
  pathname,
  className,
}: {
  customItems: DockItemData[]
  pathname: string
  className?: string
}): React.JSX.Element {
  const isScrollVisible = useDockScrollVisibility(pathname)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY
    }
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 overflow-hidden rounded-full border border-border bg-background/90 shadow-xl backdrop-blur-md transition-all duration-300 ease-in-out select-none md:hidden",
        isScrollVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-28 opacity-0",
        className
      )}
    >
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="no-scrollbar flex w-full touch-pan-x snap-x snap-mandatory items-center overflow-x-auto px-2 py-1.5"
      >
        {customItems.map((item) => (
          <div
            key={item.label}
            className="flex flex-[0_0_20%] shrink-0 snap-center justify-center"
          >
            <IrisDockItem item={item} pathname={pathname} />
          </div>
        ))}
      </div>
    </div>
  )
}
