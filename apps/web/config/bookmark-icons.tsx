import React from "react"
import Image from "next/image"
import {
  IconBookmark,
  IconStar,
  IconHeart,
  IconSparkles,
  IconFlame,
  IconFolder,
  IconList,
  IconPlayerPlay,
  IconMovie,
  IconDeviceTv,
  IconBook,
  IconMusic,
  IconDeviceGamepad,
  IconCategory,
  IconApps,
  IconTrophy,
  IconCompass,
  IconBolt,
  IconPin,
  IconUser,
  IconShieldLock,
  IconSettings,
  IconSearch,
  IconBell,
  IconCalendar,
  IconCloud,
  IconFileText,
  IconWorld,
  IconPhoto,
  IconChartBar,
  IconLock,
  IconKey,
  IconClock,
  IconTag,
  IconPalette,
  IconTerminal,
  IconLink,
  IconDatabase,
  IconPuzzle,
  type TablerIcon,
} from "@tabler/icons-react"

export interface BookmarkIconOption {
  id: string
  label: string
  type: "tabler" | "app"
  icon?: TablerIcon
  customRender?: (className?: string) => React.ReactNode
}

export const BOOKMARK_ICON_OPTIONS: BookmarkIconOption[] = [
  {
    id: "app:iris-list",
    label: "IRIS List",
    type: "app",
    customRender: (className = "size-4") => (
      <Image
        src="/iris-icons/iris-list-ring-left.png"
        alt="IRIS List"
        width={24}
        height={24}
        className={`${className} object-contain rounded-full`}
      />
    ),
  },
  {
    id: "app:iris-pass",
    label: "IRIS Pass",
    type: "app",
    customRender: (className = "size-4") => (
      <Image
        src="/iris-icons/iris-pass-ring-left.png"
        alt="IRIS Pass"
        width={24}
        height={24}
        className={`${className} object-contain rounded-full`}
      />
    ),
  },
  {
    id: "app:iris-cloud",
    label: "IRIS Cloud",
    type: "app",
    customRender: (className = "size-4") => (
      <Image
        src="/iris-pass512left-ring.png"
        alt="IRIS Cloud"
        width={24}
        height={24}
        className={`${className} object-contain rounded-full`}
      />
    ),
  },
  {
    id: "app:iris-mail",
    label: "IRIS Mail",
    type: "app",
    customRender: (className = "size-4") => (
      <Image
        src="/iris-pass512left-ring.png"
        alt="IRIS Mail"
        width={24}
        height={24}
        className={`${className} object-contain rounded-full`}
      />
    ),
  },
  {
    id: "app:iris-messages",
    label: "IRIS Messages",
    type: "app",
    customRender: (className = "size-4") => (
      <Image
        src="/iris-pass512left-ring.png"
        alt="IRIS Messages"
        width={24}
        height={24}
        className={`${className} object-contain rounded-full`}
      />
    ),
  },
  {
    id: "app:iris-docs",
    label: "IRIS Docs",
    type: "app",
    customRender: (className = "size-4") => (
      <Image
        src="/iris-pass512left-ring.png"
        alt="IRIS Docs"
        width={24}
        height={24}
        className={`${className} object-contain rounded-full`}
      />
    ),
  },
  { id: "bookmark", label: "Bookmark", type: "tabler", icon: IconBookmark },
  { id: "star", label: "Star", type: "tabler", icon: IconStar },
  { id: "heart", label: "Heart", type: "tabler", icon: IconHeart },
  { id: "sparkles", label: "Sparkles", type: "tabler", icon: IconSparkles },
  { id: "flame", label: "Flame", type: "tabler", icon: IconFlame },
  { id: "pin", label: "Pin", type: "tabler", icon: IconPin },
  { id: "folder", label: "Folder", type: "tabler", icon: IconFolder },
  { id: "list", label: "List", type: "tabler", icon: IconList },
  { id: "play", label: "Play", type: "tabler", icon: IconPlayerPlay },
  { id: "movie", label: "Movie", type: "tabler", icon: IconMovie },
  { id: "tv", label: "TV", type: "tabler", icon: IconDeviceTv },
  { id: "book", label: "Book", type: "tabler", icon: IconBook },
  { id: "music", label: "Music", type: "tabler", icon: IconMusic },
  { id: "gamepad", label: "Gamepad", type: "tabler", icon: IconDeviceGamepad },
  { id: "category", label: "Category", type: "tabler", icon: IconCategory },
  { id: "apps", label: "Apps", type: "tabler", icon: IconApps },
  { id: "trophy", label: "Trophy", type: "tabler", icon: IconTrophy },
  { id: "compass", label: "Compass", type: "tabler", icon: IconCompass },
  { id: "bolt", label: "Bolt", type: "tabler", icon: IconBolt },
  { id: "user", label: "User", type: "tabler", icon: IconUser },
  { id: "shield", label: "Shield", type: "tabler", icon: IconShieldLock },
  { id: "key", label: "Key", type: "tabler", icon: IconKey },
  { id: "lock", label: "Lock", type: "tabler", icon: IconLock },
  { id: "settings", label: "Settings", type: "tabler", icon: IconSettings },
  { id: "search", label: "Search", type: "tabler", icon: IconSearch },
  { id: "bell", label: "Bell", type: "tabler", icon: IconBell },
  { id: "calendar", label: "Calendar", type: "tabler", icon: IconCalendar },
  { id: "cloud", label: "Cloud", type: "tabler", icon: IconCloud },
  { id: "file", label: "File", type: "tabler", icon: IconFileText },
  { id: "world", label: "World", type: "tabler", icon: IconWorld },
  { id: "photo", label: "Photo", type: "tabler", icon: IconPhoto },
  { id: "chart", label: "Chart", type: "tabler", icon: IconChartBar },
  { id: "terminal", label: "Terminal", type: "tabler", icon: IconTerminal },
  { id: "palette", label: "Palette", type: "tabler", icon: IconPalette },
  { id: "tag", label: "Tag", type: "tabler", icon: IconTag },
  { id: "clock", label: "Clock", type: "tabler", icon: IconClock },
  { id: "link", label: "Link", type: "tabler", icon: IconLink },
]

