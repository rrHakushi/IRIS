"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { buttonVariants } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconArrowRight,
  IconSparkles,
  IconQuote,
  IconUser,
} from "@tabler/icons-react"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getBadgeById,
  type UserProfileCustomization,
} from "@IRIS/shared"
import { renderBioMarkdown } from "./settings-tabs/account/profile/markdown-bio-editor"
import { renderBadgeIcon } from "./settings-tabs/account/profile/badge-showcase-card"
import { cn } from "@workspace/ui/lib/utils"

export interface UserPreviewModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  username: string
  profile?: UserProfileCustomization | null
}

export function UserPreviewModal({
  isOpen,
  onOpenChange,
  username,
  profile,
}: UserPreviewModalProps): React.JSX.Element {
  const displayName = profile?.displayName || username
  const initial = (displayName || "?").charAt(0).toUpperCase()
  const nameStyle = getDisplayNameStyleCss(profile?.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(profile?.displayNameStyle?.effect)

  const spotlight = profile?.pinnedSpotlight
  const hasSpotlight = Boolean(spotlight && (spotlight.title || spotlight.customNote))

  const customAccentColor = profile?.accentColor
  const accentStyles = customAccentColor
    ? ({
        "--primary": customAccentColor,
        "--ring": customAccentColor,
        "--profile-accent": customAccentColor,
      } as React.CSSProperties)
    : undefined

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="z-[100] max-w-md overflow-hidden rounded-3xl border border-border/80 bg-background/95 p-0 backdrop-blur-2xl sm:max-w-lg transition-colors duration-300"
      style={accentStyles}
    >
      {/* Banner */}
      <div
        className="relative w-full overflow-hidden min-h-[120px]"
        style={{
          aspectRatio: "16 / 6",
          ...(customAccentColor
            ? {
                background: `linear-gradient(135deg, ${customAccentColor}33 0%, var(--card) 60%, ${customAccentColor}18 100%)`,
              }
            : {}),
        }}
      >
        {profile?.bannerUrl ? (
          <>
            <Image
              src={profile.bannerUrl}
              alt="Profile Banner"
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-cover"
            />
            {customAccentColor && (
              <div
                className="pointer-events-none absolute inset-0 z-1 opacity-25 mix-blend-color-dodge"
                style={{
                  background: `radial-gradient(ellipse 90% 70% at 50% 20%, ${customAccentColor} 0%, transparent 80%)`,
                }}
              />
            )}
          </>
        ) : (
          <div
            className="flex size-full items-center justify-end pe-4 select-none"
            style={
              customAccentColor
                ? {
                    background: `linear-gradient(135deg, ${customAccentColor}28 0%, var(--background) 50%, ${customAccentColor}15 100%)`,
                  }
                : undefined
            }
          >
            <span
              className="text-5xl font-black tracking-tighter opacity-20"
              style={customAccentColor ? { color: customAccentColor } : undefined}
            >
              IRIS
            </span>
          </div>
        )}
        <div className="absolute inset-0 z-2 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="relative px-6 pb-6 pt-0">
        {/* Avatar & Action Button Header */}
        <div className="-mt-12 mb-4 flex items-end justify-between gap-4">
          <div className="relative size-20 shrink-0">
            <div className="relative size-full overflow-hidden rounded-full border-3 border-background bg-card shadow-lg ring-1 ring-border/50">
              {profile?.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={displayName}
                  fill
                  sizes="80px"
                  priority
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-primary/15 text-xl font-black text-primary uppercase select-none">
                  {initial}
                </div>
              )}
            </div>
            {profile?.avatarFrame && (
              <div
                className="pointer-events-none absolute z-20 select-none"
                style={{
                  width: "130%",
                  height: "130%",
                  top: "-15%",
                  left: "-15%",
                }}
              >
                <Image
                  src={profile.avatarFrame}
                  alt="Avatar Frame"
                  fill
                  sizes="104px"
                  priority
                  unoptimized
                  className="size-full object-contain"
                />
              </div>
            )}
          </div>

          <Link
            href={`/IRIS-account/users/${username}`}
            onClick={() => onOpenChange(false)}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs"
            )}
          >
            <span>View Full Profile</span>
            <IconArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Identity & Status */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn("text-lg font-bold tracking-tight", nameEffect)}
              style={nameStyle}
            >
              {displayName}
            </h3>
            {profile?.pronouns && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                {profile.pronouns}
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            @{username}
          </p>
          {profile?.statusText && (
            <p className="mt-1 text-xs italic text-foreground/80">
              &ldquo;{profile.statusText}&rdquo;
            </p>
          )}

          {/* Showcased Badges Strip (Up to 10 badges) */}
          {profile?.showcaseBadgeIds && profile.showcaseBadgeIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {profile.showcaseBadgeIds.slice(0, 10).map((id) => {
                const badge = getBadgeById(id)
                if (!badge) return null
                return (
                  <TooltipTrigger key={badge.id} delay={150}>
                    <button
                      type="button"
                      aria-label={badge.name}
                      className="group relative flex size-6.5 shrink-0 items-center justify-center rounded-lg border bg-card/80 shadow-2xs backdrop-blur-xs transition-all hover:scale-110 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      style={{
                        borderColor: `${badge.color}60`,
                        backgroundColor: `${badge.color}15`,
                        color: badge.color,
                      }}
                    >
                      {renderBadgeIcon(badge.icon, "size-3.5")}
                    </button>
                    <Tooltip className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-popover px-2.5 py-1.5 text-start shadow-xl backdrop-blur-md">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: badge.color }}
                        />
                        <span className="text-xs font-bold text-popover-foreground">
                          {badge.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {badge.description}
                      </span>
                    </Tooltip>
                  </TooltipTrigger>
                )
              })}
            </div>
          )}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed text-foreground/90">
            {renderBioMarkdown(profile.bio, "")}
          </div>
        )}

        {/* Spotlight Showcase if set */}
        {hasSpotlight && spotlight && (
          <div className="mt-4 rounded-xl border border-primary/25 bg-gradient-to-br from-card/80 via-card/40 to-primary/5 p-3 shadow-2xs">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-primary">
              <IconSparkles className="size-3.5" />
              <span>Pinned Spotlight</span>
            </div>
            <div className="flex items-center gap-3">
              {spotlight.imageUrl && (
                <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/40">
                  <Image
                    src={spotlight.imageUrl}
                    alt={spotlight.title || "Spotlight"}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {spotlight.title && (
                  <p className="text-xs font-bold text-foreground truncate">
                    {spotlight.title}
                  </p>
                )}
                {spotlight.subtitle && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {spotlight.subtitle}
                  </p>
                )}
                {spotlight.customNote && (
                  <p className="mt-1 text-[10px] italic text-muted-foreground truncate">
                    &ldquo;{spotlight.customNote}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

