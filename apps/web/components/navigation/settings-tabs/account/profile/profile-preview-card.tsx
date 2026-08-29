"use client";

import React from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
} from "@IRIS/shared";
import { renderBioMarkdown } from "./markdown-bio-editor";
import { IrisSidebarUserCard } from "../../../iris-sidebar-user-card";

export interface ProfilePreviewCardProps {
  profile: UserProfileCustomization;
  username: string;
  email?: string;
  className?: string;
}

function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:"))
  );
}

export function ProfilePreviewCard({
  profile,
  username,
  email,
  className,
}: ProfilePreviewCardProps): React.JSX.Element {
  const nameToShow = profile.displayName || username || "Display Name";
  const initial = nameToShow.charAt(0).toUpperCase();

  const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle);
  const nameEffect = getDisplayNameEffectClasses(profile.displayNameStyle?.effect);
  const hasValidFrame = isValidFrameUrl(profile.avatarFrame);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-md overflow-hidden flex flex-col transition-all duration-300 isolate",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
        <span className="text-xs font-bold text-foreground">Preview</span>
      </div>

      {/* Main Preview Container: Displays both Profile Card and Nameplate Preview */}
      <div className="p-4 space-y-4">
        {/* 1. Full Profile Card View */}
        <div className="relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          {/* Banner Header */}
          <div className="relative h-28 w-full bg-linear-to-r from-primary/30 via-primary/10 to-muted/50 overflow-hidden">
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
              <div className="size-full bg-linear-to-br from-primary/20 via-background to-primary/5 flex items-center justify-end pr-4 text-primary/10 select-none">
                <span className="font-black text-6xl tracking-tighter opacity-20">IRIS</span>
              </div>
            )}
            {/* Dark subtle gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />
          </div>

          {/* Profile Avatar & Info section */}
          <div className="px-4 pb-4 pt-0 relative">
            {/* Floating Avatar with Frame */}
            <div className="flex justify-between items-end -mt-10 mb-3">
              <div className="relative flex items-center justify-center">
                <Avatar className="size-20 border-2 border-card bg-background shadow-md">
                  {profile.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={nameToShow} />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-primary text-xl font-black uppercase">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                {hasValidFrame && (
                  <div className="absolute -inset-3 size-26 max-w-none pointer-events-none z-10 select-none">
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

              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-background/80 backdrop-blur-xs font-mono">
                MEMBER
              </Badge>
            </div>

            {/* Display Name & Username & Pronouns */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-base font-bold tracking-tight truncate transition-all duration-200",
                    nameEffect
                  )}
                  style={nameStyle}
                >
                  {nameToShow}
                </span>
                {profile.pronouns && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground font-medium shrink-0">
                    {profile.pronouns}
                  </span>
                )}
              </div>

              <div className="text-xs font-medium text-muted-foreground/80">
                @{username}
              </div>

              {/* Status Message */}
              {profile.statusText && (
                <div className="text-xs text-foreground/90 italic flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px]">💬</span>
                  <span className="truncate">{profile.statusText}</span>
                </div>
              )}
            </div>

            {/* Bio Section */}
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                About Me
              </div>
              <div className="text-xs bg-muted/20 p-2.5 rounded-xl border border-border/30">
                {renderBioMarkdown(profile.bio || "")}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Nameplate Preview View */}
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
            Nameplate Preview
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
  );
}
