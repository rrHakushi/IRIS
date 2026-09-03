"use client"

import React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
} from "@IRIS/shared"
import { renderBioMarkdown } from "./markdown-bio-editor"
import { IrisSidebarUserCard } from "../../../iris-sidebar-user-card"

export interface ProfilePreviewCardProps {
  profile: UserProfileCustomization
  username: string
  email?: string
  className?: string
}

function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false
  const trimmed = url.trim()
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:"))
  )
}

export function ProfilePreviewCard({
  profile,
  username,
  email,
  className,
}: ProfilePreviewCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const nameToShow = profile.displayName || username || "Display Name"
  const initial = nameToShow.charAt(0).toUpperCase()

  const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(
    profile.displayNameStyle?.effect
  )
  const hasValidFrame = isValidFrameUrl(profile.avatarFrame)

  return (
    <div
      className={cn(
        "isolate flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-md backdrop-blur-xl transition-all duration-300",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-3">
        <span className="text-xs font-bold text-foreground">
          {t("preview")}
        </span>
      </div>

      {/* Main Preview Container: Displays both Profile Card and Nameplate Preview */}
      <div className="space-y-4 p-4">
        {/* 1. Full Profile Card View */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {/* Banner Header */}
          <div className="relative h-28 w-full overflow-hidden bg-linear-to-r from-primary/30 via-primary/10 to-muted/50">
            {profile.bannerUrl ? (
              <Image
                src={profile.bannerUrl}
                alt="Profile Banner"
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-end bg-linear-to-br from-primary/20 via-background to-primary/5 pr-4 text-primary/10 select-none">
                <span className="text-6xl font-black tracking-tighter opacity-20">
                  IRIS
                </span>
              </div>
            )}
            {/* Dark subtle gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />
          </div>

          {/* Profile Avatar & Info section */}
          <div className="relative px-4 pt-0 pb-4">
            {/* Floating Avatar with Frame */}
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <div className="relative flex items-center justify-center">
                <Avatar className="size-20 border-2 border-card bg-background shadow-md">
                  {profile.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={nameToShow} />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-xl font-black text-primary uppercase">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                {hasValidFrame && (
                  <div className="pointer-events-none absolute -inset-3 z-10 size-26 max-w-none select-none">
                    <Image
                      src={profile.avatarFrame!}
                      alt="Avatar Frame"
                      fill
                      sizes="104px"
                      unoptimized
                      loading="eager"
                      priority
                      className="object-contain"
                    />
                  </div>
                )}
              </div>

              <Badge
                variant="outline"
                className="bg-background/80 px-2 py-0.5 font-mono text-[10px] backdrop-blur-xs"
              >
                {t("member")}
              </Badge>
            </div>

            {/* Display Name & Username & Pronouns */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "truncate text-base font-bold tracking-tight transition-all duration-200",
                    nameEffect
                  )}
                  style={nameStyle}
                >
                  {nameToShow}
                </span>
                {profile.pronouns && (
                  <span className="shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {profile.pronouns}
                  </span>
                )}
              </div>

              <div className="text-xs font-medium text-muted-foreground/80">
                @{username}
              </div>

              {/* Status Message */}
              {profile.statusText && (
                <div className="flex items-center gap-1.5 pt-0.5 text-xs text-foreground/90 italic">
                  <span className="text-[10px]">💬</span>
                  <span className="truncate">{profile.statusText}</span>
                </div>
              )}
            </div>

            {/* Bio Section */}
            <div className="mt-3 border-t border-border/40 pt-3">
              <div className="mb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {t("aboutMe")}
              </div>
              <div className="rounded-xl border border-border/30 bg-muted/20 p-2.5 text-xs">
                {renderBioMarkdown(profile.bio || "", t("noBio"))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Nameplate Preview View */}
        <div className="space-y-2 border-t border-border/40 pt-2">
          <div className="px-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            {t("nameplatePreview")}
          </div>
          <IrisSidebarUserCard
            nameplateUrl={profile.nameplateUrl || profile.sidebarBannerUrl}
            avatarUrl={profile.avatarUrl}
            avatarFrame={profile.avatarFrame}
            displayName={profile.displayName}
            displayNameStyle={profile.displayNameStyle}
            statusText={profile.statusText}
            username={username}
            email={email}
            showEmail
            showChevrons
            className="border-border/60 shadow-xs"
          />
        </div>
      </div>
    </div>
  )
}
