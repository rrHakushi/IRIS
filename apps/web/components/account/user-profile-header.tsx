"use client"

import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconCake,
  IconMapPin,
  IconClock,
  IconWorld,
  IconSparkles,
  IconPencil,
  IconShare,
  IconCheck,
  IconCopy,
  IconLink,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
} from "@IRIS/shared"
import { renderSocialIcon } from "../navigation/settings-tabs/account/profile/social-links-card"
import { ProviderIcon } from "../navigation/settings-tabs/account/connections/icons"
import { cn } from "@workspace/ui/lib/utils"

export interface UserProfileHeaderProps {
  username: string
  profile: UserProfileCustomization
  createdAt?: string
  isOwner: boolean
  connections?: any[]
  onEditProfile?: () => void
}

function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false
  const trimmed = url.trim()
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http") ||
      trimmed.startsWith("data:"))
  )
}

export function UserProfileHeader({
  username,
  profile,
  createdAt,
  isOwner,
  connections = [],
  onEditProfile,
}: UserProfileHeaderProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const nameToShow = profile.displayName || username
  const initial = nameToShow.charAt(0).toUpperCase()
  const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(
    profile.displayNameStyle?.effect
  )
  const hasValidFrame = isValidFrameUrl(profile.avatarFrame)

  const bannerHeightClass =
    profile.bannerHeight === "compact"
      ? "h-44 md:h-56"
      : profile.bannerHeight === "expansive"
        ? "h-80 md:h-96"
        : "h-60 md:h-72"

  const customAccentColor = profile.accentColor

  const formattedJoinDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
      })
    : null

  // Birthday formatting
  const formattedBirthday = profile.birthday
    ? (() => {
        try {
          const parts = profile.birthday.split("-")
          if (parts.length === 3) {
            const year = parts[0] || "2000"
            const month = parseInt(parts[1] || "1", 10)
            const day = parseInt(parts[2] || "1", 10)
            const dateObj = new Date(parseInt(year, 10), month - 1, day)
            return dateObj.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: profile.showBirthdayYear ? "numeric" : undefined,
            })
          }
          return profile.birthday
        } catch {
          return profile.birthday
        }
      })()
    : null

  const isBirthdayVisible =
    Boolean(formattedBirthday) &&
    (profile.privacy?.showBirthday === "public" ||
      (profile.privacy?.showBirthday === "friends" && !isOwner) ||
      isOwner)

  const isLocationVisible =
    Boolean(profile.location) &&
    (profile.privacy?.showLocation === "public" ||
      (profile.privacy?.showLocation === "friends" && !isOwner) ||
      isOwner)

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        toast.success("Profile link copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      toast.error("Failed to copy profile link")
    }
  }

  return (
    <div className="relative w-full overflow-hidden border-b border-border/60 bg-card/40">
      {/* 1. Immersive Hero Banner */}
      <div
        className={cn(
          "relative w-full overflow-hidden transition-all duration-300",
          bannerHeightClass
        )}
      >
        {profile.bannerUrl ? (
          <Image
            src={profile.bannerUrl}
            alt="Profile Banner"
            fill
            sizes="100vw"
            priority
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-end bg-gradient-to-br from-card via-background to-muted/30 pr-8 select-none">
            <span className="font-heading text-8xl md:text-9xl font-black tracking-tighter opacity-15">
              IRIS
            </span>
          </div>
        )}

        {/* Dynamic bottom gradient fade to smoothly blend into profile background */}
        <div className="absolute inset-0 z-2 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* 2. Profile Details Bar (Full Width with padding) */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        {/* Top Floating Row: Avatar on Left, Action Toolbar on Right */}
        <div className="-mt-16 sm:-mt-20 flex flex-wrap items-end justify-between gap-4 pb-4">
          {/* Avatar + Frame + Status Speech Bubble */}
          <div className="flex items-end gap-4">
            <div className="relative flex shrink-0 items-center justify-center">
              {/* Avatar Circle Container */}
              <div className="relative size-28 sm:size-32 shrink-0 overflow-hidden rounded-full border-4 border-background bg-card shadow-2xl ring-1 ring-border/50">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={nameToShow}
                    fill
                    sizes="(max-width: 640px) 112px, 128px"
                    priority
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-3xl sm:text-4xl font-black text-primary uppercase select-none">
                    {initial}
                  </div>
                )}
              </div>

              {/* Avatar Decoration Frame */}
              {hasValidFrame && (
                <div className="pointer-events-none absolute -inset-4 z-20 size-36 sm:size-40 max-w-none select-none">
                  <Image
                    src={profile.avatarFrame!}
                    alt="Avatar Frame"
                    fill
                    sizes="160px"
                    unoptimized
                    priority
                    className="object-contain"
                  />
                </div>
              )}
            </div>

            {/* Status text speech bubble */}
            {profile.statusText && (
              <div className="hidden sm:flex mb-2 max-w-sm items-center">
                <div className="flex shrink-0 items-center gap-0.5 pe-1.5 select-none">
                  <span className="size-1 rounded-full bg-border" />
                  <span className="size-1.5 rounded-full bg-border/90" />
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/90 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
                  {profile.statusText}
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar on Right */}
          <div className="flex items-center gap-2 pb-1">
            {isOwner && onEditProfile && (
              <Button
                size="sm"
                onClick={onEditProfile}
                className="cursor-pointer gap-1.5 rounded-xl font-bold shadow-xs transition-all hover:scale-[1.02]"
              >
                <IconPencil className="size-4" />
                <span>Edit Profile</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="cursor-pointer gap-1.5 rounded-xl border-border/70 bg-card/60 backdrop-blur-xs transition-all hover:bg-muted/80 shadow-2xs"
            >
              {copied ? (
                <>
                  <IconCheck className="size-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <IconShare className="size-4" />
                  <span>Share</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Status Text */}
        {profile.statusText && (
          <div className="sm:hidden mb-3">
            <div className="inline-block rounded-xl border border-border/70 bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
              {profile.statusText}
            </div>
          </div>
        )}

        {/* 2-Column Responsive Information Row */}
        <div className="flex flex-col gap-4 pt-1 lg:flex-row lg:items-end lg:justify-between">
          {/* Left Column: Identity & Metadata Badges */}
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className={cn(
                  "font-heading text-2xl sm:text-3xl font-bold tracking-tight",
                  nameEffect
                )}
                style={nameStyle}
              >
                {nameToShow}
              </h1>

              {profile.pronouns && (
                <Badge
                  variant="secondary"
                  className="rounded-xl px-2.5 py-0.5 text-xs font-medium"
                >
                  {profile.pronouns}
                </Badge>
              )}

              <span className="font-mono text-sm font-medium text-muted-foreground">
                @{username}
              </span>
            </div>

            {/* Quick Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {isLocationVisible && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <IconMapPin className="size-3.5 text-emerald-400" />
                  <span>{profile.location}</span>
                </div>
              )}

              {isBirthdayVisible && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <IconCake className="size-3.5 text-rose-400" />
                  <span>{formattedBirthday}</span>
                </div>
              )}

              {profile.timezone && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <IconClock className="size-3.5 text-indigo-400" />
                  <span>{profile.timezone}</span>
                </div>
              )}

              {formattedJoinDate && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <span className="size-1.5 rounded-full bg-primary/70" />
                  <span>Joined {formattedJoinDate}</span>
                </div>
              )}

              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <IconWorld className="size-3.5" />
                  <span className="max-w-[180px] truncate">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Social Links & Connected Services */}
          <div className="flex flex-col items-start gap-2.5 lg:items-end">
            {/* Social Links Pill Bar */}
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {profile.socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary shadow-2xs backdrop-blur-xs"
                  >
                    <span className="text-primary">
                      {renderSocialIcon(link.platform, "size-3.5")}
                    </span>
                    <span className="max-w-[130px] truncate">
                      {link.label || link.platform}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {/* Connected Services Quick Preview */}
            {connections && connections.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
                <span className="text-[11px] font-medium me-1 shrink-0">Connected:</span>
                <div className="flex max-w-[270px] items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {connections.map((conn) => {
                    const content = (
                      <div
                        title={`${conn.provider}: ${conn.displayName || "Account"}`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card p-0.5 shadow-2xs transition-all hover:scale-110 hover:border-primary/50"
                      >
                        <ProviderIcon provider={conn.provider} iconUrl={conn.iconUrl} className="size-3.5" />
                      </div>
                    )

                    return conn.profileUrl ? (
                      <a
                        key={conn.id}
                        href={conn.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 cursor-pointer"
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={conn.id} className="shrink-0">
                        {content}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
