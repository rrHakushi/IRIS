"use client"

import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import Image from "next/image"
import {
  IconInfoCircle,
  IconLink,
  IconExternalLink,
  IconUser,
  IconSparkles,
  IconQuote,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconHeadphones,
  IconBuildingCommunity,
} from "@tabler/icons-react"
import { UserProfileComments } from "../user-profile-comments"
import { ProviderIcon } from "../../navigation/settings-tabs/account/connections/icons"
import { renderBioMarkdown } from "../../navigation/settings-tabs/account/profile/markdown-bio-editor"
import type { UserProfileCustomization } from "@IRIS/shared"

export interface OverviewTabProps {
  username: string
  profile: UserProfileCustomization
  connections?: any[]
  isOwner: boolean
}

const SPOTLIGHT_CATEGORIES: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ANIME: { label: "Anime", icon: IconDeviceTv },
  MANGA: { label: "Manga", icon: IconBook },
  MOVIE: { label: "Movie", icon: IconMovie },
  TV: { label: "TV Series", icon: IconDeviceTv },
  GAME: { label: "Game", icon: IconDeviceGamepad },
  BOOK: { label: "Book", icon: IconBook },
  MUSIC: { label: "Music", icon: IconHeadphones },
  CHARACTER: { label: "Character", icon: IconSparkles },
  PERSON: { label: "Staff & Cast", icon: IconUser },
  STUDIO: { label: "Studio", icon: IconBuildingCommunity },
  CUSTOM: { label: "Spotlight", icon: IconSparkles },
}

export function OverviewTab({
  username,
  profile,
  connections = [],
  isOwner,
}: OverviewTabProps): React.JSX.Element {
  const spotlight = profile.pinnedSpotlight
  const hasSpotlight = Boolean(spotlight && (spotlight.title || spotlight.customNote))
  const categoryConfig = spotlight?.mediaType
    ? SPOTLIGHT_CATEGORIES[spotlight.mediaType.toUpperCase()]
    : null
  const CategoryIcon = categoryConfig?.icon || IconSparkles

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column (8 cols): Bio on top, Spotlight in middle, Comments directly underneath */}
      <div className="space-y-6 lg:col-span-8">
        {/* 1. Bio Card */}
        <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <IconUser className="size-4 text-primary" />
              About Me
            </CardTitle>
          </CardHeader>

          <CardContent>
            {profile.bio ? (
              <div className="text-xs leading-relaxed text-foreground">
                {renderBioMarkdown(profile.bio, "")}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
                @{username} has not written a bio yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Pinned Spotlight Showcase (Between Bio and Comments) */}
        {hasSpotlight && spotlight && (
          <Card className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/50 to-primary/5 shadow-xs transition-all hover:border-primary/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <IconSparkles className="size-4 text-primary animate-pulse" />
                  Spotlight
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {spotlight.imageUrl && (
                  <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/40 shadow-sm sm:w-28">
                    <Image
                      src={spotlight.imageUrl}
                      alt={spotlight.title || "Spotlight artwork"}
                      fill
                      sizes="(max-width: 640px) 96px, 112px"
                      className="object-cover transition-transform duration-300 hover:scale-105"
                      unoptimized
                    />
                  </div>
                )}

                <div className="flex flex-1 flex-col justify-between space-y-2.5 min-w-0">
                  <div className="space-y-1">
                    {spotlight.title && (
                      <h4 className="text-base font-bold text-foreground sm:text-lg truncate">
                        {spotlight.title}
                      </h4>
                    )}
                    {spotlight.subtitle && (
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {spotlight.subtitle}
                      </p>
                    )}
                  </div>

                  {spotlight.customNote && (
                    <div className="relative rounded-xl border border-border/40 bg-muted/30 p-3 text-xs text-foreground/90 italic">
                      <IconQuote className="mb-1 size-3.5 text-primary/60" />
                      &ldquo;{spotlight.customNote}&rdquo;
                    </div>
                  )}

                  {spotlight.link && (
                    <div className="pt-1">
                      <a
                        href={spotlight.link}
                        target={spotlight.link.startsWith("http") ? "_blank" : undefined}
                        rel={spotlight.link.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        <IconExternalLink className="size-3.5" />
                        Explore Entry
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Comments (4 per page with pagination) under Bio and Spotlight */}
        <UserProfileComments
          username={username}
          isOwner={isOwner}
          pageSize={4}
        />
      </div>

      {/* Right Column (4 cols): Connections next to Bio */}
      <div className="space-y-6 lg:col-span-4">
        <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <IconLink className="size-4 text-primary" />
              Connected Services
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2.5">
            {connections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                No connected services.
              </div>
            ) : (
              connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-2.5 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card p-1 shadow-2xs">
                      <ProviderIcon provider={conn.provider} iconUrl={conn.iconUrl} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground capitalize truncate">
                          {conn.provider.toLowerCase()}
                        </span>
                        <Badge className="h-3.5 border-emerald-500/30 bg-emerald-500/10 px-1 text-[8px] font-bold text-emerald-400">
                          Linked
                        </Badge>
                      </div>
                      <span className="block text-[10px] text-muted-foreground truncate">
                        {conn.displayName || "Account"}
                      </span>
                    </div>
                  </div>

                  {conn.profileUrl && (
                    <a
                      href={conn.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <IconExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
