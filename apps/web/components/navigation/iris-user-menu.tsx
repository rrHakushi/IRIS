"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  IconBell,
  IconBookmark,
  IconSettings,
  IconPalette,
  IconUsers,
  IconShieldCheck,
  IconLogout,
  IconLogin,
} from "@tabler/icons-react";
import { useIrisSidebar } from "./sidebar-provider";
import { IrisSidebarUserCard } from "./iris-sidebar-user-card";
import { useUser } from "@/context/user-context";

export interface IrisUserMenuProps {
  onOpenSettings?: () => void;
}

export function IrisUserMenu({ onOpenSettings }: IrisUserMenuProps): React.JSX.Element {
  const { data: session } = useSession();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { position } = useIrisSidebar();
  const isRight = position === "right";

  const [unreadCount, setUnreadCount] = useState(2);

  const displayName = user?.displayName || user?.username || "IRIS Operator";
  const userEmail = user?.email || "operator@iris.local";
  const username = user?.username || "operator";

  const handleAddBookmark = () => {
    try {
      const stored = localStorage.getItem("iris_bookmarks");
      const current: any[] = stored ? JSON.parse(stored) : [];
      const newBm = {
        id: Date.now().toString(),
        title: document.title || "New Bookmark",
        href: window.location.pathname,
      };
      current.push(newBm);
      localStorage.setItem("iris_bookmarks", JSON.stringify(current));
    } catch {
      // ignore
    }
  };

  return (
    <DropdownMenuTrigger>
      {/* Closed Menu Button Trigger */}
      <Button
        variant="ghost"
        className="h-12 w-full p-0 border-0 bg-transparent hover:bg-transparent focus-visible:ring-0 overflow-hidden cursor-pointer"
      >
        <IrisSidebarUserCard
          sidebarCardBackgroundUrl={user?.sidebarCardBackgroundUrl}
          avatarUrl={user?.avatarUrl}
          displayName={displayName}
          username={username}
          email={userEmail}
          unreadCount={unreadCount}
          showChevrons
          className="h-full w-full border-border/40 hover:border-border/80 hover:bg-muted/50 data-[state=open]:bg-muted/80 data-[state=open]:border-border"
        />
      </Button>

      {/* Opened Dropdown Menu */}
      <DropdownMenu
        placement={isRight ? "left bottom" : "right bottom"}
        offset={6}
        className="w-(--trigger-width) min-w-60 rounded-2xl p-1.5"
      >
        {/* User Card Label Header */}
        <DropdownMenuLabel className="p-0 font-normal">
          <Link href="/profile">
            <IrisSidebarUserCard
              sidebarCardBackgroundUrl={user?.sidebarCardBackgroundUrl}
              avatarUrl={user?.avatarUrl}
              displayName={displayName}
              username={username}
              email={userEmail}
              showEmail
              showChevrons={false}
              className="border-border/50 hover:border-border hover:bg-muted/70 mb-1 py-2.5"
            />
          </Link>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Action Group 1 */}
        <DropdownMenuGroup>
          <DropdownMenuItem onAction={() => setUnreadCount(0)}>
            <IconBell className="size-4" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Badge className="ms-auto h-4 px-1 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center min-w-4">
                {unreadCount}
              </Badge>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onAction={handleAddBookmark}>
            <IconBookmark className="size-4" />
            <span>Add Bookmark</span>
          </DropdownMenuItem>

          <DropdownMenuItem onAction={() => {}}>
            <IconUsers className="size-4" />
            <span>Friends</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Action Group 2: Utilities & Settings */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onAction={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <IconPalette className="size-4" />
            <span>Appearance</span>
            <span className="ms-auto text-[10px] text-muted-foreground capitalize">
              {theme || "dark"}
            </span>
          </DropdownMenuItem>

          {onOpenSettings && (
            <DropdownMenuItem onAction={onOpenSettings}>
              <IconSettings className="size-4" />
              <span>Navigation Settings</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onAction={() => {}}>
            <IconShieldCheck className="size-4 text-emerald-400" />
            <span>RBAC Security</span>
            <Badge className="ms-auto h-4 px-1.5 border text-[8px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Active
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Sign In / Sign Out */}
        {session ? (
          <DropdownMenuItem
            variant="destructive"
            onAction={() => signOut({ redirect: false })}
          >
            <IconLogout className="size-4 text-red-400" />
            <span className="font-bold text-red-400">Log Out</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onAction={() => signIn()}>
            <IconLogin className="size-4 text-primary" />
            <span className="font-bold text-primary">Log In</span>
          </DropdownMenuItem>
        )}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
