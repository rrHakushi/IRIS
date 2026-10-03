"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useSession, signIn, signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import { Dialog as AriaDialog } from "react-aria-components"
import { Button, LinkButton } from "@workspace/ui/components/button"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Badge } from "@workspace/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  IconBell,
  IconSettings,
  IconPalette,
  IconLanguage,
  IconUsers,
  IconLogout,
  IconLogin,
  IconBookmark,
  IconCheck,
  IconPencil,
  IconPlus,
  IconX,
  IconTrash,
  IconPin,
  IconPinFilled,
  IconApps,
  IconFolder,
  IconSun,
  IconMoon,
  IconEdit,
  IconDotsVertical,
} from "@tabler/icons-react"
import { useIrisSidebar } from "./sidebar-provider"
import { IrisSidebarUserCard } from "./iris-sidebar-user-card"
import { IrisNotificationsModal } from "./iris-notifications-modal"
import { IrisFriendsModal } from "./iris-friends-modal"
import {
  IrisSettingsModal,
  type IrisSettingsCategory,
} from "./iris-settings-modal"
import { BookmarkDialog } from "./bookmark-dialog"
import { formatBadgeNumber } from "@/lib/numbers"
import { useNotifications } from "@/context/notification-context"
import { useUser } from "@/context/user-context"
import { useEncryption } from "@/context/encryption-context"
import { useLocale } from "next-intl"
import { locales, localeNames, type Locale } from "@/i18n/routing"
import { useIrisApps, renderIrisAppIcon, type IrisApp } from "@/config/irisApps"
import { renderBookmarkIcon } from "@/config/bookmark-icons"
import { elysia } from "@/lib/elysia"
import { hasPermission } from "@IRIS/permissions"
import { type UserBookmark } from "@IRIS/shared"
import { useDragScroll } from "@/hooks/use-drag-scroll"
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

// In-memory module cache for bookmarks across navigation and sidebar instances
let cachedBookmarks: UserBookmark[] | null = null
let cachedServerGroups: string[] | null = null
let inFlightBookmarksPromise: Promise<{
  bookmarks: UserBookmark[]
  groups: string[]
} | null> | null = null

export interface IrisUserMenuProps {
  onOpenSettings?: () => void
  placement?: any
  className?: string
}

