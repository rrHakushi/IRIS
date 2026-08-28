"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button, LinkButton } from "@workspace/ui/components/button";
import {
  IconSelector,
  IconBookmark,
  IconCheck,
  IconPencil,
  IconPlus,
  IconX,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconSparkles,
  IconLogin,
} from "@tabler/icons-react";
import { useIrisApps, type IrisApp } from "@/config/irisApps";
import { useIrisSidebar } from "./sidebar-provider";
import { hasPermission } from "@IRIS/permissions";
import { cn } from "@workspace/ui/lib/utils";

export interface BookmarkItem {
  id: string;
  title: string;
  href: string;
}

export function IrisAppMenu(): React.JSX.Element {
  const t = useTranslations("navigation.appMenu");
  const irisApps = useIrisApps();
  const pathname = usePathname() || "/";
  const { data: session } = useSession();
  const { position } = useIrisSidebar();
  const isRight = position === "right";

  const userPermissions = (session?.user as any)?.permissions ?? null;

  const visibleApps = useMemo((): IrisApp[] => {
    return irisApps.filter((app: IrisApp): boolean => {
      if (!app.permissions) return true;
      return hasPermission(userPermissions, app.permissions, "any");
    });
  }, [irisApps, userPermissions]);

  const activeApp = useMemo(() => {
    const current = visibleApps.find((app) =>
      app.href !== "/" ? pathname.startsWith(app.href) : pathname === "/"
    );
    return current || visibleApps[0] || irisApps[0];
  }, [pathname, visibleApps, irisApps]);
  const [isEditing, setIsEditing] = useState(false);
  const [appOrder, setAppOrder] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([
    { id: "1", title: "API Gateway Documentation", href: "/docs" },
    { id: "2", title: "Audit Trail", href: "/admin/audit" },
  ]);

  const initialAppOrderRef = useRef<string[]>([]);
  const initialBookmarksRef = useRef<BookmarkItem[]>([]);

  // Load custom app order and bookmarks from localStorage
  useEffect(() => {
    try {
      const savedApps = localStorage.getItem("iris_app_order");
      if (savedApps) {
        setAppOrder(JSON.parse(savedApps));
      }
      const storedBookmarks = localStorage.getItem("iris_bookmarks");
      if (storedBookmarks) {
        setBookmarks(JSON.parse(storedBookmarks));
      }
    } catch {
      // ignore
    }
  }, []);

  // Re-ordered apps
  const sortedApps = useMemo((): IrisApp[] => {
    if (!appOrder || appOrder.length === 0) return visibleApps;
    const map = new Map(visibleApps.map((a) => [a.name, a]));
    const ordered: IrisApp[] = [];
    appOrder.forEach((name) => {
      const app = map.get(name);
      if (app) {
        ordered.push(app);
        map.delete(name);
      }
    });
    map.forEach((app) => ordered.push(app));
    return ordered;
  }, [visibleApps, appOrder]);

  const startEditing = () => {
    initialAppOrderRef.current = [...appOrder];
    initialBookmarksRef.current = [...bookmarks];
    setIsEditing(true);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAppOrder(initialAppOrderRef.current);
    setBookmarks(initialBookmarksRef.current);
    setIsEditing(false);
  };

  const finishEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem("iris_app_order", JSON.stringify(appOrder));
      localStorage.setItem("iris_bookmarks", JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
    setIsEditing(false);
  };

  const moveApp = (e: React.MouseEvent, index: number, direction: -1 | 1) => {
    e.preventDefault();
    e.stopPropagation();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedApps.length) return;
    const newApps = [...sortedApps];
    const moved = newApps[index];
    if (!moved) return;
    newApps.splice(index, 1);
    newApps.splice(targetIndex, 0, moved);
    const newOrder = newApps.map((a) => a.name);
    setAppOrder(newOrder);
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
          <span
            className="text-xs font-bold leading-tight truncate"
            style={{ color: activeApp?.color }}
          >
            {activeApp?.name || "IRIS"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate leading-tight font-normal">
            {activeApp?.descriptionShort || activeApp?.description || t("appCenter")}
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
            {isEditing ? t("reorganizeMenu") : t("applications")}
          </span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cancelEditing}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                <IconX className="size-3" />
                <span>{t("cancel")}</span>
              </button>
              <button
                type="button"
                onClick={finishEditing}
                className="flex items-center gap-1 text-[11px] text-emerald-500 hover:text-emerald-400 px-2 py-0.5 rounded-md hover:bg-emerald-500/10 transition-colors font-semibold cursor-pointer"
              >
                <IconCheck className="size-3.5" />
                <span>{t("done")}</span>
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
              <span>{t("edit")}</span>
            </button>
          )}
        </div>

        {/* Applications List */}
        <DropdownMenuGroup>
          {sortedApps.map((app, index) => {
            const isCurrent = activeApp?.name === app.name;

            return (
              <DropdownMenuItem
                key={app.name}
                href={isEditing ? undefined : app.href}
                className={cn(
                  "gap-2.5 p-2 rounded-xl cursor-pointer transition-colors",
                  isCurrent && "bg-primary/10 border border-primary/30 text-foreground font-semibold"
                )}
              >
                {isEditing && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => moveApp(e, index, -1)}
                      className="hover:bg-muted rounded p-0.5 disabled:opacity-30 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <IconChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sortedApps.length - 1}
                      onClick={(e) => moveApp(e, index, 1)}
                      className="hover:bg-muted rounded p-0.5 disabled:opacity-30 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <IconChevronDown className="size-3" />
                    </button>
                  </div>
                )}
                <div className="size-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {app.icon || <IconSparkles className="size-3.5" />}
                </div>
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span
                    className="truncate font-semibold text-xs"
                    style={{ color: app.color }}
                  >
                    {app.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ms-2">
                    {app.descriptionShort}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {/* Bookmarks Section */}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2.5 py-1.5 mt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("bookmarks")}
          </span>
          {session?.user && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label={t("addBookmark")}
              title={t("addBookmark")}
            >
              <IconPlus className="size-3.5" />
            </button>
          )}
        </div>

        {!session?.user ? (
          <LinkButton
            href="/auth/login"
            variant="ghost"
            className="w-full justify-center py-2.5 h-auto text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border/60 rounded-xl my-1 gap-1.5 cursor-pointer font-medium"
          >
            <IconLogin className="size-3.5 shrink-0" />
            <span>{t("loginToUseBookmarks")}</span>
          </LinkButton>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-3 text-[11px] text-muted-foreground/60 border border-dashed border-border/60 rounded-xl m-1">
            {t("noSavedBookmarks")}
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
                    title={t("deleteBookmark")}
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
