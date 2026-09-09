"use client"

import React from "react"
import Image from "next/image"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
} from "@IRIS/shared"
import type { MediaListType } from "./types"

export interface UserListBannerProps {
  username: string
  profile?: UserProfileCustomization | null
  currentMediaType?: MediaListType
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
  username,
  profile,
  className,
}: UserListBannerProps): React.JSX.Element {
  const displayName = profile?.displayName?.trim()
  const nameToDisplay = displayName || username
  const showUsername = Boolean(displayName && displayName !== username)
  const initial = nameToDisplay.charAt(0).toUpperCase()
  const nameStyle = getDisplayNameStyleCss(profile?.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(
    profile?.displayNameStyle?.effect
  )
  const hasValidFrame = isValidFrameUrl(profile?.avatarFrame)

  return (
    <div
      className={cn(
        "relative w-full border-b border-border/50 bg-background/95",
        className
      )}
    >
      {/* 1. Header Banner Graphic */}
      <div className="relative h-44 w-full overflow-hidden sm:h-56 md:h-64 lg:h-72">
        {profile?.bannerUrl ? (
          <Image
            src={profile.bannerUrl}
            alt={`${nameToDisplay}'s banner`}
            fill
            sizes="100vw"
            priority
            unoptimized
            className="object-cover object-center transition-transform duration-700 hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-end bg-linear-to-br from-primary/20 via-background to-muted/50 pe-8 text-primary/10 select-none">
            <span className="font-heading text-8xl font-black tracking-tighter opacity-15">
              IRIS
            </span>
          </div>
        )}

        {/* Ambient Gradient Overlays */}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-radial-[circle_at_top_right] from-transparent to-black/30" />
      </div>

      {/* 2. User Info Section */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 pt-1 pb-4 sm:pb-6 md:flex-row md:items-end md:justify-between">
          {/* Avatar and User Identification Row */}
          <div className="flex items-center gap-3.5 sm:items-end sm:gap-4">
            {/* Floating Avatar with Frame */}
            <div className="relative z-20 -mt-10 shrink-0 sm:-mt-12">
              <div className="relative flex items-center justify-center">
                {/* Circular Avatar Container */}
                <div className="relative size-20 overflow-hidden rounded-full border-4 border-background bg-card shadow-2xl ring-1 ring-border/40 sm:size-24">
                  {profile?.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={nameToDisplay}
                      fill
                      sizes="96px"
                      unoptimized
                      priority
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-2xl font-black text-primary uppercase select-none sm:text-3xl">
                      {initial}
                    </div>
                  )}
                </div>

                {/* Avatar Frame overlay */}
                {hasValidFrame && (
                  <div className="pointer-events-none absolute -inset-3 z-30 size-26 max-w-none select-none sm:-inset-4 sm:size-32">
                    <Image
                      src={profile!.avatarFrame!}
                      alt="Avatar Frame"
                      fill
                      sizes="128px"
                      unoptimized
                      loading="eager"
                      priority
                      className="object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Name, Username, Pronouns (Yellow Area) & Status (Green Area) */}
            <div className="z-20 -mt-10 flex flex-1 min-w-0 flex-col gap-1 sm:-mt-12 sm:gap-1.5 sm:pb-1">
              {/* Yellow area: displayName(username) pronouns */}
              <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                <h1
                  style={nameStyle}
                  className={cn(
                    "font-heading text-lg font-bold tracking-tight sm:text-2xl md:text-3xl",
                    nameEffect
                  )}
                >
                  {nameToDisplay}
                </h1>

                {showUsername && (
                  <span className="text-xs font-normal text-muted-foreground sm:text-sm">
                    ({username})
                  </span>
                )}

                {profile?.pronouns && (
                  <Badge
                    variant="secondary"
                    className="rounded-xl px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground sm:px-2 sm:py-0.5 sm:text-xs"
                  >
                    {profile.pronouns}
                  </Badge>
                )}
              </div>

              {/* Green area: status */}
              {profile?.statusText && (
                <div className="inline-flex w-fit max-w-full items-center rounded-xl border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-foreground/90 shadow-xs backdrop-blur-xs transition-colors hover:border-border/80 hover:bg-muted/60 sm:max-w-xl sm:rounded-2xl sm:px-3.5 sm:py-1 sm:text-sm">
                  <span className="line-clamp-2 leading-snug font-medium break-words sm:line-clamp-none">
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
