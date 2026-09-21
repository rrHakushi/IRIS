"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut, signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import {
  IconApps,
  IconChevronDown,
  IconX,
  IconPinFilled,
  IconPencil,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@tabler/icons-react"
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  SidebarSection,
} from "@/types/sidebar-config"
import { useIrisApps, renderIrisAppIcon, type IrisApp } from "@/config/irisApps"
import { renderBookmarkIcon } from "@/config/bookmark-icons"
import { BookmarkDialog } from "./bookmark-dialog"
import { formatBadgeNumber } from "@/lib/numbers"
import { useUser } from "@/context/user-context"
import { elysia } from "@/lib/elysia"
import { hasPermission } from "@IRIS/permissions"
import { type UserBookmark } from "@IRIS/shared"
import { toast } from "sonner"
import { IrisSidebarUserCard } from "./iris-sidebar-user-card"
import { IrisUserMenu } from "./iris-user-menu"

function normalizePath(path: string): string {
  if (!path) return ""
  return path.replace(/\/$/, "")
}

function isRouteActive(currentPath: string, targetHref?: string): boolean {
  if (!targetHref) return false
  const normCurrent = normalizePath(currentPath)
  const normTarget = normalizePath(targetHref)
  if (normTarget === "" || normTarget === "/") {
    return normCurrent === "" || normCurrent === "/"
  }
  return normCurrent === normTarget || normCurrent.startsWith(`${normTarget}/`)
}

function isBookmarkActive(currentPath: string, bookmarkUrl?: string): boolean {
  if (!bookmarkUrl) return false
  const normCurrent = currentPath.replace(/\/$/, "") || "/"
  let targetPath = bookmarkUrl

  try {
    if (
      bookmarkUrl.startsWith("http://") ||
      bookmarkUrl.startsWith("https://")
    ) {
      if (
        typeof window !== "undefined" &&
        window.location.href === bookmarkUrl
      ) {
        return true
      }
      const parsed = new URL(bookmarkUrl)
      targetPath = parsed.pathname
    } else {
      if (bookmarkUrl.includes("?") || bookmarkUrl.includes("#")) {
        if (
          typeof window !== "undefined" &&
          `${window.location.pathname}${window.location.search}${window.location.hash}` ===
            bookmarkUrl
        ) {
          return true
        }
        targetPath = bookmarkUrl.split("?")[0]?.split("#")[0] || "/"
      }
    }
  } catch {
    // ignore
  }

  const normTarget = targetPath.replace(/\/$/, "") || "/"
  return normCurrent === normTarget
}

export interface IrisMobileLauncherProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navConfig?: SidebarSection[]
  onOpenSettings?: () => void
}

