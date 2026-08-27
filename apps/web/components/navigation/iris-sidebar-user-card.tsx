"use client";

import * as React from "react";
import { IconSelector } from "@tabler/icons-react";
import { cn } from "@workspace/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export interface IrisSidebarUserCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  sidebarCardBackgroundUrl?: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  showEmail?: boolean;
  unreadCount?: number;
  showChevrons?: boolean;
  className?: string;
  avatarClassName?: string;
}

export const IrisSidebarUserCard = React.forwardRef<
  HTMLDivElement,
  IrisSidebarUserCardProps
>(
  (
    {
      sidebarCardBackgroundUrl,
      avatarUrl,
      displayName,
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
    const nameToShow = displayName || username || "Operator";
    const initial = nameToShow.charAt(0).toUpperCase();

    return (
      <div
        ref={ref}
        {...props}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden transition-all duration-300 isolate select-none",
          className
        )}
      >
        {/* Background image & gradient overlay */}
        {sidebarCardBackgroundUrl && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center z-0"
              style={{ backgroundImage: `url(${sidebarCardBackgroundUrl})` }}
            />
            <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/75 to-black/20 z-0" />
          </>
        )}

        {/* Avatar & optional unread badge */}
        <div className="relative shrink-0 z-10">
          <Avatar
            className={cn(
              "size-9 border border-border/60 shadow-xs",
              avatarClassName
            )}
          >
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={nameToShow} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-bold uppercase text-xs">
              {initial}
            </AvatarFallback>
          </Avatar>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground border border-background">
              {unreadCount}
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="grid flex-1 text-left leading-tight ml-1 z-10 min-w-0">
          <span
            className={cn(
              "truncate text-xs font-bold",
              sidebarCardBackgroundUrl
                ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                : "text-foreground"
            )}
          >
            {nameToShow}
          </span>
          {showEmail && email && (
            <span
              className={cn(
                "truncate text-[10px] font-medium mt-0.5",
                sidebarCardBackgroundUrl
                  ? "text-zinc-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                  : "text-muted-foreground"
              )}
            >
              {email}
            </span>
          )}
        </div>

        {/* Optional Chevrons */}
        {showChevrons && (
          <IconSelector
            className={cn(
              "ml-auto size-4 z-10 shrink-0",
              sidebarCardBackgroundUrl
                ? "text-zinc-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                : "text-muted-foreground/70"
            )}
          />
        )}
      </div>
    );
  }
);

IrisSidebarUserCard.displayName = "IrisSidebarUserCard";
