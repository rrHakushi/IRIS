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
  const nameToDisplay = profile?.displayName?.trim() || username
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
        <div className="flex flex-col gap-4 pt-1 pb-6 md:flex-row md:items-end md:justify-between">
          {/* Avatar and User Identification */}
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
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

            {/* Name & Status */}
            <div className="ms-2 flex flex-col gap-1 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  style={nameStyle}
                  className={cn(
                    "font-heading text-2xl font-bold tracking-tight sm:text-3xl",
                    nameEffect
                  )}
                >
                  {nameToDisplay}
                </h1>

                {profile?.pronouns && (
                  <Badge
                    variant="secondary"
                    className="rounded-xl px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {profile.pronouns}
                  </Badge>
                )}
              </div>

              {profile?.statusText && (
                <div className="inline-flex w-fit max-w-xl items-center rounded-2xl border border-border/60 bg-muted/40 px-3.5 py-1 text-xs text-foreground/90 shadow-xs backdrop-blur-xs transition-colors hover:border-border/80 hover:bg-muted/60 sm:text-sm">
                  <span className="leading-snug font-medium break-words">
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
