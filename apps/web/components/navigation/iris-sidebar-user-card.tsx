"use client"

import * as React from "react"
import Image from "next/image"
import { IconSelector } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { formatBadgeNumber } from "@/lib/numbers"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type DisplayNameStyle,
} from "@IRIS/shared"

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

export interface IrisSidebarUserCardProps extends React.HTMLAttributes<HTMLDivElement> {
  nameplateUrl?: string | null
  sidebarCardBackgroundUrl?: string | null
  avatarUrl?: string | null
  avatarFrame?: string | null
  displayName?: string | null
  displayNameStyle?: DisplayNameStyle | null
  statusText?: string | null
  username?: string | null
  email?: string | null
  showEmail?: boolean
  unreadCount?: number
  showChevrons?: boolean
  className?: string
  avatarClassName?: string
}

export const IrisSidebarUserCard = React.forwardRef<
  HTMLDivElement,
  IrisSidebarUserCardProps
>(
  (
    {
      nameplateUrl,
      sidebarCardBackgroundUrl,
      avatarUrl,
      avatarFrame,
      displayName,
      displayNameStyle,
      statusText,
      username,
      email,
      showEmail = false,
      unreadCount = 0,
      showChevrons = true,
      className,
      avatarClassName,
      ...props
    },
    ref
  ) => {
    const nameToShow = displayName || username || "I"
    const initial = nameToShow.charAt(0).toUpperCase()
    const activeNameplate = nameplateUrl || sidebarCardBackgroundUrl
    const effectClasses = getDisplayNameEffectClasses(displayNameStyle?.effect)
    const customStyle = getDisplayNameStyleCss(displayNameStyle || undefined)

    return (
      <div
        ref={ref}
        {...props}
        className={cn(
          "relative isolate flex items-center gap-3 overflow-hidden rounded-xl border border-border/50 bg-card/60 px-3 py-2 normal-case backdrop-blur-xl transition-all duration-300 select-none",
          className
        )}
      >
        {/* Background nameplate image & gradient overlay */}
        {activeNameplate && (
          <>
            <div
              className="absolute inset-0 z-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${activeNameplate})` }}
            />
            <div className="absolute inset-0 z-0 bg-linear-to-r from-black/90 via-black/75 to-black/20" />
          </>
        )}

        {/* Avatar & optional unread badge & avatar frame */}
        <div className="relative z-10 flex shrink-0 items-center justify-center">
          <Avatar
            className={cn(
              "size-9 border border-border/60 shadow-xs",
              avatarClassName
            )}
          >
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={nameToShow} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary uppercase">
              {initial}
            </AvatarFallback>
          </Avatar>
          {isValidFrameUrl(avatarFrame) && (
            <div className="pointer-events-none absolute -inset-1.5 z-10 size-12 max-w-none select-none">
              <Image
                src={avatarFrame}
                alt="Avatar Frame"
                fill
                sizes="48px"
                unoptimized
                loading="eager"
                priority
                className="object-contain"
              />
            </div>
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[8px] font-bold text-primary-foreground">
              {formatBadgeNumber(unreadCount, 2)}
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="z-10 ml-1 grid min-w-0 flex-1 text-left leading-tight">
          <span
            className={cn(
              "truncate text-xs font-bold",
              activeNameplate
                ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                : "text-foreground",
              effectClasses
            )}
            style={customStyle}
          >
            {nameToShow}
          </span>
          <span
            className={cn(
              "mt-0.5 truncate text-[10px] font-medium",
              activeNameplate
                ? "text-zinc-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                : "text-muted-foreground"
            )}
          >
            {statusText || (username ? `@${username}` : email || "")}
          </span>
        </div>

        {/* Optional Chevrons */}
        {showChevrons && (
          <IconSelector
            className={cn(
              "z-10 ml-auto size-4 shrink-0",
              sidebarCardBackgroundUrl
                ? "text-zinc-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                : "text-muted-foreground/70"
            )}
          />
        )}
      </div>
    )
  }
)

IrisSidebarUserCard.displayName = "IrisSidebarUserCard"