export function IrisUserMenu({
  onOpenSettings,
  placement,
  className,
}: IrisUserMenuProps): React.JSX.Element {
  const t = useTranslations("navigation.userMenu")
  const tApp = useTranslations("navigation.appMenu")
  const { data: session, status } = useSession()
  const { user } = useUser()
  const { isActive: isEncryptionActive } = useEncryption()
  const {
    unreadCount,
    isModalOpen: notificationsOpen,
    setIsModalOpen: setNotificationsOpen,
  } = useNotifications()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { position } = useIrisSidebar()
  const isRight = position === "right"
  const isTop = position === "top"
  const isBottom = position === "bottom"

  const [menuOpen, setMenuOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDefaultCategory, setSettingsDefaultCategory] =
    useState<IrisSettingsCategory>("profile")

  // Global listener allowing any UI component to open Settings to a specific tab
  useEffect(() => {
    const handleOpenSettings = (e: Event) => {
      const customEvent = e as CustomEvent<{ category?: IrisSettingsCategory }>
      if (customEvent.detail?.category) {
        setSettingsDefaultCategory(customEvent.detail.category)
      }
      setSettingsOpen(true)
    }
    window.addEventListener("iris-open-settings", handleOpenSettings)
    return () => {
      window.removeEventListener("iris-open-settings", handleOpenSettings)
    }
  }, [])

  // Apps & Bookmarks State
  const pathname = usePathname() || "/"
  const irisApps = useIrisApps()
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
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>(
    () => cachedBookmarks ?? []
  )
  const [serverGroups, setServerGroups] = useState<string[]>(
    () => cachedServerGroups ?? []
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAppId, setFilterAppId] = useState<string>("all")
  const [filterGroup, setFilterGroup] = useState<string>("all")
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<UserBookmark | null>(
    null
  )

  // Mouse slide / drag-to-scroll & wheel helpers
  const appsDragScroll = useDragScroll()
  const appFilterDragScroll = useDragScroll()
  const groupFilterDragScroll = useDragScroll()

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

  // Sync bookmarks & groups from backend database
  const fetchBookmarks = useCallback(
    async (force = false) => {
      if (!isAuthenticated) {
        cachedBookmarks = null
        cachedServerGroups = null
        setBookmarks([])
        setServerGroups([])
        return
      }

      if (!force && cachedBookmarks !== null && cachedServerGroups !== null) {
        setBookmarks(cachedBookmarks)
        setServerGroups(cachedServerGroups)
        return
      }

      if (inFlightBookmarksPromise) {
        const result = await inFlightBookmarksPromise
        if (result) {
          setBookmarks(result.bookmarks)
          setServerGroups(result.groups)
        }
        return
      }

      inFlightBookmarksPromise = (async () => {
        try {
          const { data, error } = await elysia.users.me.bookmarks.get({
            fetch: { credentials: "include" },
          })
          if (error || !data) return null

          const list = (data.bookmarks as UserBookmark[]) || []
          const groups = (data.groups as string[]) || []

          cachedBookmarks = list
          cachedServerGroups = groups
          return { bookmarks: list, groups }
        } catch (err) {
          console.error("Failed to load bookmarks:", err)
          return null
        } finally {
          inFlightBookmarksPromise = null
        }
      })()

      const result = await inFlightBookmarksPromise
      if (result) {
        setBookmarks(result.bookmarks)
        setServerGroups(result.groups)
      }
    },
    [isAuthenticated]
  )

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  // Automatically open settings on connections tab and alert on OAuth return
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const statusParam = params.get("status")
    const provider = params.get("provider")
    const tab = params.get("tab") || params.get("openSettings")

    if (statusParam || tab === "connections" || provider) {
      if (statusParam === "connected" && provider) {
        toast.success(`Successfully connected to ${provider}!`)
      } else if (statusParam === "error") {
        const msg = params.get("message")
        toast.error(msg ? decodeURIComponent(msg) : "Connection failed")
      }

      setSettingsDefaultCategory("connections")
      setSettingsOpen(true)

      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete("status")
      cleanUrl.searchParams.delete("provider")
      cleanUrl.searchParams.delete("message")
      cleanUrl.searchParams.delete("tab")
      cleanUrl.searchParams.delete("openSettings")
      window.history.replaceState(
        {},
        document.title,
        cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : "")
      )
    }
  }, [])

  const router = useRouter()
  const currentLocale = useLocale() as Locale
  const localeMeta = localeNames[currentLocale] ?? localeNames.en

  const displayName = user?.displayName || user?.username
  const userEmail = user?.email
  const username = user?.username

  const resolvedPlacement = useMemo(() => {
    if (placement) return placement
    if (isTop) return "bottom end"
    if (isBottom) return "top end"
    return isRight ? "left bottom" : "right bottom"
  }, [placement, isTop, isBottom, isRight])

  const handleSelectLanguage = (nextLocale: Locale) => {
    if (!nextLocale || nextLocale === currentLocale) return
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
    router.refresh()
  }

  // Sorted apps based on custom order
  const sortedApps = useMemo((): IrisApp[] => {
    if (appOrder.length === 0) return visibleApps
    return [...visibleApps].sort((a, b) => {
      const idxA = appOrder.indexOf(a.name)
      const idxB = appOrder.indexOf(b.name)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return 0
    })
  }, [visibleApps, appOrder])

  // Drag and drop reordering for apps in edit mode
  const [draggedAppIndex, setDraggedAppIndex] = useState<number | null>(null)
  const [dragOverAppIndex, setDragOverAppIndex] = useState<number | null>(null)

  const handleAppDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditing) return
    e.dataTransfer.setData("text/plain", String(index))
    e.dataTransfer.effectAllowed = "move"
    setDraggedAppIndex(index)
  }

  const handleAppDragOver = (e: React.DragEvent, index: number) => {
    if (!isEditing || draggedAppIndex === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverAppIndex !== index) {
      setDragOverAppIndex(index)
    }
  }

  const handleAppDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditing) return
    e.preventDefault()
    e.stopPropagation()
    if (draggedAppIndex === null || draggedAppIndex === targetIndex) {
      setDraggedAppIndex(null)
      setDragOverAppIndex(null)
      return
    }

    const newApps = [...sortedApps]
    const [moved] = newApps.splice(draggedAppIndex, 1)
    if (moved) {
      newApps.splice(targetIndex, 0, moved)
      setAppOrder(newApps.map((a) => a.name))
    }
    setDraggedAppIndex(null)
    setDragOverAppIndex(null)
  }

  const handleAppDragEnd = () => {
    setDraggedAppIndex(null)
    setDragOverAppIndex(null)
  }

  // Sorted bookmarks: Pinned first, then order
  const sortedBookmarks = useMemo((): UserBookmark[] => {
    return [...bookmarks].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      const orderA = typeof a.order === "number" ? a.order : 0
      const orderB = typeof b.order === "number" ? b.order : 0
      if (orderA !== orderB) return orderA - orderB
      return (a.createdAt || "").localeCompare(b.createdAt || "")
    })
  }, [bookmarks])

  // Existing groups
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesTitle = b.title.toLowerCase().includes(q)
        const matchesUrl = b.url.toLowerCase().includes(q)
        const matchesGroup = b.group ? b.group.toLowerCase().includes(q) : false
        if (!matchesTitle && !matchesUrl && !matchesGroup) return false
      }

      if (filterAppId !== "all") {
        if (b.appId) {
          if (b.appId !== filterAppId) return false
        } else {
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

  // Separate pinned vs standard bookmarks for clean boxes
  const pinnedFilteredBookmarks = useMemo(() => {
    return filteredBookmarks.filter((b) => b.pinned)
  }, [filteredBookmarks])

  const otherFilteredBookmarks = useMemo(() => {
    return filteredBookmarks.filter((b) => !b.pinned)
  }, [filteredBookmarks])

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
          {
            bookmarks: bookmarks.map((b, idx) => ({
              id: b.id,
              title: b.title,
              url: b.url,
              icon: b.icon,
              color: b.color,
              pinned: b.pinned,
              appId: b.appId,
              group: b.group,
              order: idx,
              createdAt: b.createdAt,
            })),
          },
          { fetch: { credentials: "include" } }
        )
      } catch (err) {
        console.error("Failed to persist bookmark order:", err)
      }
    }

    setIsEditing(false)
    toast.success(tApp("menuSaved"))
  }

  const handleOpenAddDialog = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingBookmark(null)
    setBookmarkDialogOpen(true)
  }

  const handleOpenEditDialog = (bm: UserBookmark, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setEditingBookmark(bm)
    setBookmarkDialogOpen(true)
  }

  const handleDeleteBookmark = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!isAuthenticated) return

    const { error } = await elysia.users.me
      .bookmarks({ id })
      .delete(undefined, { fetch: { credentials: "include" } })

    if (error) {
      toast.error(tApp("failedDeleteBookmark"))
      return
    }

    const updated = bookmarks.filter((b) => b.id !== id)
    setBookmarks(updated)
    cachedBookmarks = updated
    toast.success(tApp("bookmarkDeleted"))
  }

  const handleTogglePin = async (bm: UserBookmark, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!isAuthenticated) return

    const newPinned = !bm.pinned
    const updated = bookmarks.map((b) =>
      b.id === bm.id ? { ...b, pinned: newPinned } : b
    )
    setBookmarks(updated)
    cachedBookmarks = updated

    try {
      await elysia.users.me.bookmarks({ id: bm.id }).patch(
        { pinned: newPinned },
        { fetch: { credentials: "include" } }
      )
    } catch {
      // revert on error
      setBookmarks(bookmarks)
      cachedBookmarks = bookmarks
    }
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
        const updatedList = bookmarks.map((b) =>
          b.id === data.id ? resData.bookmark : b
        )
        setBookmarks(updatedList)
        cachedBookmarks = updatedList
        if (data.group && data.group.trim()) {
          const newGroups = Array.from(
            new Set([...serverGroups, data.group.trim()])
          )
          setServerGroups(newGroups)
          cachedServerGroups = newGroups
        }
        toast.success(tApp("bookmarkUpdated"))
      }
    } else {
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
        const updatedList = [...bookmarks, resData.bookmark]
        setBookmarks(updatedList)
        cachedBookmarks = updatedList
        if (data.group && data.group.trim()) {
          const newGroups = Array.from(
            new Set([...serverGroups, data.group.trim()])
          )
          setServerGroups(newGroups)
          cachedServerGroups = newGroups
        }
        toast.success(tApp("bookmarkCreated"))
      }
    }
  }

  if (!session?.user) {
    return (
      <Button
        variant="ghost"
        className={cn(
          "h-10 w-full max-w-[240px] cursor-pointer justify-start gap-2.5 rounded-2xl px-3 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
          className
        )}
        onClick={() => {
          setMenuOpen(false)
          signIn()
        }}
      >
        <IconLogin className="size-4 shrink-0" />
        <span className="truncate group-data-[collapsible=icon]:hidden">
          {t("logIn")}
        </span>
      </Button>
    )
  }

  const renderBookmarkCard = (bm: (typeof bookmarks)[number]) => {
    const isBmActive = isBookmarkActive(pathname, bm.url)
    const color = bm.color || "#6366f1"

    return (
      <div
        key={bm.id}
        className={cn(
          "group relative flex h-12 items-center gap-2 rounded-xl border border-border/50 bg-card/80 px-2.5 py-1.5 transition-all hover:border-border hover:bg-card hover:shadow-xs",
          isBmActive &&
            "border-primary/60 bg-primary/10 font-bold ring-1 ring-primary/30"
        )}
      >
        <Link
          href={isEditing ? "#" : bm.url}
          onClick={(e) => {
            if (isEditing) e.preventDefault()
            else setMenuOpen(false)
          }}
          className="flex min-w-0 flex-1 items-center gap-2 pe-7 select-none"
          title={bm.title}
        >
          {/* Bookmark icon: direct icon with color, NO background card */}
          <div
            className="flex size-7 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-110"
            style={{ color }}
          >
            {renderBookmarkIcon(bm.icon, "size-5")}
          </div>

          {/* Title only (shows full title on hover via title prop) */}
          <span
            className="truncate text-xs font-semibold text-foreground leading-normal"
            title={bm.title}
          >
            {bm.title}
          </span>
        </Link>

        {/* Subtle indicator when pinned and not hovered */}
        {bm.pinned && (
          <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center group-hover:hidden pointer-events-none">
            <IconPinFilled className="size-3 text-primary/70" />
          </div>
        )}

        {/* 3-dot options menu */}
        <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center z-10">
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-6 cursor-pointer rounded-lg p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-opacity"
              aria-label={tApp("options") || "Options"}
            >
              <IconDotsVertical className="size-3.5" />
            </Button>
            <DropdownMenu
              placement="bottom end"
              offset={4}
              className="min-w-32 rounded-xl p-1 shadow-xl z-50"
            >
              <DropdownMenuItem
                onAction={() => handleTogglePin(bm)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              >
                {bm.pinned ? (
                  <>
                    <IconPinFilled className="size-3.5 text-primary" />
                    <span>{tApp("unpin") || "Unpin"}</span>
                  </>
                ) : (
                  <>
                    <IconPin className="size-3.5 text-muted-foreground" />
                    <span>{tApp("pin") || "Pin"}</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onAction={() => handleOpenEditDialog(bm)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              >
                <IconEdit className="size-3.5 text-muted-foreground" />
                <span>{tApp("edit") || "Edit"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onAction={() => handleDeleteBookmark(bm.id)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <IconTrash className="size-3.5" />
                <span>{tApp("delete") || "Delete"}</span>
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </div>
      </div>
    )
  }

  return (
    <>
      <PopoverTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
        {/* Closed Menu Button Trigger - Same as User Menu */}
        <Button
          variant="ghost"
          className={cn(
            "h-12 w-full max-w-[240px] cursor-pointer overflow-hidden border-0 bg-transparent p-0 hover:bg-transparent focus-visible:ring-0",
            className
          )}
        >
          <IrisSidebarUserCard
            nameplateUrl={user?.nameplateUrl || user?.sidebarCardBackgroundUrl}
            avatarUrl={user?.avatarUrl}
            avatarFrame={user?.avatarFrame}
            displayName={displayName}
            displayNameStyle={user?.displayNameStyle}
            statusText={user?.statusText}
            username={username}
            email={userEmail}
            unreadCount={unreadCount}
            showChevrons
            className="h-full w-full border-border/40 hover:border-border/80 hover:bg-muted/50 data-[state=open]:border-border data-[state=open]:bg-muted/80"
          />
        </Button>

        {/* Large Flyout Popover containing Quick Actions, Applications, and Bookmarks */}
        <Popover
          placement={resolvedPlacement}
          offset={8}
          style={{
            width: "min(540px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            height: "min(475px, calc(100vh - 32px))",
            maxHeight: "calc(100vh - 32px)",
          }}
          className="z-40! w-[540px]! max-w-[calc(100vw-32px)]! h-[475px]! max-h-[calc(100vh-32px)]! rounded-3xl border border-border/50 bg-popover/80 p-3 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden"
        >
          <AriaDialog
            aria-label={t("title") || "Navigation & Profile Menu"}
            className="flex flex-col gap-2.5 h-full min-h-0 outline-none overflow-hidden"
          >
            {/* 1. Quick User Toolbar (Appearance, Notification, Settings, Logout etc) */}
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-card/60 px-3 py-2 shadow-xs shrink-0">
              {/* Left: Quick User Identity Card */}
              <Link
                href={`/IRIS-account/users/${username}`}
                onClick={() => setMenuOpen(false)}
                className="group flex min-w-0 flex-1 items-center rounded-xl transition-all"
                title={t("viewProfile") || "View Profile"}
              >
                <IrisSidebarUserCard
                  nameplateUrl={user?.nameplateUrl || user?.sidebarCardBackgroundUrl}
                  avatarUrl={user?.avatarUrl}
                  avatarFrame={user?.avatarFrame}
                  displayName={displayName}
                  displayNameStyle={user?.displayNameStyle}
                  statusText={user?.statusText}
                  username={username}
                  email={userEmail}
                  showChevrons={false}
                  className="w-full border-0 bg-transparent px-2 py-1 shadow-none backdrop-blur-none hover:bg-muted/40 transition-colors"
                />
              </Link>

              {/* Right: Quick Action Icons Toolbar (Appearance, Notification, Settings, Logout etc) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Notifications with Badge */}
                <TooltipTrigger delay={150}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="relative size-8 cursor-pointer rounded-xl border border-border/40 bg-background/50 hover:bg-background hover:text-primary transition-all shadow-2xs"
                    onPress={() => {
                      setMenuOpen(false)
                      setNotificationsOpen(true)
                    }}
                    aria-label={t("notifications")}
                  >
                    <IconBell className="size-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-xs">
                        {formatBadgeNumber(unreadCount, 2)}
                      </span>
                    )}
                  </Button>
                  <Tooltip>{t("notifications")}</Tooltip>
                </TooltipTrigger>

                {/* Friends */}
                <TooltipTrigger delay={150}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 cursor-pointer rounded-xl border border-border/40 bg-background/50 hover:bg-background hover:text-primary transition-all shadow-2xs"
                    onPress={() => {
                      setMenuOpen(false)
                      setFriendsOpen(true)
                    }}
                    aria-label={t("friends")}
                  >
                    <IconUsers className="size-4" />
                  </Button>
                  <Tooltip>{t("friends")}</Tooltip>
                </TooltipTrigger>

                {/* Appearance / Theme Switcher */}
                <TooltipTrigger delay={150}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 cursor-pointer rounded-xl border border-border/40 bg-background/50 hover:bg-background hover:text-primary transition-all shadow-2xs"
                    onPress={() => {
                      const nextTheme =
                        resolvedTheme === "dark" ? "light" : "dark"
                      setTheme(nextTheme)
                    }}
                    aria-label={t("appearance")}
                  >
                    {resolvedTheme === "dark" ? (
                      <IconSun className="size-4 text-amber-400" />
                    ) : (
                      <IconMoon className="size-4 text-indigo-400" />
                    )}
                  </Button>
                  <Tooltip>{t("appearance")}</Tooltip>
                </TooltipTrigger>

                {/* Language Switcher Dropdown */}
                <DropdownMenuTrigger>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 cursor-pointer rounded-xl border border-border/40 bg-background/50 hover:bg-background hover:text-primary transition-all shadow-2xs"
                    aria-label={t("language")}
                  >
                    <IconLanguage className="size-4" />
                  </Button>
                  <DropdownMenu
                    placement="bottom end"
                    offset={6}
                    className="min-w-40 rounded-2xl p-1.5"
                  >
                    <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("selectLanguage")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {locales.map((loc) => {
                      const meta = localeNames[loc]
                      const isCurrent = loc === currentLocale
                      return (
                        <DropdownMenuItem
                          key={loc}
                          onAction={() => handleSelectLanguage(loc)}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs",
                            isCurrent && "font-semibold text-primary"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span>{meta.flag}</span>
                            <span>{meta.nativeName}</span>
                          </span>
                          {isCurrent && <IconCheck className="size-3.5" />}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenu>
                </DropdownMenuTrigger>

                {/* Settings */}
                <TooltipTrigger delay={150}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 cursor-pointer rounded-xl border border-border/40 bg-background/50 hover:bg-background hover:text-primary transition-all shadow-2xs"
                    onPress={() => {
                      setMenuOpen(false)
                      if (onOpenSettings) {
                        onOpenSettings()
                      } else {
                        setSettingsDefaultCategory("profile")
                        setSettingsOpen(true)
                      }
                    }}
                    aria-label={t("settings")}
                  >
                    <IconSettings className="size-4" />
                  </Button>
                  <Tooltip>{t("settings")}</Tooltip>
                </TooltipTrigger>

                {/* Logout */}
                <TooltipTrigger delay={150}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 cursor-pointer rounded-xl border border-rose-500/30 bg-background/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-all shadow-2xs"
                    onPress={() => {
                      setMenuOpen(false)
                      signOut()
                    }}
                    aria-label={t("logOut")}
                  >
                    <IconLogout className="size-4" />
                  </Button>
                  <Tooltip>{t("logOut")}</Tooltip>
                </TooltipTrigger>
              </div>
            </div>

            {/* 2. Applications Section */}
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-card/60 px-3 pt-2.5 pb-2 shadow-xs shrink-0 h-[112px]">
              {/* Apps Section Header */}
              <div className="flex items-center justify-between px-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <IconApps className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    {isEditing ? tApp("reorganizeMenu") : tApp("applications")}
                  </span>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <IconX className="size-3" />
                      <span>{tApp("cancel")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={finishEditing}
                      className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <IconCheck className="size-3.5" />
                      <span>{tApp("done")}</span>
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
                    <span>{tApp("edit")}</span>
                  </button>
                )}
              </div>

              {/* Horizontal Scrollable Apps Row (drag-to-scroll when browsing, drag-and-drop when editing) */}
              <div
                ref={appsDragScroll.ref}
                {...(isEditing ? {} : appsDragScroll.events)}
                className={cn(
                  "no-scrollbar flex gap-2 overflow-x-auto px-0.5 py-0.5 select-none",
                  isEditing ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                )}
              >
                {sortedApps.map((app, index) => {
                  const isCurrent = activeApp?.name === app.name
                  const isDragging = draggedAppIndex === index
                  const isDragOver =
                    dragOverAppIndex === index &&
                    draggedAppIndex !== null &&
                    draggedAppIndex !== index

                  return (
                    <div
                      key={app.name}
                      draggable={isEditing}
                      onDragStart={(e) => handleAppDragStart(e, index)}
                      onDragOver={(e) => handleAppDragOver(e, index)}
                      onDragLeave={() => {
                        if (dragOverAppIndex === index) setDragOverAppIndex(null)
                      }}
                      onDrop={(e) => handleAppDrop(e, index)}
                      onDragEnd={handleAppDragEnd}
                      className={cn(
                        "group flex w-[105px] shrink-0 flex-col items-center gap-1 select-none transition-all duration-150",
                        isEditing &&
                          "cursor-grab active:cursor-grabbing hover:scale-105",
                        isDragging && "opacity-30 scale-90",
                        isDragOver &&
                          "scale-105 rounded-xl ring-2 ring-primary ring-dashed bg-primary/10"
                      )}
                    >
                      <Link
                        draggable={false}
                        href={isEditing ? "#" : app.href}
                        onClick={(e) => {
                          if (isEditing) e.preventDefault()
                          else setMenuOpen(false)
                        }}
                        className={cn(
                          "relative flex size-11 items-center justify-center transition-transform duration-200 select-none",
                          isEditing
                            ? "cursor-grab active:cursor-grabbing pointer-events-none"
                            : "cursor-pointer hover:scale-110"
                        )}
                      >
                        {renderIrisAppIcon(app, "size-10")}
                      </Link>

                      {/* App Name Under Icon */}
                      <span
                        suppressHydrationWarning
                        className={cn(
                          "inline-block max-w-full truncate text-center text-xs leading-normal py-0.5 transition-colors",
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
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. Bookmarks Section */}
            <div className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/60 p-3 shadow-xs flex-1 min-h-0">
              {/* Bookmarks Section Header */}
              <div className="flex items-center justify-between gap-3 px-1 shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <IconBookmark className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    {tApp("bookmarks")}
                  </span>
                </div>

                {/* Search Input in Bookmarks Header */}
                {isAuthenticated && (bookmarks.length > 0 || searchQuery) && (
                  <div className="relative flex max-w-[220px] flex-1 items-center">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={tApp("searchBookmarks")}
                      className="h-7 w-full rounded-lg border border-border/50 bg-background/60 px-2.5 pe-6 text-[11px] font-normal text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-border focus:bg-background focus:ring-1 focus:ring-ring focus:outline-hidden"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute end-1.5 flex size-4 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                        title={tApp("cancel")}
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
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/50 bg-background/50 text-muted-foreground transition-all hover:bg-background hover:text-foreground hover:scale-105"
                    aria-label={tApp("addBookmark")}
                    title={tApp("addBookmark")}
                  >
                    <IconPlus className="size-4" />
                  </button>
                )}
              </div>

              {/* Filter Chips Bar (All Apps + Groups) */}
              {isAuthenticated && (bookmarks.length > 0 || searchQuery) && (
                <div className="flex items-center gap-2 overflow-hidden px-1 pb-0.5 text-xs shrink-0">
                  {/* Apps Filter Chips (supports mouse drag and wheel slide) */}
                  <div
                    ref={appFilterDragScroll.ref}
                    {...appFilterDragScroll.events}
                    className="no-scrollbar flex max-w-[48%] shrink-0 items-center gap-1.5 overflow-x-auto py-0.5 cursor-grab active:cursor-grabbing select-none"
                  >
                    <button
                      type="button"
                      onClick={() => setFilterAppId("all")}
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                        filterAppId === "all"
                          ? "border border-border/80 bg-background font-semibold text-foreground shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <span>{tApp("allApps")}</span>
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

                  {/* Groups Filter Chips (supports mouse drag and wheel slide) */}
                  <div
                    ref={groupFilterDragScroll.ref}
                    {...groupFilterDragScroll.events}
                    className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5 cursor-grab active:cursor-grabbing select-none"
                  >
                    <button
                      type="button"
                      onClick={() => setFilterGroup("all")}
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                        filterGroup === "all"
                          ? "border border-border/80 bg-background font-semibold text-foreground shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <span>{tApp("allGroups")}</span>
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
                      <span>{tApp("ungrouped")}</span>
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

              {/* Bookmarks Display: Unauthenticated or Empty States */}
              {!isAuthenticated ? (
                <LinkButton
                  href="/auth/login"
                  variant="ghost"
                  className="h-auto w-full cursor-pointer justify-center gap-2 rounded-2xl border border-dashed border-border/70 py-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <IconLogin className="size-4 shrink-0" />
                  <span>{tApp("loginToUseBookmarks")}</span>
                </LinkButton>
              ) : sortedBookmarks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-6 text-center bg-background/40">
                  <IconBookmark className="mb-1.5 size-7 text-muted-foreground/40" />
                  <p className="text-xs font-medium text-muted-foreground/70">
                    {tApp("noSavedBookmarks")}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddDialog}
                    className="mt-2.5 flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-muted"
                  >
                    <IconPlus className="size-3.5" />
                    <span>{tApp("addBookmark")}</span>
                  </button>
                </div>
              ) : filteredBookmarks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-5 text-center bg-background/40">
                  <IconBookmark className="mb-1.5 size-6 text-muted-foreground/40" />
                  <p className="text-xs font-medium text-muted-foreground/70">
                    {tApp("noMatchingBookmarks")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("")
                      setFilterAppId("all")
                      setFilterGroup("all")
                    }}
                    className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition-all hover:bg-muted"
                  >
                    <IconX className="size-3.5" />
                    <span>{tApp("clearFilters")}</span>
                  </button>
                </div>
              ) : (
                /* Bookmarks Scrollable Card Box */
                <div className="rounded-xl border border-border/40 bg-muted/20 p-2 flex-1 min-h-0 flex flex-col shadow-2xs">
                  <div className="no-scrollbar overflow-y-auto flex-1 min-h-0 space-y-2.5 pr-0.5">
                    {pinnedFilteredBookmarks.length > 0 ? (
                      <>
                        {/* Pinned Bookmarks Section */}
                        <div>
                          <div className="mb-1 flex items-center gap-1 px-1">
                            <IconPinFilled className="size-3 text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {tApp("pinned") || "Pinned"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 content-start auto-rows-max">
                            {pinnedFilteredBookmarks.map((bm) =>
                              renderBookmarkCard(bm)
                            )}
                          </div>
                        </div>

                        {/* Other Bookmarks Section */}
                        {otherFilteredBookmarks.length > 0 && (
                          <div>
                            <div className="mb-1 flex items-center gap-1 px-1">
                              <IconBookmark className="size-3 text-muted-foreground" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {tApp("allBookmarks") || "Bookmarks"}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 content-start auto-rows-max">
                              {otherFilteredBookmarks.map((bm) =>
                                renderBookmarkCard(bm)
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* All Bookmarks Grid (3 per row, 2 rows at once) */
                      <div className="grid grid-cols-3 gap-2 content-start auto-rows-max">
                        {filteredBookmarks.map((bm) =>
                          renderBookmarkCard(bm)
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AriaDialog>
        </Popover>
      </PopoverTrigger>

      {/* Modals triggered from User Menu */}
      <IrisNotificationsModal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />

      <IrisFriendsModal open={friendsOpen} onOpenChange={setFriendsOpen} />

      <IrisSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultCategory={settingsDefaultCategory}
      />

      <BookmarkDialog
        isOpen={bookmarkDialogOpen}
        onClose={() => setBookmarkDialogOpen(false)}
        bookmark={editingBookmark}
        existingGroups={existingGroups}
        defaultAppId={activeApp?.id}
        defaultAppColor={activeApp?.color}
        onSave={handleSaveBookmark}
        onDelete={
          editingBookmark
            ? (id) => handleDeleteBookmark(id)
            : undefined
        }
      />
    </>
  )
}

/**
 * Programmatically opens the IRIS Settings modal focused on a designated category.
 */
export function openSettingsModal(category: IrisSettingsCategory = "profile") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("iris-open-settings", { detail: { category } })
    )
  }
}
