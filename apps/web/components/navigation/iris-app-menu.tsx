"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Button, LinkButton } from "@workspace/ui/components/button"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  IconBookmark,
  IconCheck,
  IconPencil,
  IconPlus,
  IconX,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconSparkles,
  IconLogin,
  IconPin,
  IconPinFilled,
  IconEdit,
  IconApps,
  IconFolder,
  IconSelector,
} from "@tabler/icons-react"
import { useIrisApps, renderIrisAppIcon, type IrisApp } from "@/config/irisApps"
import { renderBookmarkIcon } from "@/config/bookmark-icons"
import { BookmarkDialog } from "./bookmark-dialog"
import { useIrisSidebar } from "./sidebar-provider"
import { elysia } from "@/lib/elysia"
import { hasPermission } from "@IRIS/permissions"
import { type UserBookmark } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

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

export function IrisAppMenu(): React.JSX.Element {
  const t = useTranslations("navigation.appMenu")
  const irisApps = useIrisApps()
  const pathname = usePathname() || "/"
  const { data: session, status } = useSession()
  const { position } = useIrisSidebar()
  const isRight = position === "right"

  const isAuthenticated = status === "authenticated" && Boolean(session?.user)
  const userPermissions = (session?.user as any)?.permissions ?? null

  const visibleApps = useMemo((): IrisApp[] => {
    return irisApps.filter((app: IrisApp): boolean => {
      if (!app.permissions) return true
      return hasPermission(userPermissions, app.permissions, "any")
    })
  }, [irisApps, userPermissions])

  const activeApp = useMemo(() => {
    const current = visibleApps.find((app) =>
      app.href !== "/" ? pathname.startsWith(app.href) : pathname === "/"
    )
    return current || visibleApps[0] || irisApps[0]
  }, [pathname, visibleApps, irisApps])

  const [isEditing, setIsEditing] = useState(false)
  const [appOrder, setAppOrder] = useState<string[]>([])
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([])
  const [serverGroups, setServerGroups] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAppId, setFilterAppId] = useState<string>("all")
  const [filterGroup, setFilterGroup] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<UserBookmark | null>(
    null
  )

  const initialAppOrderRef = useRef<string[]>([])
  const initialBookmarksRef = useRef<UserBookmark[]>([])

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

  // Sync bookmarks & groups from backend database table
  const fetchBookmarks = useCallback(async () => {
    if (!isAuthenticated) {
      setBookmarks([])
      setServerGroups([])
      return
    }

    try {
      const { data, error } = await elysia.users.me.bookmarks.get({
        fetch: { credentials: "include" },
      })
      if (!error && data?.bookmarks) {
        setBookmarks(data.bookmarks)
        if (data.groups) {
          setServerGroups(data.groups)
        }
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  // Sorted apps based on saved order
  const sortedApps = useMemo((): IrisApp[] => {
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

  // Bookmarks sorted: pinned on top/first, unpinned sorted chronologically with latest on the bottom
  const sortedBookmarks = useMemo((): UserBookmark[] => {
    if (!bookmarks || bookmarks.length === 0) return []
    const pinned = bookmarks.filter((b) => b.pinned)
    const unpinned = bookmarks.filter((b) => !b.pinned)
    return [...pinned, ...unpinned]
  }, [bookmarks])

  // Extracted unique groups from bookmarks and server
  const existingGroups = useMemo(() => {
    const set = new Set<string>()
    serverGroups.forEach((g) => {
      if (g && g.trim()) set.add(g.trim())
    })
    bookmarks.forEach((b) => {
      if (b.group && b.group.trim()) {
        set.add(b.group.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [bookmarks, serverGroups])

  // Filtered bookmarks matching search query, app filter, and group filter
  const filteredBookmarks = useMemo((): UserBookmark[] => {
    return sortedBookmarks.filter((b) => {
      // Search query filter (matches title, url, or group)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesTitle = b.title.toLowerCase().includes(q)
        const matchesUrl = b.url.toLowerCase().includes(q)
        const matchesGroup = b.group ? b.group.toLowerCase().includes(q) : false
        if (!matchesTitle && !matchesUrl && !matchesGroup) return false
      }

      // Filter by App
      if (filterAppId !== "all") {
        if (b.appId) {
          if (b.appId !== filterAppId) return false
        } else {
          // Fallback matching
          const matchingApp = visibleApps.find((a) => a.id === filterAppId)
          if (matchingApp) {
            const matchesIcon =
              b.icon === `app:${matchingApp.id}` || b.icon === matchingApp.id
            const matchesHref =
              matchingApp.href !== "/" && b.url.includes(matchingApp.href)
            if (!matchesIcon && !matchesHref) return false
          } else {
            return false
          }
        }
      }

      // Filter by Group
      if (filterGroup !== "all") {
        if (filterGroup === "ungrouped") {
          if (b.group && b.group.trim()) return false
        } else {
          if (
            !b.group ||
            b.group.trim().toLowerCase() !== filterGroup.trim().toLowerCase()
          )
            return false
        }
      }

      return true
    })
  }, [sortedBookmarks, searchQuery, filterAppId, filterGroup, visibleApps])

  const startEditing = () => {
    initialAppOrderRef.current = [...appOrder]
    initialBookmarksRef.current = [...bookmarks]
    setIsEditing(true)
  }

  const cancelEditing = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAppOrder(initialAppOrderRef.current)
    setBookmarks(initialBookmarksRef.current)
    setIsEditing(false)
  }

  const finishEditing = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      localStorage.setItem("iris_app_order", JSON.stringify(appOrder))
    } catch {
      // ignore
    }

    if (isAuthenticated) {
      try {
        await elysia.users.me.bookmarks.put(
          { bookmarks },
          { fetch: { credentials: "include" } }
        )
      } catch (err) {
        console.error("Failed to save reordered bookmarks:", err)
      }
    }

    setIsEditing(false)
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

  const moveBookmark = (
    e: React.MouseEvent,
    index: number,
    direction: -1 | 1
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sortedBookmarks.length) return
    const newBookmarks = [...sortedBookmarks]
    const moved = newBookmarks[index]
    if (!moved) return
    newBookmarks.splice(index, 1)
    newBookmarks.splice(targetIndex, 0, moved)
    setBookmarks(newBookmarks)
  }

  const togglePinBookmark = async (bm: UserBookmark, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newPinned = !bm.pinned
    const updated = bookmarks.map((b) =>
      b.id === bm.id ? { ...b, pinned: newPinned } : b
    )
    setBookmarks(updated)

    if (isAuthenticated) {
      try {
        await elysia.users.me
          .bookmarks({ id: bm.id })
          .patch({ pinned: newPinned }, { fetch: { credentials: "include" } })
        toast.success(newPinned ? t("pinned") : t("unpin"))
      } catch {
        toast.error("Failed to update bookmark pin")
      }
    }
  }

  const handleDeleteBookmark = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const updated = bookmarks.filter((b) => b.id !== id)
    setBookmarks(updated)

    if (isAuthenticated) {
      try {
        await elysia.users.me
          .bookmarks({ id })
          .delete({}, { fetch: { credentials: "include" } })
        toast.success(t("bookmarkDeleted"))
      } catch {
        toast.error("Failed to delete bookmark")
      }
    }
  }

  const handleOpenAddDialog = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingBookmark(null)
    setDialogOpen(true)
  }

  const handleOpenEditDialog = (bm: UserBookmark, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingBookmark(bm)
    setDialogOpen(true)
  }

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
    if (data.id) {
      // Update existing
      if (isAuthenticated) {
        const { data: resData, error } = await elysia.users.me
          .bookmarks({ id: data.id })
          .patch(
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
          throw new Error("Failed to update bookmark")
        }
        setBookmarks((prev) =>
          prev.map((b) => (b.id === data.id ? resData.bookmark : b))
        )
        if (data.group && data.group.trim()) {
          setServerGroups((prev) =>
            Array.from(new Set([...prev, data.group!.trim()]))
          )
        }
        toast.success(t("bookmarkUpdated"))
      }
    } else {
      // Create new
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
        if (data.group && data.group.trim()) {
          setServerGroups((prev) =>
            Array.from(new Set([...prev, data.group!.trim()]))
          )
        }
        toast.success(t("bookmarkCreated"))
      }
    }
  }

  return (
    <>
      <DropdownMenuTrigger>
        {/* App Trigger Button in Sidebar */}
        <Button
          variant="ghost"
          className="group flex h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-border/40 p-2 text-start transition-all hover:border-border/80 hover:bg-muted/50 data-[state=open]:border-border data-[state=open]:bg-muted/80"
        >
          {renderIrisAppIcon(activeApp, "size-8 text-primary-foreground")}

          <div className="flex min-w-0 flex-1 flex-col">
            <span
              suppressHydrationWarning
              className={cn(
                "w-fit max-w-full truncate text-xs leading-tight font-bold",
                activeApp?.gradient
                  ? "bg-clip-text text-transparent"
                  : activeApp?.colorClass || "text-indigo-500"
              )}
              style={
                activeApp?.gradient
                  ? { backgroundImage: activeApp.gradient }
                  : undefined
              }
            >
              {activeApp?.name || "IRIS"}
            </span>
            <span className="truncate text-[10px] leading-tight font-normal text-muted-foreground">
              {activeApp?.descriptionShort ||
                activeApp?.description ||
                t("appCenter")}
            </span>
          </div>
          <IconSelector className="ms-auto size-4 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100" />
        </Button>

        {/* Large Dropdown Menu Popover */}
        <DropdownMenu
          placement={isRight ? "left top" : "right top"}
          offset={8}
          style={{
            width: "min(580px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
          }}
          className="w-[580px]! max-w-[92vw]! min-w-[360px]! rounded-3xl border border-border/80 bg-popover/95 p-4 shadow-2xl backdrop-blur-2xl"
        >
          {/* Applications Header */}
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {isEditing ? t("reorganizeMenu") : t("applications")}
            </span>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <IconX className="size-3" />
                  <span>{t("cancel")}</span>
                </button>
                <button
                  type="button"
                  onClick={finishEditing}
                  className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                >
                  <IconCheck className="size-3.5" />
                  <span>{t("done")}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  startEditing()
                }}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <IconPencil className="size-3" />
                <span>{t("edit")}</span>
              </button>
            )}
          </div>

          {/* Top Section: Applications Row (4 Apps Per Row, Horizontally Scrollable) */}
          <div className="scrollbar-thin scrollbar-thumb-border flex gap-3 overflow-x-auto px-1 pt-1 pb-3">
            {sortedApps.map((app, index) => {
              const isCurrent = activeApp?.name === app.name

              return (
                <div
                  key={app.name}
                  className="group flex w-[125px] shrink-0 flex-col items-center gap-1.5"
                >
                  <Link
                    href={isEditing ? "#" : app.href}
                    onClick={(e) => {
                      if (isEditing) e.preventDefault()
                    }}
                    className={cn(
                      "flex aspect-square size-13 cursor-pointer items-center justify-center transition-all duration-200 hover:scale-110",
                      isCurrent && "scale-105"
                    )}
                  >
                    {renderIrisAppIcon(app, "size-[40px]")}
                  </Link>

                  {/* App Name Under Icon */}
                  <span
                    suppressHydrationWarning
                    className={cn(
                      "inline-block max-w-full truncate text-center text-xs transition-colors",
                      isCurrent
                        ? app.gradient
                          ? "bg-clip-text font-bold text-transparent"
                          : "font-bold text-primary"
                        : "font-medium text-muted-foreground group-hover:text-foreground"
                    )}
                    style={
                      isCurrent && app.gradient
                        ? { backgroundImage: app.gradient }
                        : undefined
                    }
                    title={app.name}
                  >
                    {app.name}
                  </span>

                  {/* Reorder Buttons in Edit Mode */}
                  {isEditing && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(e) => moveApp(e, index, -1)}
                        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                        title={t("moveLeft")}
                      >
                        <IconChevronLeft className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === sortedApps.length - 1}
                        onClick={(e) => moveApp(e, index, 1)}
                        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                        title={t("moveRight")}
                      >
                        <IconChevronRight className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-2.5 border-t border-border/60" />

          {/* Bookmarks Header */}
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <span className="shrink-0 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("bookmarks")}
            </span>

            {/* Search Input In Header (Without Icon) */}
            {isAuthenticated && (bookmarks.length > 0 || searchQuery) && (
              <div className="relative flex max-w-[240px] flex-1 items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchBookmarks")}
                  className="h-7 w-full rounded-lg border border-border/50 bg-muted/40 px-2.5 pe-6 text-[11px] font-normal text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-border focus:bg-muted/70 focus:ring-1 focus:ring-ring focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute end-1.5 flex size-4 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                    title={t("cancel")}
                  >
                    <IconX className="size-3" />
                  </button>
                )}
              </div>
            )}

            {isAuthenticated && (
              <button
                type="button"
                onClick={handleOpenAddDialog}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t("addBookmark")}
                title={t("addBookmark")}
              >
                <IconPlus className="size-4" />
              </button>
            )}
          </div>

          {/* Filter Chips Bar (All Apps + 2 Apps | All Groups + 2 Groups, Horizontally Scrollable) */}
          {isAuthenticated && (bookmarks.length > 0 || searchQuery) && (
            <div className="mb-2.5 flex items-center gap-2 overflow-hidden px-1 pb-0.5 text-xs">
              {/* Apps Filter (Horizontally Scrollable, All Apps + ~2 Apps visible) */}
              <div className="scrollbar-none flex max-w-[48%] shrink-0 items-center gap-1.5 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => setFilterAppId("all")}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                    filterAppId === "all"
                      ? "border border-border/80 bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span>{t("allApps")}</span>
                </button>

                {visibleApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() =>
                      setFilterAppId(filterAppId === app.id ? "all" : app.id)
                    }
                    className={cn(
                      "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                      filterAppId === app.id
                        ? "border border-primary bg-primary/15 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <div className="size-3 shrink-0">
                      {renderIrisAppIcon(app, "size-3")}
                    </div>
                    <span>{app.name}</span>
                  </button>
                ))}
              </div>

              {/* Vertical Divider */}
              <div className="h-4 w-px shrink-0 bg-border/60" />

              {/* Groups Filter (Horizontally Scrollable, All Groups + ~2 Groups visible) */}
              <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => setFilterGroup("all")}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                    filterGroup === "all"
                      ? "border border-border/80 bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span>{t("allGroups")}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterGroup(
                      filterGroup === "ungrouped" ? "all" : "ungrouped"
                    )
                  }
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                    filterGroup === "ungrouped"
                      ? "border border-primary bg-primary/15 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span>{t("ungrouped")}</span>
                </button>

                {existingGroups.map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() =>
                      setFilterGroup(
                        filterGroup.toLowerCase() === grp.toLowerCase()
                          ? "all"
                          : grp
                      )
                    }
                    className={cn(
                      "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                      filterGroup.toLowerCase() === grp.toLowerCase()
                        ? "border border-primary bg-primary/15 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <IconFolder className="size-3" />
                    <span>{grp}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bookmarks Section (6 Per Row Grid, Vertically Scrollable) */}
          {!isAuthenticated ? (
            <LinkButton
              href="/auth/login"
              variant="ghost"
              className="my-2 h-auto w-full cursor-pointer justify-center gap-2 rounded-2xl border border-dashed border-border/70 py-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <IconLogin className="size-4 shrink-0" />
              <span>{t("loginToUseBookmarks")}</span>
            </LinkButton>
          ) : sortedBookmarks.length === 0 ? (
            <div className="my-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-8 text-center">
              <IconBookmark className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-xs font-medium text-muted-foreground/70">
                {t("noSavedBookmarks")}
              </p>
              <button
                type="button"
                onClick={handleOpenAddDialog}
                className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-muted/80"
              >
                <IconPlus className="size-3.5" />
                <span>{t("addBookmark")}</span>
              </button>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="my-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-6 text-center">
              <IconBookmark className="mb-1.5 size-7 text-muted-foreground/40" />
              <p className="text-xs font-medium text-muted-foreground/70">
                {t("noMatchingBookmarks")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setFilterAppId("all")
                  setFilterGroup("all")
                }}
                className="mt-2.5 flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground transition-all hover:bg-muted/80"
              >
                <IconX className="size-3.5" />
                <span>{t("clearFilters")}</span>
              </button>
            </div>
          ) : (
            <div
              className={cn(
                "scrollbar-thin scrollbar-thumb-border overflow-y-auto px-1 py-1",
                isEditing ? "max-h-[188px]" : "max-h-[148px]"
              )}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: "10px 8px",
              }}
            >
              {filteredBookmarks.map((bm, index) => {
                const bmColor = bm.color || "#6366f1"
                const isBmActive = isBookmarkActive(pathname, bm.url)

                return (
                  <div
                    key={bm.id}
                    className="group relative flex w-full flex-col items-center gap-1"
                  >
                    <TooltipTrigger delay={200}>
                      <Link
                        href={isEditing ? "#" : bm.url}
                        onClick={(e) => {
                          if (isEditing) e.preventDefault()
                        }}
                        className={cn(
                          "relative flex aspect-square size-11 cursor-pointer items-center justify-center transition-all duration-200 hover:scale-115",
                          isBmActive && "scale-105"
                        )}
                      >
                        {/* Pinned Dot / Badge */}
                        {bm.pinned && (
                          <div
                            className="absolute -start-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full border border-border/60 bg-background/90 text-rose-500 shadow-xs"
                            title={t("pinned")}
                          >
                            <IconPinFilled className="size-2" />
                          </div>
                        )}

                        {/* Quick hover action buttons */}
                        {!isEditing && (
                          <div className="absolute -end-1 -top-1 z-20 hidden items-center gap-0.5 rounded-lg border border-border/60 bg-background/95 p-0.5 shadow-md backdrop-blur-xs group-hover:flex">
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditDialog(bm, e)}
                              className="flex size-4.5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={t("editBookmark")}
                            >
                              <IconEdit className="size-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteBookmark(bm.id, e)}
                              className="flex size-4.5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                              title={t("deleteBookmark")}
                            >
                              <IconTrash className="size-2.5" />
                            </button>
                          </div>
                        )}

                        {/* Bookmark Icon Purely */}
                        <div
                          className="flex size-full items-center justify-center"
                          style={{ color: bmColor }}
                        >
                          {renderBookmarkIcon(bm.icon, "size-[32px]", {
                            color: bmColor,
                          })}
                        </div>
                      </Link>

                      {/* Tooltip showing full title and group on hover */}
                      <Tooltip>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{bm.title}</span>
                          {bm.group && (
                            <span className="text-[10px] text-muted-foreground">
                              📁 {bm.group}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    </TooltipTrigger>

                    {/* Bookmark Title Truncated Underneath */}
                    <span
                      className={cn(
                        "w-full truncate text-center text-[10px] font-medium transition-colors",
                        isBmActive
                          ? "font-semibold text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                      title={bm.title}
                    >
                      {bm.title}
                    </span>

                    {/* Manage / Edit Controls in Edit Mode */}
                    {isEditing && (
                      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => togglePinBookmark(bm, e)}
                          className={cn(
                            "cursor-pointer rounded p-0.5 transition-colors hover:bg-muted",
                            bm.pinned
                              ? "text-rose-500 hover:text-rose-600"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          title={bm.pinned ? t("unpin") : t("pin")}
                        >
                          {bm.pinned ? (
                            <IconPinFilled className="size-3" />
                          ) : (
                            <IconPin className="size-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditDialog(bm, e)}
                          className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title={t("editBookmark")}
                        >
                          <IconEdit className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBookmark(bm.id, e)}
                          className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                          title={t("deleteBookmark")}
                        >
                          <IconTrash className="size-3" />
                        </button>
                        <div className="flex w-full items-center justify-center gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={(e) => moveBookmark(e, index, -1)}
                            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                            title={t("moveLeft")}
                          >
                            <IconChevronLeft className="size-2.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortedBookmarks.length - 1}
                            onClick={(e) => moveBookmark(e, index, 1)}
                            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                            title={t("moveRight")}
                          >
                            <IconChevronRight className="size-2.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DropdownMenu>
      </DropdownMenuTrigger>

      {/* Bookmark Add/Edit Dialog */}
      <BookmarkDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingBookmark(null)
        }}
        bookmark={editingBookmark}
        existingGroups={existingGroups}
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
        onDelete={handleDeleteBookmark}
      />
    </>
  )
}