export function IrisMobileLauncher({
  open,
  onOpenChange,
  navConfig = [],
  onOpenSettings,
}: IrisMobileLauncherProps): React.JSX.Element {
  const t = useTranslations("navigation.mobileLauncher")
  const irisApps = useIrisApps()
  const pathname = usePathname() || "/"
  const router = useRouter()
  const { data: session } = useSession()
  const { user } = useUser()
  const isAuthenticated = Boolean(session?.user)
  const userPermissions = (session?.user as any)?.permissions ?? null

  const visibleApps = React.useMemo((): IrisApp[] => {
    return irisApps.filter((app: IrisApp): boolean => {
      if (!app.permissions) return true
      return hasPermission(userPermissions, app.permissions, "any")
    })
  }, [irisApps, userPermissions])

  const [isEditingApps, setIsEditingApps] = useState(false)
  const [appOrder, setAppOrder] = useState<string[]>([])
  const initialAppOrderRef = React.useRef<string[]>([])

  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([])
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)

  // Load custom app order from localStorage
  useEffect(() => {
    try {
      const savedApps = localStorage.getItem("iris_app_order")
      if (savedApps) {
        setAppOrder(JSON.parse(savedApps))
      }
    } catch {
      // ignore
    }
  }, [])

  const sortedApps = React.useMemo((): IrisApp[] => {
    if (!appOrder || appOrder.length === 0) return visibleApps
    const map = new Map(visibleApps.map((a) => [a.name, a]))
    const ordered: IrisApp[] = []
    appOrder.forEach((name) => {
      const app = map.get(name)
      if (app) {
        ordered.push(app)
        map.delete(name)
      }
    })
    map.forEach((app) => ordered.push(app))
    return ordered
  }, [visibleApps, appOrder])

  const activeApp = React.useMemo(() => {
    const current = sortedApps.find((app) =>
      app.href !== "/" ? pathname.startsWith(app.href) : pathname === "/"
    )
    return current || sortedApps[0] || irisApps[0]
  }, [pathname, sortedApps, irisApps])

  const startEditingApps = () => {
    initialAppOrderRef.current = [...appOrder]
    setIsEditingApps(true)
  }

  const cancelEditingApps = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAppOrder(initialAppOrderRef.current)
    setIsEditingApps(false)
  }

  const finishEditingApps = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      localStorage.setItem("iris_app_order", JSON.stringify(appOrder))
    } catch {
      // ignore
    }
    setIsEditingApps(false)
  }

  const moveApp = (e: React.MouseEvent, index: number, direction: -1 | 1) => {
    e.preventDefault()
    e.stopPropagation()
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sortedApps.length) return
    const newApps = [...sortedApps]
    const moved = newApps[index]
    if (!moved) return
    newApps.splice(index, 1)
    newApps.splice(targetIndex, 0, moved)
    const newOrder = newApps.map((a) => a.name)
    setAppOrder(newOrder)
  }

  // Fetch bookmarks from backend on initial mount
  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarks([])
      return
    }

    const fetchBookmarks = async () => {
      try {
        const { data, error } = await elysia.users.me.bookmarks.get({
          fetch: { credentials: "include" },
        })
        if (!error && data?.bookmarks) {
          setBookmarks(data.bookmarks)
        }
      } catch {
        // ignore
      }
    }

    fetchBookmarks()
  }, [isAuthenticated])

  const handleSaveBookmark = async (data: {
    id?: string
    title: string
    url: string
    icon?: string
    color?: string
    pinned?: boolean
    appId?: string
    group?: string
  }) => {
    if (isAuthenticated) {
      const { data: resData, error } = await elysia.users.me.bookmarks.post(
        {
          title: data.title,
          url: data.url,
          icon: data.icon,
          color: data.color,
          pinned: data.pinned,
          appId: data.appId,
          group: data.group,
        },
        { fetch: { credentials: "include" } }
      )
      if (error || !resData?.bookmark) {
        throw new Error("Failed to create bookmark")
      }
      setBookmarks((prev) => [...prev, resData.bookmark])
      toast.success(t("bookmarkCreated"))
    }
  }

  const handleOpenAddBookmark = () => {
    onOpenChange(false)
    setTimeout(() => {
      setBookmarkDialogOpen(true)
    }, 150)
  }

  // Track expanded state for sections (open by default)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    Overview: true,
    Collections: true,
    Storage: true,
    "Plan & Status": true,
    Administration: true,
  })

  // Track expanded state for items with children (CLOSED by default like sidebar)
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const toggleSection = (secName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [secName]: !prev[secName],
    }))
  }

  const toggleItem = (itemKey: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }))
  }

  const displayName = user?.displayName || user?.username || "IRIS Operator"
  const userEmail = user?.email || "operator@iris.local"
  const username = user?.username || "operator"

  // Filter out mobile dock sections (#$Phone) from launcher sections
  const launcherSections = navConfig.filter((sec) => {
    const name = sec.section?.toLowerCase() || ""
    return (
      !name.startsWith("#$") && sec.dataKey?.toLowerCase() !== "mobile-dock"
    )
  })

  // Ensure parent items of active children are opened on route change
  useEffect(() => {
    launcherSections.forEach((section) => {
      section.items.forEach((item, iIdx) => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((child) =>
            isRouteActive(pathname, child.href)
          )
          if (hasActiveChild) {
            const key = item.dataKey || item.label || `item-${iIdx}`
            setOpenItems((prev) => ({ ...prev, [key]: true }))
          }
        }
      })
    })
  }, [pathname, launcherSections])

  const handleNavigate = (href?: string) => {
    if (href) {
      onOpenChange(false)
      router.push(href)
    }
  }

  return (
    <>
      <Sheet
        isOpen={open}
        onOpenChange={onOpenChange}
        side="bottom"
        showCloseButton={false}
        className="z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-t-[2rem] border-t border-border/80 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl md:hidden"
      >
        {/* Top Grab Handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-2">
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <SheetHeader className="sr-only">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-2">
          {/* App Switcher Slideable Row (Pure Icons, Horizontally Scrollable) */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span>
                {isEditingApps ? t("reorganizeMenu") : t("applications")}
              </span>
              {isEditingApps ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={cancelEditingApps}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <IconX className="size-3" />
                    <span>{t("cancel")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={finishEditingApps}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <IconCheck className="size-3.5" />
                    <span>{t("done")}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditingApps}
                  className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <IconPencil className="size-3" />
                  <span>{t("edit")}</span>
                </button>
              )}
            </div>

            <div className="no-scrollbar flex w-full touch-pan-x items-center gap-3 overflow-x-auto scroll-smooth px-1 py-1">
              {sortedApps.map((app: IrisApp, index: number) => {
                const isAppActive =
                  app.href !== "/"
                    ? pathname.startsWith(app.href)
                    : pathname === "/"

                return (
                  <div
                    key={app.name}
                    className="group flex w-16 shrink-0 flex-col items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditingApps) handleNavigate(app.href)
                      }}
                      className={cn(
                        "relative flex size-12 cursor-pointer items-center justify-center transition-transform active:scale-95",
                        isAppActive && "scale-105"
                      )}
                    >
                      {renderIrisAppIcon(app, "size-[38px]")}
                    </button>
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "w-full truncate text-center text-[11px] leading-tight font-medium",
                        isAppActive
                          ? "font-semibold text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {app.name}
                    </span>

                    {/* Reorder Buttons in Edit Mode */}
                    {isEditingApps && (
                      <div className="flex items-center gap-0.5 pt-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => moveApp(e, index, -1)}
                          className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                          title="Move Left"
                        >
                          <IconChevronLeft className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={index === sortedApps.length - 1}
                          onClick={(e) => moveApp(e, index, 1)}
                          className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                          title="Move Right"
                        >
                          <IconChevronRight className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bookmarks Slideable Row (Pure Icons, Horizontally Scrollable) */}
          {isAuthenticated && (
            <section className="space-y-1.5">
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>{t("bookmarks")}</span>
                <button
                  type="button"
                  onClick={handleOpenAddBookmark}
                  className="flex size-5 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("addBookmark")}
                  aria-label={t("addBookmark")}
                >
                  <IconPlus className="size-3.5" />
                </button>
              </div>

              {bookmarks.length > 0 ? (
                <div className="no-scrollbar flex w-full touch-pan-x items-center gap-3 overflow-x-auto scroll-smooth px-1 py-1">
                  {bookmarks.map((bm: UserBookmark) => {
                    const isBmActive = isBookmarkActive(pathname, bm.url)
                    const bmColor = bm.color || "#6366f1"

                    return (
                      <div
                        key={bm.id}
                        className="group flex w-16 shrink-0 flex-col items-center gap-1"
                      >
                        <button
                          type="button"
                          onClick={() => handleNavigate(bm.url)}
                          className={cn(
                            "relative flex size-12 cursor-pointer items-center justify-center transition-transform active:scale-95",
                            isBmActive && "scale-105"
                          )}
                        >
                          {bm.pinned && (
                            <div
                              className="absolute -start-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full border border-border/60 bg-background/90 text-rose-500 shadow-xs"
                              title={t("pinned")}
                            >
                              <IconPinFilled className="size-2" />
                            </div>
                          )}
                          <div
                            className="flex size-full items-center justify-center"
                            style={{ color: bmColor }}
                          >
                            {renderBookmarkIcon(bm.icon, "size-[34px]", {
                              color: bmColor,
                            })}
                          </div>
                        </button>
                        <span
                          className={cn(
                            "w-full truncate text-center text-[11px] leading-tight font-medium transition-colors",
                            isBmActive
                              ? "font-semibold text-primary"
                              : "text-muted-foreground"
                          )}
                          title={bm.title}
                        >
                          {bm.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/50 py-3 text-center">
                  <button
                    type="button"
                    onClick={handleOpenAddBookmark}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground transition-all hover:bg-muted/80"
                  >
                    <IconPlus className="size-3.5" />
                    <span>{t("addBookmark")}</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Categorized Navigation Sections & Components */}
          {launcherSections.map((section: SidebarSection, sIdx: number) => {
            const secKey = section.section || `sec-${sIdx}`
            const isExpanded = expandedSections[secKey] ?? true
            if (!section.items || section.items.length === 0) return null

            return (
              <section key={sIdx} className="space-y-1.5">
                {section.section && (
                  <button
                    type="button"
                    onClick={() => toggleSection(secKey)}
                    className="flex w-full cursor-pointer items-center justify-between px-1 py-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    <span>{section.section}</span>
                    <IconChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                  </button>
                )}

                {isExpanded && (
                  <div className="space-y-1 rounded-2xl border border-border/50 bg-card/50 p-1.5">
                    {section.items.map((item: SidebarItem, iIdx: number) => {
                      const itemKey =
                        item.dataKey || item.label || `item-${iIdx}`
                      const hasChildren = !!(
                        item.children && item.children.length > 0
                      )
                      const isChildActive =
                        hasChildren &&
                        item.children!.some((child) =>
                          isRouteActive(pathname, child.href)
                        )
                      const isDirectActive = isRouteActive(pathname, item.href)
                      const isActive = isDirectActive || isChildActive

                      // Closed by default like sidebar unless active child or explicitly opened
                      const isOpen =
                        openItems[itemKey] !== undefined
                          ? openItems[itemKey]
                          : isChildActive

                      // Render custom embedded component if present (e.g. StorageQuotaWidget, ProBannerWidget)
                      if (item.component) {
                        return (
                          <div key={iIdx} className="w-full">
                            {item.component}
                          </div>
                        )
                      }

                      // Render collapsible item with children (closed by default)
                      if (hasChildren) {
                        return (
                          <div key={iIdx} className="flex w-full flex-col">
                            <div className="flex w-full items-center justify-between">
                              {item.href ? (
                                <button
                                  type="button"
                                  onClick={() => handleNavigate(item.href)}
                                  className={cn(
                                    "flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs font-medium transition-colors",
                                    isDirectActive
                                      ? "bg-primary/10 font-semibold text-primary"
                                      : isChildActive
                                        ? "font-medium text-foreground"
                                        : "text-foreground hover:bg-muted/60"
                                  )}
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {item.icon && (
                                      <span className="shrink-0 text-foreground [&>svg]:size-4">
                                        {item.icon}
                                      </span>
                                    )}
                                    <span className="truncate text-sm font-medium">
                                      {item.label}
                                    </span>
                                  </span>
                                  {item.badge && (
                                    <Badge
                                      variant="secondary"
                                      className="me-1 h-4 shrink-0 px-1.5 text-[10px]"
                                    >
                                      {formatBadgeNumber(
                                        Number(item.badge) || 0,
                                        2
                                      )}
                                    </Badge>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleItem(itemKey)}
                                  className={cn(
                                    "flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs font-medium transition-colors",
                                    isDirectActive
                                      ? "bg-primary/10 font-semibold text-primary"
                                      : isChildActive
                                        ? "font-medium text-foreground"
                                        : "text-foreground hover:bg-muted/60"
                                  )}
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {item.icon && (
                                      <span className="shrink-0 text-foreground [&>svg]:size-4">
                                        {item.icon}
                                      </span>
                                    )}
                                    <span className="truncate text-sm font-medium">
                                      {item.label}
                                    </span>
                                  </span>
                                  {item.badge && (
                                    <Badge
                                      variant="secondary"
                                      className="me-1 h-4 shrink-0 px-1.5 text-[10px]"
                                    >
                                      {formatBadgeNumber(
                                        Number(item.badge) || 0,
                                        2
                                      )}
                                    </Badge>
                                  )}
                                </button>
                              )}

                              {/* Dropdown toggle button */}
                              <button
                                type="button"
                                onClick={() => toggleItem(itemKey)}
                                className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                aria-label={
                                  isOpen ? t("collapse") : t("expand")
                                }
                              >
                                <IconChevronDown
                                  className={cn(
                                    "size-4 transition-transform duration-200",
                                    isOpen && "rotate-180"
                                  )}
                                />
                              </button>
                            </div>

                            {/* Submenu children: closed by default */}
                            {isOpen && (
                              <div className="my-1 ms-5 space-y-0.5 border-s border-border/50 py-1 ps-4 pe-1">
                                {item.children!.map(
                                  (child: SidebarItemChild, cIdx: number) => {
                                    const isSubActive = isRouteActive(
                                      pathname,
                                      child.href
                                    )

                                    if (child.component) {
                                      return (
                                        <div key={cIdx} className="w-full">
                                          {child.component}
                                        </div>
                                      )
                                    }

                                    return (
                                      <button
                                        key={cIdx}
                                        type="button"
                                        onClick={() =>
                                          handleNavigate(child.href)
                                        }
                                        className={cn(
                                          "flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-start text-xs font-medium transition-colors",
                                          isSubActive
                                            ? "bg-primary/15 font-semibold text-primary"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                      >
                                        <span className="flex min-w-0 flex-1 items-center gap-2">
                                          {child.icon && (
                                            <span className="shrink-0 [&>svg]:size-3.5">
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
                                            {formatBadgeNumber(
                                              Number(child.badge) || 0,
                                              2
                                            )}
                                          </Badge>
                                        )}
                                      </button>
                                    )
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Regular single item
                      return (
                        <button
                          key={iIdx}
                          type="button"
                          onClick={() => handleNavigate(item.href)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs font-medium transition-colors",
                            isActive
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2.5">
                            {item.icon && (
                              <span className="shrink-0 text-foreground [&>svg]:size-4">
                                {item.icon}
                              </span>
                            )}
                            <span className="truncate text-sm font-medium">
                              {item.label}
                            </span>
                          </span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="ml-auto h-4 shrink-0 px-1.5 text-[10px]"
                            >
                              {formatBadgeNumber(Number(item.badge) || 0, 2)}
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {/* Account & User Menu at the Bottom */}
        <div className="shrink-0 bg-transparent px-5 pt-2 pb-5">
          <IrisUserMenu onOpenSettings={onOpenSettings} placement="top" />
        </div>
      </Sheet>

      {/* Bookmark Add Dialog */}
      <BookmarkDialog
        isOpen={bookmarkDialogOpen}
        onClose={() => setBookmarkDialogOpen(false)}
        existingGroups={Array.from(
          new Set(
            bookmarks
              .map((b) => b.group?.trim())
              .filter((g): g is string => Boolean(g && g.length > 0))
          )
        )}
        defaultAppId={activeApp?.id || "iris-list"}
        defaultAppColor={activeApp?.color || "#6366f1"}
        defaultTitle={
          typeof document !== "undefined"
            ? document.title
            : activeApp?.name || ""
        }
        defaultUrl={
          typeof window !== "undefined"
            ? window.location.href
            : activeApp?.href || "/"
        }
        onSave={handleSaveBookmark}
      />
    </>
  )
}
