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
import { IconCrown } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
} from "@IRIS/shared"
import {
  Button as AriaButton,
  Dialog as AriaDialog,
} from "react-aria-components"
import { renderBioMarkdown } from "./markdown-bio-editor"
import { IrisSidebarUserCard } from "../../../iris-sidebar-user-card"
import { UserPreviewModal } from "../../../user-preview-modal"

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

  return (
    <div
      className={cn(
        "isolate flex w-[340px] max-w-full flex-col overflow-hidden transition-all duration-300",
        isPopover
          ? "rounded-[24px] border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 select-none"
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
        </div>
      )}

      {/* Main Preview Container */}
      <div className={cn(isPopover ? "p-0" : "space-y-4 p-4")}>
        {/* 1. Full Profile Card View */}
        <div
          className={cn(
            "relative overflow-hidden bg-card flex flex-col min-h-[410px]",
            isPopover
              ? "rounded-none border-0 shadow-none"
              : "rounded-2xl border border-border/60 shadow-sm"
          )}
        >
          {/* Banner Header with fixed aspect ratio */}
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-linear-to-r from-primary/30 via-primary/10 to-muted/50">
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
            {/* Dark subtle gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />
          </div>

          {/* Profile Avatar & Info section */}
          <div className="relative flex flex-1 flex-col px-4 pt-0 pb-4">
            {/* Floating Avatar with Frame and Status Speech Bubble */}
            <div className="-mt-10 mb-3 flex items-end justify-between gap-2">
              <div className="flex items-end gap-2.5 min-w-0">
                {/* Clickable Avatar opening UserPreviewModal */}
                <button
                  type="button"
                  onClick={handleOpenPreviewModal}
                  className="group relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 focus:outline-hidden"
                  title={`View ${nameToShow}'s preview`}
                >
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
                </button>

                {/* Status Message Speech Bubble (Discord-style next to avatar, up to 2 lines) */}
                {profile.statusText && (
                  <div className="relative mb-2.5 flex items-center min-w-0 flex-1 max-w-[210px]">
                    {/* Speech bubble tail dots */}
                    <div className="flex items-center gap-0.5 pe-1 select-none shrink-0">
                      <span className="size-1 rounded-full bg-border/80" />
                      <span className="size-1.5 rounded-full bg-border/90" />
                    </div>
                    {/* Speech bubble body */}
                    <div
                      className="line-clamp-2 break-words rounded-2xl border border-border/70 bg-secondary/90 px-3 py-1.5 text-xs font-semibold leading-snug text-foreground shadow-xs backdrop-blur-xs"
                      title={profile.statusText}
                    >
                      {profile.statusText}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Display Name & Username & Pronouns (Clickable to open UserPreviewModal) */}
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

              {/* Badges row under username */}
              {isOwner && (
                <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
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

            {/* Bio Section (Expanded for taller profile card) */}
            <div className="mt-4 flex flex-1 flex-col border-t border-border/40 pt-3">
              <div className="mb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {t("aboutMe")}
              </div>
              <div className="min-h-[110px] max-h-44 flex-1 overflow-y-auto rounded-xl border border-border/30 bg-muted/20 p-2.5 text-xs leading-relaxed">
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
            "cursor-pointer outline-none bg-transparent p-0 border-0 text-start",
            className
          )}
          style={style}
        >
          {children}
        </AriaButton>
        <Popover
          placement={placement}
          offset={8}
          className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-border/80 bg-card/95 p-0 text-card-foreground shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 outline-none"
        >
          <AriaDialog aria-label={`${username}'s profile`} className="outline-none">
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
