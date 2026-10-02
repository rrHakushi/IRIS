"use client"

import React, { useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { IrisSidebar } from "@/components/navigation/iris-sidebar"
import { useIrisSidebar } from "@/components/navigation/sidebar-provider"
import { IrisSettingsModal } from "@/components/navigation/iris-settings-modal"
import { UserProfileHeader } from "./user-profile-header"
import { OverviewTab } from "./tabs/overview-tab"
import { ActivityTab } from "./tabs/activity-tab"
import { ListsTab } from "./tabs/lists-tab"
import { FavoritesTab } from "./tabs/favorites-tab"
import { StatsTab } from "./tabs/stats-tab"
import { ProfileFriendsTab } from "./tabs/friends-tab"
import { useTranslations } from "next-intl"
import { useAccountUserSidebarConfig } from "@/config/sidebars"
import { SidebarInset, useSidebar } from "@workspace/ui/components/sidebar"
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

export function UserProfileView({
  user,
  profile,
}: UserProfileViewProps): React.JSX.Element {
  const t = useTranslations("navigation.userProfileTabs")
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { position } = useIrisSidebar()
  const { state } = useSidebar()

  const initialTab = searchParams.get("tab") || "overview"
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)

  const isOwner = Boolean(
    session?.user?.id && session.user.id === user.id
  )

  const handleSelectTab = React.useCallback((tabId: string) => {
    setActiveTab(tabId)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", tabId)
      window.history.replaceState({}, "", url.toString())
    }
  }, [])

  // Account custom sidebar config generated from @/config/sidebars
  const accountSidebarConfig = useAccountUserSidebarConfig({
    username: user.username,
    activeTab,
    onSelectTab: handleSelectTab,
    t,
  })

  const customAccentColor = profile.accentColor

  const accentStyles = customAccentColor
    ? ({
        "--primary": customAccentColor,
        "--ring": customAccentColor,
        "--profile-accent": customAccentColor,
      } as React.CSSProperties)
    : undefined

  const isHorizontal = position === "top" || position === "bottom"
  const isRight = position === "right"
  const isTop = position === "top"
  const isBottom = position === "bottom"

  return (
    <div
      className={cn(
        "relative flex h-svh w-full overflow-hidden bg-sidebar selection:bg-primary/20 selection:text-primary transition-colors duration-300",
        isHorizontal ? "flex-col" : "flex-row"
      )}
      style={accentStyles}
    >
      {/* Left Sidebar (Desktop Vertical) */}
      {position === "left" && (
        <IrisSidebar
          initialConfig={accountSidebarConfig}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Main Profile Page Body */}
      <SidebarInset
        className={cn(
          "no-scrollbar flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto bg-background pt-0",
          isRight &&
            (state === "collapsed"
              ? "md:m-2 md:rounded-2xl md:shadow-sm"
              : "md:m-2 md:me-0 md:rounded-2xl md:shadow-sm"),
          isTop &&
            "md:m-2 md:w-[calc(100%-1rem)] md:rounded-2xl md:shadow-sm",
          isBottom &&
            "md:m-2 md:w-[calc(100%-1rem)] md:rounded-2xl md:shadow-sm"
        )}
      >
        {/* Dynamic IrisSidebar for Top Position */}
        {position === "top" && (
          <IrisSidebar
            initialConfig={accountSidebarConfig}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {/* Full-Width Profile Hero Header */}
        <UserProfileHeader
          username={user.username}
          profile={profile}
          createdAt={user.createdAt}
          isOwner={isOwner}
          connections={user.connections || []}
          onEditProfile={() => setSettingsOpen(true)}
        />

        {/* Active Tab Main Content */}
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

        {/* Dynamic IrisSidebar for Bottom Position */}
        {position === "bottom" && (
          <IrisSidebar
            initialConfig={accountSidebarConfig}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </SidebarInset>

      {/* Right Sidebar (Desktop Vertical) */}
      {position === "right" && (
        <IrisSidebar
          initialConfig={accountSidebarConfig}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Settings Modal (Triggered by Owner Edit Profile) */}
      <IrisSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultCategory="profile"
      />
    </div>
  )
}

export default UserProfileView
