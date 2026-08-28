"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@workspace/ui/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import { formatBadgeNumber } from "@/lib/numbers";
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  DockItemData,
} from "@/types/sidebar-config";
import { IconLayoutGrid, IconX } from "@tabler/icons-react";
import { IrisMobileLauncher } from "./iris-mobile-launcher";

export interface IrisBottomDockProps {
  pathname: string;
  navConfig?: SidebarConfig;
  setOpenMobile?: (open: boolean) => void;
  onOpenSettings?: () => void;
  items?: DockItemData[];
  className?: string;
  /** Whether the dock is being rendered in preview mode */
  isPreview?: boolean;
  /** Currently focused position slot (1-4) in preview mode */
  focusedSlot?: string | null;
  /** Callback when a position slot is focused */
  onFocusSlot?: (pos: string) => void;
  /** Callback when a position slot is cleared */
  onClearSlot?: (pos: string) => void;
  /** Lookup function for item metadata in preview mode */
  findItemByKey?: (key: string | null | undefined) => SidebarItem | undefined;
  /** Temporary position slots mapping in preview mode */
  tempPositions?: Record<string, string | null>;
  /** Optional label for empty slots */
  emptySlotLabel?: string;
}

export function IrisBottomDock({
  pathname,
  navConfig,
  setOpenMobile,
  onOpenSettings,
  items: customItems,
  className,
  isPreview = false,
  focusedSlot,
  onFocusSlot,
  onClearSlot,
  findItemByKey,
  tempPositions,
  emptySlotLabel,
}: IrisBottomDockProps): React.JSX.Element | null {
  const t = useTranslations("navigation.dock");
  const [launcherOpen, setLauncherOpen] = useState(false);
  const resolvedEmptyLabel = emptySlotLabel || t("empty");
  // If custom items are provided, render custom scrolling dock
  if (customItems) {
    return (
      <IrisCustomBottomDock
        customItems={customItems}
        pathname={pathname}
        className={className}
      />
    );
  }

  // Preview mode (interactive slot selection inside settings modal)
  if (isPreview) {
    const renderPreviewSlot = (pos: string) => {
      const href = tempPositions ? tempPositions[pos] : undefined;
      const item = findItemByKey ? findItemByKey(href) : undefined;
      const isFocused = focusedSlot === pos;
      const isAssigned = !!item;

      return (
        <div
          key={pos}
          className="relative group/slot flex flex-col items-center flex-1 min-w-0 max-w-16"
        >
          <button
            type="button"
            onClick={() => onFocusSlot?.(pos)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-xl transition-all duration-200 w-full min-h-12 cursor-pointer outline-none select-none",
              isFocused
                ? "bg-primary/15 border border-primary text-foreground font-semibold shadow-xs z-10"
                : isAssigned
                  ? "border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  : "border border-dashed border-border/80 text-muted-foreground/60 hover:bg-muted/30 hover:border-border"
            )}
          >
            {isAssigned ? (
              <>
                <span className="relative z-10 [&>svg]:size-5">
                  {item.icon}
                </span>
                <span className="text-[10px] leading-tight font-medium relative z-10 whitespace-nowrap truncate max-w-full px-0.5 text-center">
                  {item.label}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-bold opacity-60">+{pos}</span>
                <span className="text-[9px] opacity-50 font-medium">
                  {resolvedEmptyLabel}
                </span>
              </>
            )}
          </button>

          {isAssigned && onClearSlot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearSlot(pos);
              }}
              className={cn(
                "absolute -top-1 -right-1 size-4 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center shadow-xs transition-all duration-150 cursor-pointer z-20",
                isFocused
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75 group-hover/slot:opacity-100 group-hover/slot:scale-100"
              )}
              aria-label={t("clearPosition", { pos })}
            >
              <IconX className="size-2.5 stroke-[3]" />
            </button>
          )}
        </div>
      );
    };

    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative flex items-center justify-between gap-1 sm:gap-2 px-3 py-2 bg-background/90 backdrop-blur-md border border-border shadow-lg w-full max-w-md select-none rounded-full pointer-events-auto",
          className
        )}
      >
        <div className="flex items-center gap-1 flex-1 justify-around min-w-0">
          {renderPreviewSlot("1")}
          {renderPreviewSlot("2")}
        </div>

        <div
          className="flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground shadow-xs shrink-0 mx-1"
          aria-label={t("toggleDrawer")}
        >
          <IconLayoutGrid className="size-5" />
        </div>

        <div className="flex items-center gap-1 flex-1 justify-around min-w-0">
          {renderPreviewSlot("3")}
          {renderPreviewSlot("4")}
        </div>
      </div>
    );
  }

  // Standalone Mobile Bottom Dock
  if (!navConfig || navConfig.length === 0) return null;

  // Look for mobile dock section starting with #$ (e.g. #$Phone)
  const phoneSection = navConfig.find((s) => {
    const sec = s.section?.toLowerCase() || "";
    const dk = s.dataKey?.toLowerCase() || "";
    return (
      sec.startsWith("#$") ||
      sec === "phone" ||
      sec === "#$phone" ||
      dk.startsWith("#$") ||
      dk === "phone" ||
      dk === "mobile-dock"
    );
  });

  const rawItems = phoneSection?.items ?? [];

  // Check localStorage for customized dock slots
  let customMap: Record<string, string | null> | null = null;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("iris-phone-dock-items-default");
      if (stored) customMap = JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  // Lookup helper across all config sections
  const lookupItem = (key: string | null | undefined): SidebarItem | undefined => {
    if (!key) return undefined;
    for (const sec of navConfig) {
      for (const it of sec.items) {
        const itemKey = it.href || (it.component ? `label:${it.label}` : undefined);
        if (itemKey === key) return it;
        if (it.children) {
          for (const ch of it.children) {
            const childKey = ch.href || (ch.component ? `label:${ch.label}` : undefined);
            if (childKey === key) return ch as SidebarItem;
          }
        }
      }
    }
    return undefined;
  };

  const item1 = customMap?.["1"]
    ? lookupItem(customMap["1"])
    : (rawItems.find((i) => i.position === 1) || rawItems[0]);

  const item2 = customMap?.["2"]
    ? lookupItem(customMap["2"])
    : (rawItems.find((i) => i.position === 2) || rawItems[1]);

  const item3 = customMap?.["3"]
    ? lookupItem(customMap["3"])
    : (rawItems.find((i) => i.position === 3) || rawItems[2]);

  const item4 = customMap?.["4"]
    ? lookupItem(customMap["4"])
    : (rawItems.find((i) => i.position === 4) || rawItems[3]);

  if (!item1 && !item2 && !item3 && !item4 && rawItems.length === 0) {
    return null;
  }

  const checkActive = (item: SidebarItem) => {
    const isChildActive =
      item.children &&
      item.children.some((child) => pathname === child.href);
    return (item.href && pathname === item.href) || !!isChildActive;
  };

  const mapItem = (item?: SidebarItem) => {
    if (!item)
      return <div className="flex-1 min-w-0 max-w-16 min-h-11" />;
    return (
      <div className="flex-1 min-w-0 max-w-16 flex justify-center">
        <IrisDockItem
          key={item.href || item.label}
          item={{
            label: item.label,
            icon: item.icon,
            href: item.href,
            isActive: checkActive(item),
            component: item.component,
            children: item.children,
            onClick: item.onClick,
          }}
          pathname={pathname}
        />
      </div>
    );
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-1 sm:gap-2 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border shadow-xl w-[calc(100%-1.5rem)] max-w-md md:hidden select-none rounded-full",
        className
      )}
    >
      {/* Left items (1 and 2) */}
      <div className="flex items-center gap-1 flex-1 justify-around min-w-0">
        {mapItem(item1)}
        {mapItem(item2)}
      </div>

      {/* Middle Mobile Launcher Button */}
      <button
        type="button"
        onClick={() => setLauncherOpen(true)}
        className="flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground shadow-xs cursor-pointer shrink-0 mx-1 transition-transform active:scale-95 hover:opacity-90"
        aria-label={t("toggleLauncher")}
      >
        <IconLayoutGrid className="size-5" />
      </button>

      {/* Right items (3 and 4) */}
      <div className="flex items-center gap-1 flex-1 justify-around min-w-0">
        {mapItem(item3)}
        {mapItem(item4)}
      </div>

      {/* Dedicated Mobile Launcher Bottom Sheet */}
      <IrisMobileLauncher
        open={launcherOpen}
        onOpenChange={setLauncherOpen}
        navConfig={navConfig}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

