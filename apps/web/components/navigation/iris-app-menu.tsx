"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  IconSparkles,
  IconSelector,
  IconBookmark,
  IconCheck,
  IconPencil,
  IconX,
  IconTrash,
  IconKey,
  IconDatabase,
  IconPuzzle,
  IconChartBar,
} from "@tabler/icons-react";
import { useIrisSidebar } from "./sidebar-provider";

export interface IrisAppItem {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  color?: string;
}

export const defaultIrisApps: IrisAppItem[] = [
  {
    id: "portal",
    name: "IRIS Ecosystem",
    description: "Central command & portal",
    href: "/",
    icon: <IconSparkles className="size-4 text-primary" />,
  },
  {
    id: "auth",
    name: "Authentication",
    description: "OAuth, WebAuthn & passkeys",
    href: "/auth/login",
    icon: <IconKey className="size-4 text-amber-500" />,
  },
  {
    id: "database",
    name: "Database Studio",
    description: "Prisma & PostgreSQL schema",
    href: "/database",
    icon: <IconDatabase className="size-4 text-cyan-500" />,
  },
  {
    id: "analytics",
    name: "Analytics & Pulse",
    description: "Realtime metrics & telemetry",
    href: "/analytics",
    icon: <IconChartBar className="size-4 text-emerald-500" />,
    badge: "Live",
  },
  {
    id: "integrations",
    name: "Integrations",
    description: "Elysia plugins & webhooks",
    href: "/integrations",
    icon: <IconPuzzle className="size-4 text-purple-500" />,
  },
];

export interface BookmarkItem {
  id: string;
  title: string;
  href: string;
}

export function IrisAppMenu(): React.JSX.Element {
  const pathname = usePathname() || "/";
  const { position } = useIrisSidebar();
  const isRight = position === "right";

  const [isEditing, setIsEditing] = useState(false);
  const [apps, setApps] = useState<IrisAppItem[]>(defaultIrisApps);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([
    { id: "1", title: "API Gateway Documentation", href: "/docs" },
    { id: "2", title: "Audit Trail", href: "/admin/audit" },
  ]);

  const initialBookmarksRef = useRef<BookmarkItem[]>([]);

  // Active app determination
  const activeApp = useMemo(() => {
    return (
      apps.find((app) => app.href !== "/" && pathname.startsWith(app.href)) ||
      apps[0] ||
      defaultIrisApps[0]
    );
  }, [apps, pathname]);

  // Load custom bookmarks
  useEffect(() => {
    try {
      const stored = localStorage.getItem("iris_bookmarks");
      if (stored) {
        setBookmarks(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const startEditing = () => {
    initialBookmarksRef.current = [...bookmarks];
    setIsEditing(true);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBookmarks(initialBookmarksRef.current);
    setIsEditing(false);
  };

  const finishEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem("iris_bookmarks", JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
    setIsEditing(false);
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
  };

  return (
    <DropdownMenuTrigger>
      {/* App Trigger Button */}
      <Button
        variant="ghost"
        className="flex w-full items-center justify-between gap-2.5 h-12 p-2 rounded-xl border border-border/40 hover:border-border/80 hover:bg-muted/50 transition-all text-start cursor-pointer group data-[state=open]:bg-muted/80 data-[state=open]:border-border"
      >
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
          {activeApp?.icon || <IconSparkles className="size-4" />}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-bold leading-tight truncate text-foreground group-hover:text-primary transition-colors">
            {activeApp?.name || "IRIS"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate leading-tight font-normal">
            {activeApp?.description || "Ecosystem"}
          </span>
        </div>
        <IconSelector className="size-4 text-muted-foreground shrink-0 ms-auto opacity-70 group-hover:opacity-100" />
      </Button>

      {/* Dropdown Menu Content */}
      <DropdownMenu
        placement={isRight ? "left top" : "right top"}
        offset={6}
        className="w-(--trigger-width) min-w-64 rounded-2xl p-1.5"
      >
        {/* Menu Header with Edit Controls */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isEditing ? "Reorganize Menu" : "Applications"}
          </span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cancelEditing}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                <IconX className="size-3" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={finishEditing}
                className="flex items-center gap-1 text-[11px] text-emerald-500 hover:text-emerald-400 px-2 py-0.5 rounded-md hover:bg-emerald-500/10 transition-colors font-semibold cursor-pointer"
              >
                <IconCheck className="size-3.5" />
                <span>Done</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startEditing();
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <IconPencil className="size-3" />
              <span>Edit</span>
            </button>
          )}
        </div>

        {/* Applications List */}
        <DropdownMenuGroup>
          {apps.map((app) => {
            const isActive = activeApp?.id === app.id;
            return (
              <DropdownMenuItem
                key={app.id}
                href={isEditing ? undefined : app.href}
                className="gap-2.5 p-2 rounded-xl cursor-pointer"
              >
                <div className="size-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {app.icon}
                </div>
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span
                    className="truncate font-semibold text-xs"
                    style={{ color: app.color }}
                  >
                    {app.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ms-2">
                    {app.description}
                  </span>
                </div>
                {app.badge && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] h-4 px-1.5 shrink-0"
                  >
                    {app.badge}
                  </Badge>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {/* Bookmarks Section */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Bookmarks</DropdownMenuLabel>

        {bookmarks.length === 0 ? (
          <div className="text-center py-3 text-[11px] text-muted-foreground/60 border border-dashed border-border/60 rounded-xl m-1">
            No saved bookmarks
          </div>
        ) : (
          <DropdownMenuGroup>
            {bookmarks.map((bm) => (
              <DropdownMenuItem
                key={bm.id}
                href={isEditing ? undefined : bm.href}
                className="gap-2.5 p-2 rounded-xl justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <IconBookmark className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs">{bm.title}</span>
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteBookmark(bm.id, e)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                    title="Delete bookmark"
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
