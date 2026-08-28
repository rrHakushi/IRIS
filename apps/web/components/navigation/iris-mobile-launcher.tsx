"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { cn } from "@workspace/ui/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import {
  IconApps,
  IconChevronDown,
  IconX,
} from "@tabler/icons-react";
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  SidebarSection,
} from "@/types/sidebar-config";
import { useIrisApps, type IrisApp } from "@/config/irisApps";
import { formatBadgeNumber } from "@/lib/numbers";
import { useUser } from "@/context/user-context";
import { IrisSidebarUserCard } from "./iris-sidebar-user-card";
import { IrisUserMenu } from "./iris-user-menu";

export interface IrisMobileLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navConfig?: SidebarConfig;
  onOpenSettings?: () => void;
}

export function IrisMobileLauncher({
  open,
  onOpenChange,
  navConfig = [],
  onOpenSettings,
}: IrisMobileLauncherProps): React.JSX.Element {
  const t = useTranslations("navigation.mobileLauncher");
  const irisApps = useIrisApps();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { data: session } = useSession();
  const { user } = useUser();

  // Track expanded state for sections (open by default)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Overview: true,
    Collections: true,
    Storage: true,
    "Plan & Status": true,
    Administration: true,
  });

  // Track expanded state for items with children (CLOSED by default like sidebar)
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleSection = (secName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [secName]: !prev[secName],
    }));
  };

  const toggleItem = (itemKey: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  const displayName = user?.displayName || user?.username || "IRIS Operator";
  const userEmail = user?.email || "operator@iris.local";
  const username = user?.username || "operator";

  // Filter out mobile dock sections (#$Phone) from launcher sections
  const launcherSections = navConfig.filter((sec) => {
    const name = sec.section?.toLowerCase() || "";
    return !name.startsWith("#$") && sec.dataKey?.toLowerCase() !== "mobile-dock";
  });

  const handleNavigate = (href?: string) => {
    if (href) {
      onOpenChange(false);
      router.push(href);
    }
  };

  return (
    <Sheet
      isOpen={open}
      onOpenChange={onOpenChange}
      side="bottom"
      showCloseButton={false}
      className="rounded-t-[2rem] max-h-[60vh] overflow-hidden p-0 bg-background/95 backdrop-blur-2xl border-t border-border/80 shadow-2xl flex flex-col z-50 md:hidden"
    >
      {/* Top Grab Handle */}
      <div className="pt-3 pb-2 flex justify-center shrink-0">
        <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
      </div>

      <SheetHeader className="sr-only">
        <SheetTitle>{t("title")}</SheetTitle>
      </SheetHeader>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4 no-scrollbar">
        {/* App Switcher Slideable Row (Max 2 visible at a time, horizontally scrollable) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            <span>{t("applications")}</span>
          </div>

          <div className="w-full flex items-center gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5 no-scrollbar touch-pan-x scroll-smooth">
            {irisApps.map((app: IrisApp) => {
              const isAppActive =
                app.href !== "/" ? pathname.startsWith(app.href) : pathname === "/";

              return (
                <button
                  key={app.name}
                  type="button"
                  onClick={() => handleNavigate(app.href)}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-2xl border text-start transition-all cursor-pointer select-none relative overflow-hidden shrink-0 snap-start w-[calc(50%-0.25rem)]",
                    isAppActive
                      ? "bg-primary/10 border-primary/40 shadow-xs"
                      : "bg-card/70 border-border/60 hover:bg-card hover:border-border active:bg-muted"
                  )}
                >
                  <div
                    className="size-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs [&>svg]:size-4.5 text-white"
                    style={{ backgroundColor: app.color }}
                  >
                    {app.icon}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground truncate">
                      {app.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {app.descriptionShort}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Categorized Navigation Sections & Components */}
        {launcherSections.map((section: SidebarSection, sIdx: number) => {
          const secKey = section.section || `sec-${sIdx}`;
          const isExpanded = expandedSections[secKey] ?? true;
          if (!section.items || section.items.length === 0) return null;

          return (
            <section key={sIdx} className="space-y-1.5">
              {section.section && (
                <button
                  type="button"
                  onClick={() => toggleSection(secKey)}
                  className="flex items-center justify-between w-full text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 py-0.5 cursor-pointer"
                >
                  <span>{section.section}</span>
                  <IconChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                </button>
              )}

              {isExpanded && (
                <div className="bg-card/50 border border-border/50 rounded-2xl p-1.5 space-y-1">
                  {section.items.map((item: SidebarItem, iIdx: number) => {
                    const itemKey = item.dataKey || item.label || `item-${iIdx}`;
                    const hasChildren = !!(item.children && item.children.length > 0);
                    const isChildActive =
                      hasChildren &&
                      item.children!.some((child) => pathname === child.href);
                    const isActive = (item.href && pathname === item.href) || isChildActive;

                    // Closed by default like sidebar unless active child or explicitly opened
                    const isOpen = openItems[itemKey] !== undefined ? openItems[itemKey] : isChildActive;

                    // Render custom embedded component if present (e.g. StorageQuotaWidget, ProBannerWidget)
                    if (item.component) {
                      return (
                        <div key={iIdx} className="w-full">
                          {item.component}
                        </div>
                      );
                    }

                    // Render collapsible item with children (closed by default)
                    if (hasChildren) {
                      return (
                        <div key={iIdx} className="flex flex-col w-full">
                          <div className="flex items-center justify-between w-full">
                            {item.href ? (
                              <button
                                type="button"
                                onClick={() => handleNavigate(item.href)}
                                className={cn(
                                  "flex items-center justify-between flex-1 min-w-0 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-start",
                                  isActive
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {item.icon && (
                                    <span className="[&>svg]:size-4 shrink-0 text-foreground">
                                      {item.icon}
                                    </span>
                                  )}
                                  <span className="truncate text-sm font-medium">{item.label}</span>
                                </span>
                                {item.badge && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] h-4 px-1.5 shrink-0 me-1"
                                  >
                                    {formatBadgeNumber(Number(item.badge) || 0, 2)}
                                  </Badge>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleItem(itemKey)}
                                className={cn(
                                  "flex items-center justify-between flex-1 min-w-0 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-start",
                                  isActive
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {item.icon && (
                                    <span className="[&>svg]:size-4 shrink-0 text-foreground">
                                      {item.icon}
                                    </span>
                                  )}
                                  <span className="truncate text-sm font-medium">{item.label}</span>
                                </span>
                                {item.badge && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] h-4 px-1.5 shrink-0 me-1"
                                  >
                                    {formatBadgeNumber(Number(item.badge) || 0, 2)}
                                  </Badge>
                                )}
                              </button>
                            )}

                            {/* Dedicated Chevron button to expand/collapse submenu */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleItem(itemKey);
                              }}
                              className="size-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer shrink-0 ms-1"
                              aria-label={isOpen ? t("collapse") : t("expand")}
                            >
                              <IconChevronDown
                                className={cn(
                                  "size-4 transition-transform duration-200",
                                  isOpen && "rotate-180"
                                )}
                              />
                            </button>
                          </div>

                          {/* Submenu children: closed by default */}
                          {isOpen && (
                            <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-border/50 ml-5 my-1">
                              {item.children!.map((child: SidebarItemChild, cIdx: number) => {
                                const isSubActive = pathname === child.href;

                                if (child.component) {
                                  return (
                                    <div key={cIdx} className="w-full">
                                      {child.component}
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    key={cIdx}
                                    type="button"
                                    onClick={() => handleNavigate(child.href)}
                                    className={cn(
                                      "flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-start",
                                      isSubActive
                                        ? "bg-primary/15 text-primary font-semibold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                  >
                                    <span className="flex items-center gap-2 min-w-0 flex-1">
                                      {child.icon && (
                                        <span className="[&>svg]:size-3.5 shrink-0">
                                          {child.icon}
                                        </span>
                                      )}
                                      <span className="truncate">{child.label}</span>
                                    </span>
                                    {child.badge && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] h-4 px-1.5 ml-auto shrink-0"
                                      >
                                        {formatBadgeNumber(Number(child.badge) || 0, 2)}
                                      </Badge>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Regular single item
                    return (
                      <button
                        key={iIdx}
                        type="button"
                        onClick={() => handleNavigate(item.href)}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-start",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted/60"
                        )}
                      >
                        <span className="flex items-center gap-2.5 min-w-0 flex-1">
                          {item.icon && (
                            <span className="[&>svg]:size-4 shrink-0 text-foreground">
                              {item.icon}
                            </span>
                          )}
                          <span className="truncate text-sm font-medium">{item.label}</span>
                        </span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 px-1.5 ml-auto shrink-0"
                          >
                            {formatBadgeNumber(Number(item.badge) || 0, 2)}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Account & User Menu at the Bottom */}
      <div className="px-5 pb-5 pt-2 bg-transparent shrink-0">
        <IrisUserMenu onOpenSettings={onOpenSettings} placement="top" />
      </div>
    </Sheet>
  );
}
