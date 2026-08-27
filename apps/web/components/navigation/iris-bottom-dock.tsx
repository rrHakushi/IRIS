"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@workspace/ui/lib/utils";
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  DockItemData,
} from "@/types/sidebar-config";
import { IconLayoutGrid, IconX } from "@tabler/icons-react";
import {
  Popover,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Button } from "@workspace/ui/components/button";

export interface IrisBottomDockProps {
  pathname: string;
  navConfig?: SidebarConfig;
  setOpenMobile?: (open: boolean) => void;
  items?: DockItemData[];
  className?: string;
  /** Whether the dock is being rendered in preview mode (e.g. inside settings modal) */
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
  items: customItems,
  className,
  isPreview = false,
  focusedSlot,
  onFocusSlot,
  onClearSlot,
  findItemByKey,
  tempPositions,
  emptySlotLabel = "Empty",
}: IrisBottomDockProps): React.JSX.Element | null {
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
                  {emptySlotLabel}
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
              aria-label={`Clear position ${pos}`}
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
          aria-label="Toggle Navigation Drawer"
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
  if (!navConfig) return null;

  const phoneSection = navConfig.find(
    (s) =>
      s.section?.toLowerCase().replace(/[^a-z]/g, "") === "phone" ||
      s.dataKey?.toLowerCase() === "phone"
  );
  if (!phoneSection || phoneSection.items.length === 0) return null;

  const items = phoneSection.items;
  const item1 = items.find((i) => i.position === 1);
  const item2 = items.find((i) => i.position === 2);
  const item3 = items.find((i) => i.position === 3);
  const item4 = items.find((i) => i.position === 4);

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

      {/* Middle Drawer Switcher Button */}
      {setOpenMobile && (
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground shadow-xs cursor-pointer shrink-0 mx-1 transition-transform active:scale-95 hover:opacity-90"
          aria-label="Toggle Navigation Drawer"
        >
          <IconLayoutGrid className="size-5" />
        </button>
      )}

      {/* Right items (3 and 4) */}
      <div className="flex items-center gap-1 flex-1 justify-around min-w-0">
        {mapItem(item3)}
        {mapItem(item4)}
      </div>
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const startPress = useCallback(() => {
    if (!item.children || item.children.length === 0) return;
    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setPopoverOpen(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
    }, 300);
  }, [item.children]);

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    if (item.onClick) {
      item.onClick();
    }
  };

  const buttonClass = cn(
    "relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-full transition-colors duration-150 w-full min-h-11 cursor-pointer pointer-events-auto",
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

  // If item has sub-items (children), wrap with Popover
  if (item.children && item.children.length > 0) {
    return (
      <PopoverTrigger>
        <button
          type="button"
          className={buttonClass}
          onClick={handleClick}
          onMouseDown={startPress}
          onTouchStart={startPress}
          onMouseUp={endPress}
          onTouchEnd={endPress}
          onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
        >
          {content}
        </button>
        <Popover
          placement="top"
          className="w-48 p-1 bg-popover/95 backdrop-blur-md border border-border shadow-lg rounded-xl"
        >
          <div className="flex flex-col gap-0.5">
            {item.children.map((child) => {
              const isChildActive = pathname === child.href;
              return child.component ? (
                <div key={child.label}>{child.component}</div>
              ) : (
                <Link
                  key={child.label}
                  href={child.href || "#"}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150",
                    isChildActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {child.icon && (
                    <span className="[&>svg]:size-4 shrink-0">
                      {child.icon}
                    </span>
                  )}
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        </Popover>
      </PopoverTrigger>
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
