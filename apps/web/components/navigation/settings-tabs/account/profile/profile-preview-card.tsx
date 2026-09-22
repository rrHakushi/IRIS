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
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  IconCrown,
  IconSparkles,
  IconExternalLink,
  IconQuote,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getBadgeById,
  type UserProfileCustomization,
} from "@IRIS/shared"
import {
  Button as AriaButton,
  Dialog as AriaDialog,
} from "react-aria-components"
import { renderBioMarkdown } from "./markdown-bio-editor"
import { IrisSidebarUserCard } from "../../../iris-sidebar-user-card"
import { UserPreviewModal } from "../../../user-preview-modal"
import { SocialFaviconIcon, getDomainFromUrl } from "./social-links-card"
import { renderBadgeIcon } from "./badge-showcase-card"

export interface ProfilePreviewCardProps {
  profile: UserProfileCustomization
  username: string
  email?: string
  className?: string
  variant?: "preview" | "popover"
  isOwner?: boolean
  onOpenPreviewModal?: () => void
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
  variant = "preview",
  isOwner = false,
  onOpenPreviewModal,
}: ProfilePreviewCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const nameToShow = profile.displayName || username || "Display Name"
  const initial = nameToShow.charAt(0).toUpperCase()

  const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(
    profile.displayNameStyle?.effect
  )
  const hasValidFrame = isValidFrameUrl(profile.avatarFrame)
  const isPopover = variant === "popover"
  const [internalPreviewModalOpen, setInternalPreviewModalOpen] =
    React.useState(false)

  const handleOpenPreviewModal = () => {
    if (onOpenPreviewModal) {
      onOpenPreviewModal()
    } else {
      setInternalPreviewModalOpen(true)
    }
  }

  const spotlight = profile.pinnedSpotlight
  const showcaseBadgeIds = profile.showcaseBadgeIds || []

  return (
    <div
      className={cn(
        "isolate flex w-[340px] max-w-full flex-col overflow-hidden transition-all duration-300",
        isPopover
          ? "rounded-[24px] border border-border/80 bg-card/95 text-card-foreground shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl select-none"
          : "rounded-2xl border border-border/60 bg-card/80 shadow-md backdrop-blur-xl",
        className
      )}
    >
      {/* Header bar (Only shown in settings preview mode) */}
      {!isPopover && (
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-3">
          <span className="text-xs font-bold text-foreground">
            {t("preview")}
          </span>
          {profile.accentColor && (
            <div className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full border border-white/40 shadow-xs"
                style={{ backgroundColor: profile.accentColor }}
              />
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                {profile.accentColor}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Preview Container */}
      <div className={cn(isPopover ? "p-0" : "space-y-4 p-4")}>
        {/* 1. Full Profile Card View */}
        <div
          className={cn(
            "relative flex min-h-[410px] flex-col overflow-hidden bg-card",
            isPopover
              ? "rounded-none border-0 shadow-none"
              : "rounded-2xl border border-border/60 shadow-sm"
          )}
        >
          {/* Banner Header: Fixed aspect 16:5.5 matching cropper modal */}
          <div
            className="relative w-full overflow-hidden bg-linear-to-r from-primary/30 via-primary/10 to-muted/50 min-h-[90px]"
            style={{ aspectRatio: "16 / 5.5" }}
          >
            {profile.bannerUrl ? (
              <Image
                src={profile.bannerUrl}
                alt="Profile Banner"
                fill
                sizes="(max-width: 768px) 100vw, 340px"
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

            {/* Custom Transparent Banner Overlay Asset */}
            {profile.bannerOverlayUrl && (
              <div className="pointer-events-none absolute inset-0 z-1 select-none">
                <Image
                  src={profile.bannerOverlayUrl}
                  alt="Banner Overlay"
                  fill
                  sizes="(max-width: 768px) 100vw, 340px"
                  unoptimized
                  className="object-cover"
                />
              </div>
            )}

            {/* Dark subtle gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent pointer-events-none" />
          </div>

          {/* Profile Avatar & Info section */}
          <div className="relative flex flex-1 flex-col px-4 pt-0 pb-4">
            {/* Floating Avatar with Frame and Status Speech Bubble */}
            <div className="-mt-8 mb-2 flex items-end justify-between gap-2">
              <div className="flex min-w-0 items-end gap-2.5">
                {/* Clickable Avatar opening UserPreviewModal */}
                <button
                  type="button"
                  onClick={handleOpenPreviewModal}
                  className="group relative size-16 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-hidden active:scale-95"
                  title={`View ${nameToShow}'s preview`}
                >
                  <Avatar className="size-full border-2 border-card bg-background shadow-md">
                    {profile.avatarUrl ? (
                      <AvatarImage src={profile.avatarUrl} alt={nameToShow} />
                    ) : null}
                    <AvatarFallback className="bg-primary/15 text-base font-black text-primary uppercase">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  {hasValidFrame && (
                    <div
                      className="pointer-events-none absolute z-10 select-none"
                      style={{
                        width: "130%",
                        height: "130%",
                        top: "-15%",
                        left: "-15%",
                      }}
                    >
                      <Image
                        src={profile.avatarFrame!}
                        alt="Avatar Frame"
                        fill
                        sizes="84px"
                        unoptimized
                        loading="eager"
                        priority
                        className="size-full object-contain"
                      />
                    </div>
                  )}
                </button>

                {/* Status Message Speech Bubble */}
                {profile.statusText && (
                  <div className="relative mb-2.5 flex max-w-[210px] min-w-0 flex-1 items-center">
                    <div className="flex shrink-0 items-center gap-0.5 pe-1 select-none">
                      <span className="size-1 rounded-full bg-border/80" />
                      <span className="size-1.5 rounded-full bg-border/90" />
                    </div>
                    <div
                      className="line-clamp-2 rounded-2xl border border-border/70 bg-secondary/90 px-3 py-1.5 text-xs leading-snug font-semibold break-words text-foreground shadow-xs backdrop-blur-xs"
                      title={profile.statusText}
                    >
                      {profile.statusText}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Display Name & Username & Pronouns */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPreviewModal}
                  className={cn(
                    "cursor-pointer truncate text-start text-base font-bold tracking-tight transition-all duration-200 hover:underline focus:outline-hidden",
                    nameEffect
                  )}
                  style={nameStyle}
                >
                  {nameToShow}
                </button>
                {profile.pronouns && (
                  <span className="shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {profile.pronouns}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenPreviewModal}
                className="cursor-pointer text-start text-xs font-medium text-muted-foreground/80 hover:underline focus:outline-hidden"
              >
                @{username}
              </button>

              {/* Showcased Badges Strip (Up to 5 badges) */}
              {showcaseBadgeIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {showcaseBadgeIds.slice(0, 5).map((id) => {
                    const badge = getBadgeById(id)
                    if (!badge) return null
                    return (
                      <div
                        key={badge.id}
                        title={`${badge.name}: ${badge.description}`}
                        className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-2xs backdrop-blur-xs"
                        style={{ borderColor: `${badge.color}40` }}
                      >
                        <span style={{ color: badge.color }}>
                          {renderBadgeIcon(badge.icon, "size-3")}
                        </span>
                        <span>{badge.name}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* List Owner Badge if applicable */}
              {isOwner && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge
                    variant="outline"
                    className="h-5 gap-0.5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-bold text-amber-400"
                  >
                    <IconCrown className="size-2.5" />
                    <span>List Owner</span>
                  </Badge>
                </div>
              )}
            </div>

            {/* Social Links Row with Favicons */}
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2.5">
                {profile.socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-1 text-[11px] font-medium text-foreground transition-all hover:border-primary/40 hover:bg-muted/50"
                  >
                    <SocialFaviconIcon url={link.url} className="size-3" />
                    <span className="max-w-[120px] truncate">
                      {link.label || getDomainFromUrl(link.url)}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {/* Spotlight Showcase Preview */}
            {spotlight && (spotlight.title || spotlight.customNote) && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                <div className="flex items-center justify-between gap-1 pb-1 text-[10px] font-bold uppercase text-primary">
                  <span className="flex items-center gap-1">
                    <IconSparkles className="size-3 text-primary" />
                    Spotlight
                  </span>
                  {spotlight.mediaType && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 text-[9px] font-bold uppercase"
                    >
                      {spotlight.mediaType}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  {spotlight.imageUrl && (
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/40 shadow-2xs">
                      <Image
                        src={spotlight.imageUrl}
                        alt={spotlight.title || "Spotlight item"}
                        fill
                        sizes="40px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {spotlight.title && (
                      <h6 className="font-heading text-xs font-bold text-foreground truncate">
                        {spotlight.title}
                      </h6>
                    )}
                    {spotlight.subtitle && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {spotlight.subtitle}
                      </p>
                    )}
                    {spotlight.customNote && (
                      <p className="mt-0.5 text-[10px] italic text-primary/80 line-clamp-1">
                        &ldquo;{spotlight.customNote}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bio Section */}
            <div className="mt-3 flex flex-1 flex-col border-t border-border/40 pt-2.5">
              <div className="mb-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {t("aboutMe")}
              </div>
              <div className="max-h-36 min-h-[80px] flex-1 overflow-y-auto rounded-xl border border-border/30 bg-muted/20 p-2.5 text-xs leading-relaxed">
                {renderBioMarkdown(profile.bio || "", t("noBio"))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Nameplate Preview View (Only shown in settings preview mode) */}
        {!isPopover && (
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
        )}
      </div>

      {/* User Preview Modal (Only rendered when not handled by external callback) */}
      {!onOpenPreviewModal && (
        <UserPreviewModal
          isOpen={internalPreviewModalOpen}
          onOpenChange={setInternalPreviewModalOpen}
          username={username}
          profile={profile}
        />
      )}
    </div>
  )
}

export interface UserProfilePopoverProps {
  profile: UserProfileCustomization
  username: string
  email?: string
  isOwner?: boolean
  children: React.ReactNode
  placement?: any
  className?: string
  style?: React.CSSProperties
}

export function UserProfilePopover({
  profile,
  username,
  email,
  isOwner,
  children,
  placement = "right top",
  className,
  style,
}: UserProfilePopoverProps): React.JSX.Element {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = React.useState(false)

  return (
    <>
      <PopoverTrigger>
        <AriaButton
          className={cn(
            "cursor-pointer border-0 bg-transparent p-0 text-start outline-none",
            className
          )}
          style={style}
        >
          {children}
        </AriaButton>
        <Popover
          placement={placement}
          offset={8}
          className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-border/80 bg-card/95 p-0 text-card-foreground shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl outline-none"
        >
          <AriaDialog
            aria-label={`${username}'s profile`}
            className="outline-none"
          >
            {({ close }) => (
              <ProfilePreviewCard
                profile={profile}
                username={username}
                email={email}
                isOwner={isOwner}
                variant="popover"
                className="border-0 bg-transparent shadow-none"
                onOpenPreviewModal={() => {
                  close()
                  setIsPreviewModalOpen(true)
                }}
              />
            )}
          </AriaDialog>
        </Popover>
      </PopoverTrigger>

      <UserPreviewModal
        isOpen={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        username={username}
        profile={profile}
      />
    </>
  )
}
