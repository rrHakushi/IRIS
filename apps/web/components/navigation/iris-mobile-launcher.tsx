"use client"

import React, { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Sheet, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { IconChevronDown } from "@tabler/icons-react"
import type {
  SidebarItemChild,
  SidebarSection,
} from "@/types/sidebar-config"
import { formatBadgeNumber } from "@/lib/numbers"
import { IrisUserMenu } from "./iris-user-menu"

function normalizePath(path: string): string {
  if (!path) return "/"
  const trimmed = path.replace(/\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

function isRouteActive(currentPath: string, href?: string): boolean {
  if (!href || href === "#") return false
  const path = normalizePath(currentPath)
  const target = normalizePath(href)

  if (path === target) return true

  // Handle query parameter based routes like ?tab=xxx
  if (href.startsWith("?") || target.startsWith("?")) {
    if (typeof window !== "undefined") {
      const search = window.location.search
      return search === href || search === target
    }
  }

  // App roots and single-segment roots (e.g. "/", "/iris-list") must be exact match
  const segments = target.split("/").filter(Boolean)
  if (segments.length <= 1) return false

  return path.startsWith(`${target}/`)
}

export interface IrisMobileLauncherProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navConfig?: SidebarSection[]
  onOpenSettings?: () => void
}

export function IrisMobileLauncher({
  open,
  onOpenChange,
  navConfig = [],
  onOpenSettings,
}: IrisMobileLauncherProps): React.JSX.Element {
  const t = useTranslations("navigation.mobileLauncher")
  const pathname = usePathname() || "/"
  const router = useRouter()

  // Track expanded state for sections (open by default)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    Overview: true,
    Collections: true,
    Storage: true,
    "Plan & Status": true,
    Administration: true,
  })

  // Track expanded state for items with children (CLOSED by default like sidebar)
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const toggleSection = (secName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [secName]: !prev[secName],
    }))
  }

  const toggleItem = (itemKey: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }))
  }

  // Filter out mobile dock sections (#$Phone) from launcher sections
  const launcherSections = navConfig.filter((sec) => {
    const name = sec.section?.toLowerCase() || ""
    return (
      !name.startsWith("#$") && sec.dataKey?.toLowerCase() !== "mobile-dock"
    )
  })

  // Ensure parent items of active children are opened on route change
  useEffect(() => {
    launcherSections.forEach((section) => {
      section.items.forEach((item, iIdx) => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some((child) =>
            child.isActive !== undefined
              ? child.isActive
              : isRouteActive(pathname, child.href)
          )
          if (hasActiveChild) {
            const key = item.dataKey || item.label || `item-${iIdx}`
            setOpenItems((prev) => ({ ...prev, [key]: true }))
          }
        }
      })
    })
  }, [pathname, launcherSections])

  const handleNavigate = (href?: string) => {
    if (href) {
      onOpenChange(false)
      router.push(href)
    }
  }

  return (
    <Sheet
      isOpen={open}
      onOpenChange={onOpenChange}
      side="bottom"
      showCloseButton={false}
      className="z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-t-[2rem] border-t border-border/80 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl md:hidden"
    >
      {/* Top Grab Handle */}
      <div className="flex shrink-0 justify-center pt-3 pb-2">
        <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      </div>

      <SheetHeader className="sr-only">
        <SheetTitle>{t("title")}</SheetTitle>
      </SheetHeader>

      {/* Scrollable Content */}
      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-2">
        {/* Categorized Navigation Sections & Components */}
        {launcherSections.map((section: SidebarSection, sIdx: number) => {
          const secKey = section.section || `sec-${sIdx}`
          const isExpanded = expandedSections[secKey] ?? true
          if (!section.items || section.items.length === 0) return null

          return (
            <section key={sIdx} className="space-y-1.5">
              {section.section && (
                <button
                  type="button"
                  onClick={() => toggleSection(secKey)}
                  className="flex w-full cursor-pointer items-center justify-between px-1 py-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
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
                <div className="rounded-2xl border border-border/50 bg-card/50 p-1.5 shadow-xs space-y-1">
                  {section.items.map((item, iIdx) => {
                    const itemKey = item.dataKey || item.label || `item-${iIdx}`
                    const hasChildren = !!(
                      item.children && item.children.length > 0
                    )
                    const isChildActive =
                      hasChildren &&
                      item.children!.some((child) =>
                        child.isActive !== undefined
                          ? child.isActive
                          : isRouteActive(pathname, child.href)
                      )
                    const isDirectActive =
                      item.isActive !== undefined
                        ? item.isActive
                        : isRouteActive(pathname, item.href)
                    const isActive = isDirectActive || isChildActive
                    const isOpen = openItems[itemKey] ?? false

                    if (item.component) {
                      return (
                        <div key={iIdx} className="w-full">
                          {item.component}
                        </div>
                      )
                    }

                    if (hasChildren) {
                      return (
                        <div key={iIdx} className="flex flex-col">
                          <div className="flex items-center justify-between">
                            {item.href ? (
                              <button
                                type="button"
                                onClick={() => handleNavigate(item.href)}
                                className={cn(
                                  "flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs font-medium transition-colors",
                                  isDirectActive
                                    ? "bg-primary/10 font-semibold text-primary"
                                    : isChildActive
                                      ? "font-medium text-foreground"
                                      : "text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                                  {item.icon && (
                                    <span className="shrink-0 text-foreground [&>svg]:size-4">
                                      {item.icon}
                                    </span>
                                  )}
                                  <span className="truncate text-sm font-medium">
                                    {item.label}
                                  </span>
                                </span>
                                {item.badge && (
                                  <Badge
                                    variant="secondary"
                                    className="me-1 h-4 shrink-0 px-1.5 text-[10px]"
                                  >
                                    {formatBadgeNumber(
                                      Number(item.badge) || 0,
                                      2
                                    )}
                                  </Badge>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleItem(itemKey)}
                                className={cn(
                                  "flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs font-medium transition-colors",
                                  isDirectActive
                                    ? "bg-primary/10 font-semibold text-primary"
                                    : isChildActive
                                      ? "font-medium text-foreground"
                                      : "text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                                  {item.icon && (
                                    <span className="shrink-0 text-foreground [&>svg]:size-4">
                                      {item.icon}
                                    </span>
                                  )}
                                  <span className="truncate text-sm font-medium">
                                    {item.label}
                                  </span>
                                </span>
                                {item.badge && (
                                  <Badge
                                    variant="secondary"
                                    className="me-1 h-4 shrink-0 px-1.5 text-[10px]"
                                  >
                                    {formatBadgeNumber(
                                      Number(item.badge) || 0,
                                      2
                                    )}
                                  </Badge>
                                )}
                              </button>
                            )}

                            {/* Dropdown toggle button */}
                            <button
                              type="button"
                              onClick={() => toggleItem(itemKey)}
                              className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                              aria-label={
                                isOpen ? t("collapse") : t("expand")
                              }
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
                            <div className="my-1 ms-5 space-y-0.5 border-s border-border/50 py-1 ps-4 pe-1">
                              {item.children!.map(
                                (child: SidebarItemChild, cIdx: number) => {
                                  const isSubActive =
                                    child.isActive !== undefined
                                      ? child.isActive
                                      : isRouteActive(pathname, child.href)

                                  if (child.component) {
                                    return (
                                      <div key={cIdx} className="w-full">
                                        {child.component}
                                      </div>
                                    )
                                  }

                                  return (
                                    <button
                                      key={cIdx}
                                      type="button"
                                      onClick={() =>
                                        handleNavigate(child.href)
                                      }
                                      className={cn(
                                        "flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-start text-xs font-medium transition-colors",
                                        isSubActive
                                          ? "bg-primary/15 font-semibold text-primary"
                                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                      )}
                                    >
                                      <span className="flex min-w-0 flex-1 items-center gap-2">
                                        {child.icon && (
                                          <span className="shrink-0 [&>svg]:size-3.5">
                                            {child.icon}
                                          </span>
                                        )}
                                        <span className="truncate">
                                          {child.label}
                                        </span>
                                      </span>
                                      {child.badge && (
                                        <Badge
                                          variant="secondary"
                                          className="ml-auto h-4 shrink-0 px-1.5 text-[10px]"
                                        >
                                          {formatBadgeNumber(
                                            Number(child.badge) || 0,
                                            2
                                          )}
                                        </Badge>
                                      )}
                                    </button>
                                  )
                                }
                              )}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Regular single item
                    return (
                      <button
                        key={iIdx}
                        type="button"
                        onClick={() => handleNavigate(item.href)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-foreground hover:bg-muted/60"
                        )}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          {item.icon && (
                            <span className="shrink-0 text-foreground [&>svg]:size-4">
                              {item.icon}
                            </span>
                          )}
                          <span className="truncate text-sm font-medium">
                            {item.label}
                          </span>
                        </span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-4 shrink-0 px-1.5 text-[10px]"
                          >
                            {formatBadgeNumber(Number(item.badge) || 0, 2)}
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Account & User Menu at the Bottom */}
      <div className="shrink-0 bg-transparent px-5 pt-2 pb-5">
        <IrisUserMenu
          onOpenSettings={onOpenSettings}
          placement="top"
          className="w-full max-w-none"
        />
      </div>
    </Sheet>
  )
}