function IrisDockItem({
  item,
  pathname,
}: {
  item: DockItemData;
  pathname?: string;
}): React.JSX.Element {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const cleanupContextMenuRef = useRef<(() => void) | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking or tapping anywhere outside
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutside, { capture: true });
    document.addEventListener("touchstart", handleOutside, { capture: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutside, { capture: true });
      document.removeEventListener("touchstart", handleOutside, { capture: true });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    if ("button" in e && e.button !== 0) return;
    if (!item.children || item.children.length === 0) return;

    if (cleanupContextMenuRef.current) {
      cleanupContextMenuRef.current();
    }

    isLongPressRef.current = false;

    const blockContextMenu = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("contextmenu", blockContextMenu, { capture: true });

    const cleanup = () => {
      setTimeout(() => {
        window.removeEventListener("contextmenu", blockContextMenu, {
          capture: true,
        });
      }, 500);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("touchend", cleanup);
      window.removeEventListener("touchcancel", cleanup);
      cleanupContextMenuRef.current = null;
    };

    cleanupContextMenuRef.current = cleanup;

    window.addEventListener("mouseup", cleanup);
    window.addEventListener("touchend", cleanup);
    window.addEventListener("touchcancel", cleanup);

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setDropdownOpen(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
    }, 250);
  };

  const endPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        isLongPressRef.current = false;
      }, 100);
    }
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (cleanupContextMenuRef.current) {
      cleanupContextMenuRef.current();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (item.onClick) {
      e.preventDefault();
      item.onClick();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const buttonClass = cn(
    "relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-full transition-colors duration-150 w-full min-h-11 cursor-pointer pointer-events-auto select-none",
    item.isActive
      ? "text-primary font-semibold"
      : "text-muted-foreground hover:text-foreground"
  );

  const content = (
    <>
      {item.isActive && (
        <span
          className="absolute inset-0 bg-primary/10 rounded-full border border-primary/20 pointer-events-none"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "relative z-10 transition-transform duration-150 [&>svg]:size-5",
          item.isActive && "scale-105"
        )}
      >
        {item.icon}
      </span>
      <span className="text-[10px] leading-tight font-medium relative z-10 whitespace-nowrap truncate max-w-full px-0.5 text-center">
        {item.label}
      </span>
    </>
  );

  // If item has sub-items (children), handle both tap navigation and long-press dropdown
  if (item.children && item.children.length > 0) {
    return (
      <div ref={menuRef} className="relative flex flex-col items-center w-full">
        {item.href ? (
          <Link
            href={item.href}
            className={buttonClass}
            style={{ WebkitTouchCallout: "none" }}
            onClick={handleClick}
            onMouseDown={startPress}
            onTouchStart={startPress}
            onMouseUp={endPress}
            onTouchEnd={endPress}
            onMouseLeave={cancelPress}
            onTouchMove={cancelPress}
            onTouchCancel={cancelPress}
            onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
          >
            {content}
          </Link>
        ) : (
          <button
            type="button"
            className={buttonClass}
            style={{ WebkitTouchCallout: "none" }}
            onClick={handleClick}
            onMouseDown={startPress}
            onTouchStart={startPress}
            onMouseUp={endPress}
            onTouchEnd={endPress}
            onMouseLeave={cancelPress}
            onTouchMove={cancelPress}
            onTouchCancel={cancelPress}
            onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
          >
            {content}
          </button>
        )}

        {/* Long-press floating sub-items menu */}
        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs md:hidden"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setDropdownOpen(false);
              }}
            />
            <div
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 min-w-44 max-w-56 p-1.5 bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-150 select-none flex flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {item.children.map((child) => {
                const isChildActive = pathname === child.href;
                return child.component ? (
                  <div
                    key={child.label}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {child.component}
                  </div>
                ) : (
                  <Link
                    key={child.label}
                    href={child.href || "#"}
                    onClick={() => setDropdownOpen(false)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-150",
                      isChildActive
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-foreground/90 hover:text-foreground hover:bg-muted/70 active:bg-muted"
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      {child.icon && (
                        <span className="[&>svg]:size-4.5 shrink-0 text-foreground">
                          {child.icon}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium">{child.label}</span>
                    </span>
                    {child.badge && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1.5 ml-auto shrink-0"
                      >
                        {formatBadgeNumber(Number(child.badge) || 0, 2)}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  if (item.component) {
    return <>{item.component}</>;
  }

  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className={buttonClass}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href || "#"} className={buttonClass}>
      {content}
    </Link>
  );
}

function IrisCustomBottomDock({
  customItems,
  pathname,
  className,
}: {
  customItems: DockItemData[];
  pathname: string;
  className?: string;
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background/90 backdrop-blur-md border border-border shadow-xl w-[calc(100%-1.5rem)] max-w-md select-none rounded-full overflow-hidden pointer-events-auto",
        className
      )}
    >
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-center overflow-x-auto no-scrollbar px-2 py-1.5 snap-x snap-mandatory w-full touch-pan-x"
      >
        {customItems.map((item) => (
          <div
            key={item.label}
            className="flex-[0_0_20%] shrink-0 snap-center flex justify-center"
          >
            <IrisDockItem item={item} pathname={pathname} />
          </div>
        ))}
      </div>
    </div>
  );
}
