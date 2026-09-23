"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { IrisAppMenu } from "@/components/navigation/iris-app-menu"
import { IrisUserMenu } from "@/components/navigation/iris-user-menu"
import { IrisSettingsModal } from "@/components/navigation/iris-settings-modal"
import { UserProfileHeader } from "./user-profile-header"
import { OverviewTab } from "./tabs/overview-tab"
import { ActivityTab } from "./tabs/activity-tab"
import { ListsTab } from "./tabs/lists-tab"
import { FavoritesTab } from "./tabs/favorites-tab"
import { StatsTab } from "./tabs/stats-tab"
import { ProfileFriendsTab } from "./tabs/friends-tab"
import {
  IconLayoutDashboard,
  IconPlayerPlay,
  IconList,
  IconHeart,
  IconChartBar,
  IconUsers,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import type { UserProfileCustomization } from "@IRIS/shared"

export interface UserProfileViewProps {
  user: {
    id: string
    username: string
    customization?: any
    createdAt?: string
    connections?: any[]
  }
  profile: UserProfileCustomization
}

const TABS = [
  { id: "overview", name: "Overview", icon: IconLayoutDashboard },
  { id: "activity", name: "Activity", icon: IconPlayerPlay },
  { id: "lists", name: "Lists", icon: IconList },
  { id: "favorites", name: "Favorites", icon: IconHeart },
  { id: "friends", name: "Friends", icon: IconUsers },
  { id: "stats", name: "Stats", icon: IconChartBar },
]

export function UserProfileView({
  user,
  profile,
}: UserProfileViewProps): React.JSX.Element {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = searchParams.get("tab") || "overview"
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)

  const isOwner = Boolean(
    session?.user?.id && session.user.id === user.id
  )

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", tabId)
      window.history.replaceState({}, "", url.toString())
    }
  }

  const customAccentColor = profile.accentColor

  const accentStyles = customAccentColor
    ? ({
        "--primary": customAccentColor,
        "--ring": customAccentColor,
        "--profile-accent": customAccentColor,
      } as React.CSSProperties)
    : undefined

  return (
    <div
      className="relative flex min-h-screen w-full flex-col bg-background selection:bg-primary/20 selection:text-primary transition-colors duration-300"
      style={accentStyles}
    >
      {/* 1. Persistent Top Navigation Bar */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        {/* Left: App Switcher Menu */}
        <div className="flex items-center gap-3">
          <div className="w-48 sm:w-56 shrink-0">
            <IrisAppMenu />
          </div>
        </div>

        {/* Center: Segmented Floating Profile Tabs */}
        <nav className="flex items-center justify-center overflow-x-auto scrollbar-none px-2 py-1 mx-2">
          <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1 shadow-2xs backdrop-blur-md">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                    isSelected
                      ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Right: User Menu */}
        <div className="flex items-center gap-3">
          <div className="w-48 sm:w-56 shrink-0 flex justify-end">
            <IrisUserMenu />
          </div>
        </div>
      </header>

      {/* 2. Full-Width Profile Hero Header */}
      <UserProfileHeader
        username={user.username}
        profile={profile}
        createdAt={user.createdAt}
        isOwner={isOwner}
        connections={user.connections || []}
        onEditProfile={() => setSettingsOpen(true)}
      />

      {/* 4. Active Tab Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "overview" && (
          <OverviewTab
            username={user.username}
            profile={profile}
            connections={user.connections || []}
            isOwner={isOwner}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTab username={user.username} isOwner={isOwner} />
        )}

        {activeTab === "lists" && (
          <ListsTab username={user.username} isOwner={isOwner} />
        )}

        {activeTab === "favorites" && (
          <FavoritesTab username={user.username} isOwner={isOwner} />
        )}

        {activeTab === "friends" && (
          <ProfileFriendsTab username={user.username} isOwner={isOwner} />
        )}

        {activeTab === "stats" && (
          <StatsTab username={user.username} isOwner={isOwner} />
        )}
      </main>

      {/* Settings Modal (Triggered by Owner Edit Profile) */}
      <IrisSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultCategory="profile"
      />
    </div>
  )
}
