"use client"

import React from "react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
} from "@IRIS/shared"

export interface UserListBannerProps {
  username?: string
  profile?: UserProfileCustomization | null
  currentMediaType?: string
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

export function UserListBanner({
  username = "User",
  profile,
  className,
}: UserListBannerProps): React.JSX.Element {
  const displayName = profile?.displayName?.trim()
  const nameToDisplay = displayName || username || "User"
  const showUsername = Boolean(displayName && username && displayName !== username)
  const initial = (nameToDisplay ? nameToDisplay.charAt(0) : "U").toUpperCase()
  const nameStyle = getDisplayNameStyleCss(profile?.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(
    profile?.displayNameStyle?.effect
  )
  const hasValidFrame = isValidFrameUrl(profile?.avatarFrame)
  const hasValidBanner = Boolean(
    profile?.bannerUrl && profile.bannerUrl.trim() !== ""
  )
  const hasValidAvatar = Boolean(
    profile?.avatarUrl && profile.avatarUrl.trim() !== ""
  )

  return (
    <div
      className={cn(
        "relative w-full shrink-0 h-44 sm:h-52 md:h-56 min-h-44 sm:min-h-52 md:min-h-56 overflow-hidden border-b border-white/10",
        className
      )}
    >
      {/* 1. Header Banner Graphic filling entire background */}
      <div className="absolute inset-0 size-full">
        {hasValidBanner ? (
          <img
            src={profile!.bannerUrl!}
            alt={`${nameToDisplay}'s banner`}
            className="size-full object-cover object-center transition-transform duration-700 hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-end bg-linear-to-br from-primary/20 via-background to-muted/40 pe-8 text-primary/10 select-none">
            <span className="font-heading text-6xl font-black tracking-tighter opacity-15 sm:text-7xl">
              IRIS
            </span>
          </div>
        )}

        {/* Subtle dark tint to ensure text contrast while keeping artwork 100% visible */}
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      </div>

      {/* 2. Frosted Glass Profile Card overlaid directly over the banner */}
      <div className="absolute bottom-3 sm:bottom-4 inset-x-4 sm:inset-x-6 lg:inset-x-8 z-10">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-zinc-950/60 p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl transition-all sm:flex-row sm:items-center sm:justify-between">
          {/* Avatar & Identification */}
          <div className="flex items-center gap-3 sm:gap-3.5">
            {/* Avatar with Frame */}
            <div className="relative size-14 shrink-0 sm:size-16">
              <div className="relative size-full overflow-hidden rounded-full border-2 border-white/20 bg-card shadow-xl ring-1 ring-border/50">
                {hasValidAvatar ? (
                  <img
                    src={profile!.avatarUrl!}
                    alt={nameToDisplay}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary/20 font-heading text-lg font-black text-primary uppercase select-none sm:text-xl">
                    {initial}
                  </div>
                )}
              </div>

              {hasValidFrame && (
                <div
                  className="pointer-events-none absolute z-30 select-none"
                  style={{
                    width: "130%",
                    height: "130%",
                    top: "-15%",
                    left: "-15%",
                  }}
                >
                  <img
                    src={profile!.avatarFrame!}
                    alt="Avatar Frame"
                    className="size-full object-contain"
                  />
                </div>
              )}
            </div>

            {/* Names, Pronouns & Status */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
              <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                <h1
                  style={nameStyle}
                  className={cn(
                    "font-heading text-sm font-bold tracking-tight text-white sm:text-lg md:text-xl",
                    nameEffect
                  )}
                >
                  {nameToDisplay}
                </h1>

                {showUsername && (
                  <span className="font-mono text-xs text-muted-foreground">
                    @{username}
                  </span>
                )}

                {profile?.pronouns && (
                  <Badge
                    variant="secondary"
                    className="rounded-lg border border-frost bg-frost/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-md"
                  >
                    {profile.pronouns}
                  </Badge>
                )}
              </div>

              {profile?.statusText && (
                <div className="inline-flex w-fit max-w-full items-center rounded-xl border border-frost bg-frost/50 px-2 py-0.5 text-[11px] text-zinc-200 shadow-xs backdrop-blur-md transition-colors hover:border-border/80 hover:bg-muted/40 sm:max-w-xl sm:text-xs">
                  <span className="line-clamp-1 leading-snug font-medium break-words">
                    {profile.statusText}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
