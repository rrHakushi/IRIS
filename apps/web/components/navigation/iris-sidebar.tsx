"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasPermission } from "@IRIS/permissions";
import { cn } from "@workspace/ui/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { Badge } from "@workspace/ui/components/badge";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconSettings,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  SidebarSection,
} from "@/types/sidebar-config";
import { useIrisSidebar } from "./sidebar-provider";
import { IrisBottomDock } from "./iris-bottom-dock";
import { IrisAppMenu } from "./iris-app-menu";
import { IrisUserMenu } from "./iris-user-menu";

export interface IrisSidebarProps
  extends Omit<React.ComponentProps<typeof Sidebar>, "children"> {
  initialConfig?: SidebarConfig;
  onOpenSettings?: () => void;
}

export function IrisSidebar({
  initialConfig,
  onOpenSettings,
  className,
  variant = "inset",
  ...props
}: IrisSidebarProps): React.JSX.Element {
  const { data: session } = useSession();
  const pathname = usePathname() || "/";
  const { isMobile, setOpenMobile } = useSidebar();
  const { sidebarConfig, position, setPosition } =
    useIrisSidebar(initialConfig);

  // Track expanded state of menu items with submenus
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter and sort items based on permissions and position
  const userPermissions = (session?.user as any)?.permissions ?? null;

  const resolvedConfig = useMemo(() => {
    return sidebarConfig
      .filter((section: SidebarSection) => {
        const secLower = section.section?.toLowerCase().replace(/[^a-z]/g, "");
        if (secLower === "phone") return false;
        if (section.permissions && !hasPermission(userPermissions, section.permissions, "any")) {
          return false;
        }
        return true;
      })
      .map((section: SidebarSection) => {
        const filteredItems = section.items
          .filter((item: SidebarItem) => {
            if (item.permissions && !hasPermission(userPermissions, item.permissions, "any")) {
              return false;
            }
            return true;
          })
          .map((item: SidebarItem) => {
            if (!item.children) return item;
            const filteredChildren = item.children.filter((child: SidebarItemChild) => {
              if (child.permissions && !hasPermission(userPermissions, child.permissions, "any")) {
                return false;
              }
              return true;
            });
            return { ...item, children: filteredChildren };
          });

        // Sort positive at top, undefined in middle, negative in footer
        const indexed = filteredItems.map((item, idx) => ({ item, idx }));
        indexed.sort((a, b) => {
          const posA = a.item.position !== undefined ? a.item.position : 0;
          const posB = b.item.position !== undefined ? b.item.position : 0;
          if (posA > 0 && posB > 0) return posA - posB || a.idx - b.idx;
          if (posA > 0) return -1;
          if (posB > 0) return 1;
          if (posA < 0 && posB < 0) return posA - posB || a.idx - b.idx;
          if (posA < 0) return 1;
          if (posB < 0) return -1;
          return a.idx - b.idx;
        });

        return {
          ...section,
          items: indexed.map((x) => x.item),
        };
      });
  }, [sidebarConfig, userPermissions]);

  const isRight = position === "right";

  return (
    <>
      <Sidebar
        side={isRight ? "right" : "left"}
        variant={variant}
        className={cn(className)}
        {...props}
      >
        {/* Header: App Context Switcher & Bookmarks Dropdown */}
        <SidebarHeader className="p-2 border-b border-sidebar-border/60">
          <IrisAppMenu />
        </SidebarHeader>

        {/* Content: Categorized Menu Sections */}
        <SidebarContent className="no-scrollbar">
          {resolvedConfig.map((section: SidebarSection, sectionIdx: number) => {
            const visibleItems = section.items.filter(
              (item: SidebarItem) => (item.position ?? 0) >= 0
            );
            if (visibleItems.length === 0) return null;

            return (
              <SidebarGroup key={sectionIdx}>
                {section.section && (
                  <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3 py-1">
                    {section.section}
                  </SidebarGroupLabel>
                )}

                <SidebarMenu>
                  {visibleItems.map((item: SidebarItem, itemIdx: number) => {
                    const itemKey = item.dataKey || item.label;
                    const hasChildren = !!(item.children && item.children.length > 0);
                    const isChildActive =
                      hasChildren &&
                      item.children!.some(
                        (child: SidebarItemChild) => pathname === child.href
                      );
                    const isActive =
                      (item.href && pathname === item.href) || isChildActive;

                    const isOpen =
                      openItems[itemKey] !== undefined
                        ? openItems[itemKey]
                        : isChildActive;

                    if (item.component) {
                      return (
                        <SidebarMenuItem key={itemIdx}>
                          {item.component}
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <SidebarMenuItem key={itemIdx}>
                        {hasChildren ? (
                          <div className="flex flex-col w-full">
                            <SidebarMenuButton
                              isActive={isActive}
                              tooltip={item.label}
                              className={cn(
                                "justify-between",
                                isActive && "font-semibold"
                              )}
                              onPress={() => toggleItem(itemKey)}
                            >
                              <span className="flex items-center gap-2.5 min-w-0">
                                {item.icon}
                                <span className="truncate">{item.label}</span>
                              </span>
                              <span className="flex items-center gap-1.5 ms-auto">
                                {item.badge && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] h-4 px-1.5"
                                  >
                                    {item.badge}
                                  </Badge>
                                )}
                                <IconChevronDown
                                  className={cn(
                                    "size-3.5 text-muted-foreground transition-transform duration-200",
                                    isOpen && "rotate-180"
                                  )}
                                />
                              </span>
                            </SidebarMenuButton>

                            {isOpen && (
                              <SidebarMenuSub className="mt-1">
                                {item.children!.map(
                                  (
                                    child: SidebarItemChild,
                                    childIdx: number
                                  ) => {
                                    const isSubActive = pathname === child.href;
                                    return (
                                      <SidebarMenuSubItem key={childIdx}>
                                        {child.component ? (
                                          child.component
                                        ) : (
                                          <SidebarMenuSubButton
                                            href={child.href || "#"}
                                            isActive={isSubActive}
                                            className={cn(
                                              "justify-between",
                                              isSubActive &&
                                                "font-semibold text-primary"
                                            )}
                                          >
                                            <span className="flex items-center gap-2 min-w-0">
                                              {child.icon}
                                              <span className="truncate">
                                                {child.label}
                                              </span>
                                            </span>
                                            {child.badge && (
                                              <Badge
                                                variant="secondary"
                                                className="text-[10px] h-4 px-1.5"
                                              >
                                                {child.badge}
                                              </Badge>
                                            )}
                                          </SidebarMenuSubButton>
                                        )}
                                      </SidebarMenuSubItem>
                                    );
                                  }
                                )}
                              </SidebarMenuSub>
                            )}
                          </div>
                        ) : (
                          <SidebarMenuButton
                            href={item.href || "#"}
                            isActive={isActive}
                            tooltip={item.label}
                            className={cn(
                              "justify-between",
                              isActive && "font-semibold text-primary"
                            )}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              {item.icon}
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.badge && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1.5"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        {/* Footer: User profile & Settings launcher */}
        <SidebarFooter className="p-2 border-t border-sidebar-border/60">
          {resolvedConfig
            .flatMap((s) => s.items)
            .filter((item) => (item.position ?? 0) < 0)
            .map((item, idx) => (
              <div key={idx} className="w-full">
                {item.component}
              </div>
            ))}

          <IrisUserMenu onOpenSettings={onOpenSettings} />
        </SidebarFooter>
      </Sidebar>

      {/* Mobile Bottom Dock (rendered only when on mobile viewport) */}
      {isMobile && (
        <IrisBottomDock
          pathname={pathname}
          navConfig={sidebarConfig}
          setOpenMobile={setOpenMobile}
        />
      )}
    </>
  );
}
