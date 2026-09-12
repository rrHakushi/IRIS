import React from "react"
import {
  IconFolder,
  IconList,
  IconStar,
  IconBookmark,
  IconSparkles,
  IconHeart,
  IconFlame,
  IconPlayerPlay,
  IconMovie,
  IconBook,
  IconDeviceTv,
  IconCategory,
  IconApps,
  IconTrophy,
  IconCompass,
  IconBolt,
  IconPin,
  IconMusic,
  IconDeviceGamepad,
  IconUser,
  type TablerIcon,
} from "@tabler/icons-react"

export interface DockGroupIconOption {
  id: string
  label: string
  icon: TablerIcon
}

export const DOCK_GROUP_ICON_OPTIONS: DockGroupIconOption[] = [
  { id: "folder", label: "Folder", icon: IconFolder },
  { id: "list", label: "List", icon: IconList },
  { id: "star", label: "Star", icon: IconStar },
  { id: "bookmark", label: "Bookmark", icon: IconBookmark },
  { id: "sparkles", label: "Sparkles", icon: IconSparkles },
  { id: "heart", label: "Heart", icon: IconHeart },
  { id: "flame", label: "Flame", icon: IconFlame },
  { id: "play", label: "Play", icon: IconPlayerPlay },
  { id: "movie", label: "Movie", icon: IconMovie },
  { id: "tv", label: "TV", icon: IconDeviceTv },
  { id: "book", label: "Book", icon: IconBook },
  { id: "music", label: "Music", icon: IconMusic },
  { id: "gamepad", label: "Gamepad", icon: IconDeviceGamepad },
  { id: "category", label: "Category", icon: IconCategory },
  { id: "apps", label: "Apps", icon: IconApps },
  { id: "trophy", label: "Trophy", icon: IconTrophy },
  { id: "compass", label: "Compass", icon: IconCompass },
  { id: "bolt", label: "Bolt", icon: IconBolt },
  { id: "pin", label: "Pin", icon: IconPin },
  { id: "user", label: "User", icon: IconUser },
]

export const DOCK_GROUP_ICONS_MAP: Record<string, TablerIcon> =
  DOCK_GROUP_ICON_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.id] = opt.icon
      return acc
    },
    {} as Record<string, TablerIcon>
  )

export function renderDockGroupIcon(
  iconId?: string | null,
  className = "size-5"
): React.JSX.Element {
  const IconComp = (iconId && DOCK_GROUP_ICONS_MAP[iconId]) || IconFolder
  return <IconComp className={className} />
}