export const BOOKMARK_ICONS_MAP: Record<string, BookmarkIconOption> =
  BOOKMARK_ICON_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.id] = opt
      return acc
    },
    {} as Record<string, BookmarkIconOption>
  )

export function renderBookmarkIcon(
  iconId?: string | null,
  className = "size-5",
  style?: React.CSSProperties
): React.JSX.Element {
  if (!iconId) {
    return <IconBookmark className={className} style={style} />
  }

  if (iconId === "app:iris-list" || iconId === "iris-list") {
    return (
      <Image
        src="/iris-icons/iris-list-ring-left.png"
        alt="IRIS List"
        width={96}
        height={96}
        className={`${className} object-contain rounded-full`}
      />
    )
  }

  if (iconId === "app:iris-pass" || iconId === "iris-pass") {
    return (
      <Image
        src="/iris-icons/iris-pass-ring-left.png"
        alt="IRIS Pass"
        width={96}
        height={96}
        className={`${className} object-contain rounded-full`}
      />
    )
  }

  const option = BOOKMARK_ICONS_MAP[iconId]
  if (option) {
    if (option.customRender) {
      return <>{option.customRender(className)}</>
    }
    if (option.icon) {
      const IconComponent = option.icon
      return <IconComponent className={className} style={style} />
    }
  }

  return <IconBookmark className={className} style={style} />
}



export const BOOKMARK_COLOR_PRESETS: Array<{
  id: string
  name: string
  value: string
  bgClass: string
}> = [
  { id: "indigo", name: "Indigo", value: "#6366f1", bgClass: "bg-indigo-500" },
  { id: "rose", name: "Rose", value: "#f43f5e", bgClass: "bg-rose-500" },
  { id: "fuchsia", name: "Fuchsia", value: "#d800a6", bgClass: "bg-[#d800a6]" },
  { id: "violet", name: "Violet", value: "#8b5cf6", bgClass: "bg-violet-500" },
  { id: "cyan", name: "Cyan", value: "#06b6d4", bgClass: "bg-cyan-500" },
  { id: "sky", name: "Sky", value: "#38bdf8", bgClass: "bg-sky-400" },
  { id: "emerald", name: "Emerald", value: "#10b981", bgClass: "bg-emerald-500" },
  { id: "amber", name: "Amber", value: "#f59e0b", bgClass: "bg-amber-500" },
  { id: "crimson", name: "Crimson", value: "#ef4444", bgClass: "bg-red-500" },
  { id: "mauve", name: "Mauve", value: "#94a3b8", bgClass: "bg-slate-400" },
]
