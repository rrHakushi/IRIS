"use client"

import * as React from "react"
import {
  IconAdjustments,
  IconArrowDown,
  IconArrowsMaximize,
  IconArrowUp,
  IconBook,
  IconChevronRight,
  IconCopy,
  IconPlus,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconTrash,
} from "@tabler/icons-react"

import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { useUser } from "@/context/user-context"
import { useNotifications } from "@/context/notification-context"
import { SidebarNavigationContext } from "@/components/navigation/sidebar-provider"
import { elysia } from "@/lib/elysia"
import {
  evaluateExpression,
  resolveComponent,
  resolveProps,
  type IrisChild,
  type IrisNode,
  type SandboxContext,
} from "@/components/iris-page"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { NodePath, ViewportMode } from "./types"
import { getNodeBreadcrumbs, type SectionPresetType } from "./ast-utils"

export interface CanvasProps {
  root: IrisNode
  state?: Record<string, any>
  selectedPath: NodePath
  viewport: ViewportMode
  wireframeMode?: boolean
  onSelectPath: (path: NodePath) => void
  onMoveNode: (path: NodePath, direction: "up" | "down") => void
  onDuplicateNode: (path: NodePath) => void
  onDeleteNode: (path: NodePath) => void
  onInsertChild: (parentPath: NodePath, newNode?: IrisNode) => void
  onInsertAdjacent?: (targetPath: NodePath, position: "above" | "below", newNode?: IrisNode) => void
  onOpenProperties?: (path: NodePath) => void
  onOpenPicker?: (targetPath: NodePath, position: "inside" | "above" | "below") => void
  onAddSection?: (type?: SectionPresetType) => void
  onToggleRootWidth?: () => void
}

/**
 * Extracts grid column span, start, and flex placement classes so that
 * direct children of CSS grid/flex parents are positioned correctly.
 */
function getLayoutPlacementClasses(className?: string): string {
  if (!className) return ""
  const regex = /\b(?:(?:sm|md|lg|xl|2xl):)?(?:col-span-\S+|col-start-\S+|col-end-\S+|row-span-\S+|row-start-\S+|row-end-\S+|flex-1|flex-auto|flex-initial|flex-none|grow|grow-0|shrink|shrink-0|self-\S+|justify-self-\S+)\b/g
  const matches = className.match(regex)
  return matches ? matches.join(" ") : ""
}

export function Canvas({
  root,
  state,
  selectedPath,
  viewport,
  wireframeMode = true,
  onSelectPath,
  onMoveNode,
  onDuplicateNode,
  onDeleteNode,
  onInsertChild,
  onInsertAdjacent,
  onOpenProperties,
  onOpenPicker,
  onAddSection,
  onToggleRootWidth,
}: CanvasProps) {
  const breadcrumbs = React.useMemo(() => {
    return getNodeBreadcrumbs(root, selectedPath)
  }, [root, selectedPath])

  // Consume host hooks with fallback
  let liveUser: any = null
  try {
    const userHook = useUser()
    liveUser = userHook?.user
  } catch {
    // ignore
  }

  let liveSession: any = null
  try {
    const sessionHook = useSession()
    liveSession = sessionHook?.data
  } catch {
    // ignore
  }

  let liveTheme: any = null
  try {
    liveTheme = useTheme()
  } catch {
    // ignore
  }

  let liveNotifications: any = null
  try {
    liveNotifications = useNotifications()
  } catch {
    // ignore
  }

  const liveSidebar = React.useContext(SidebarNavigationContext)

  // Reactive sandbox context for visual canvas rendering in edit mode
  const sandboxContext: SandboxContext = React.useMemo(() => {
    return {
      state: state || {},
      set: () => {},
      toggle: () => {},
      push: () => {},
      remove: () => {},
      emit: () => {},
      elysia,
      user: liveUser || {
        id: "usr_demo",
        username: "rrHakushi",
        displayName: "rrHakushi",
        email: "dev@iris.local",
        role: "Member",
      },
      session: liveSession || {
        user: { name: "rrHakushi", email: "dev@iris.local" },
        expires: new Date(Date.now() + 365 * 86400000).toISOString(),
      },
      theme: {
        theme: liveTheme?.theme || "dark",
        resolvedTheme: liveTheme?.resolvedTheme || "dark",
        systemTheme: liveTheme?.systemTheme,
        setTheme: (t: string) => liveTheme?.setTheme?.(t),
      },
      toast,
      notifications: liveNotifications || {
        unreadCount: 0,
        notifications: [],
      },
      sidebar: liveSidebar || { isOpen: true, toggleSidebar: () => {} },
      actions: {},
      helpers: {
        formatDate: (d: string | number | Date) => new Date(d).toLocaleDateString(),
        formatNumber: (n: number) => new Intl.NumberFormat().format(n),
        toUpperCase: (s: string) => String(s).toUpperCase(),
        toLowerCase: (s: string) => String(s).toLowerCase(),
      },
    }
  }, [state, liveUser, liveSession, liveTheme, liveNotifications, liveSidebar])

  // Viewport width constraints
  const viewportWidthClass =
    viewport === "mobile"
      ? "max-w-sm mx-auto"
      : viewport === "tablet"
        ? "max-w-2xl mx-auto"
        : "w-full"

  /**
   * Helper to check if a node path matches the currently selected path.
   */
  const isSelected = (path: NodePath) => {
    if (path.length !== selectedPath.length) return false
    return path.every((val, idx) => val === selectedPath[idx])
  }

  /**
   * Recursive node renderer for the visual edit canvas with wireframe mode
   */
  const renderEditableNode = (
    node: IrisChild | IrisChild[] | null | undefined,
    currentPath: NodePath
  ): React.ReactNode => {
    if (node == null) return null

    // Strings and numbers with dynamic expression evaluation
    if (typeof node === "string" || typeof node === "number") {
      let displayText = String(node)
      if (typeof node === "string" && node.includes("{{")) {
        displayText = node.replace(/\{\{(.*?)\}\}/g, (_, expr) => {
          try {
            const res = evaluateExpression(expr, sandboxContext)
            return res != null ? String(res) : ""
          } catch {
            return `{{${expr.trim()}}}`
          }
        })
      }

      return (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onSelectPath(currentPath)
          }}
          className="cursor-pointer hover:underline decoration-primary/50"
        >
          {displayText}
        </span>
      )
    }

    // Array of nodes
    if (Array.isArray(node)) {
      return node.map((child, idx) => (
        <React.Fragment key={idx}>
          {renderEditableNode(child, [...currentPath, idx])}
        </React.Fragment>
      ))
    }

    const selected = isSelected(currentPath)
    const isRoot = currentPath.length === 0
    const isSection = node.type.toLowerCase() === "section"
    const isContainer =
      node.type === "div" ||
      node.type === "CardContent" ||
      node.type === "section" ||
      node.type === "main"

    // Component resolution
    const Component = resolveComponent(node.type)
    if (!Component) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Unknown Component: <code>{node.type}</code>
        </div>
      )
    }

    // Resolve props using sandbox context
    const resolvedProps = resolveProps(node.props, sandboxContext, (slotNode) =>
      renderEditableNode(slotNode, [...currentPath])
    )

    // Render children
    const hasChildren =
      node.children != null &&
      (Array.isArray(node.children) ? node.children.length > 0 : true)

    let renderedChildren: React.ReactNode = null
    if (hasChildren) {
      renderedChildren = renderEditableNode(node.children, currentPath)
    } else if (isContainer) {
      // Empty container dropzone with Unicorn-style "Start writing or Choose component"
      renderedChildren = (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onSelectPath(currentPath)
          }}
          className="group/slot relative flex flex-col items-center justify-center min-h-[85px] w-full rounded-2xl border border-dashed border-border/70 bg-muted/15 p-2 overflow-hidden transition-all hover:border-primary/60 hover:bg-primary/5"
        >
          {wireframeMode && (
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-1 select-none truncate max-w-full text-center">
              Layout item
            </div>
          )}

          <div className="flex items-center justify-center text-xs text-muted-foreground max-w-full">
            <Button
              size="xs"
              variant="outline"
              onPress={() => {
                onSelectPath(currentPath)
                if (onOpenPicker) {
                  onOpenPicker(currentPath, "inside")
                } else {
                  onInsertChild(currentPath)
                }
              }}
              className="gap-1 text-xs bg-background/90 shadow-xs hover:border-primary hover:text-primary max-w-full truncate px-2"
            >
              <IconBook className="size-3.5 text-primary shrink-0" />
              <span className="truncate">Choose component</span>
            </Button>
          </div>
        </div>
      )
    }

    const element = React.createElement(
      Component,
      {
        ...resolvedProps,
        // Override event handlers so clicks in edit mode select the node instead of executing scripts
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
        },
      },
      renderedChildren
    )

    // Extract grid and flex layout placement classes for direct parent positioning
    const rawClassName = typeof node.props?.className === "string" ? node.props.className : undefined
    const layoutPlacement = getLayoutPlacementClasses(rawClassName)

    return (
      <div
        key={currentPath.join("-") || "root"}
        className={`relative ${layoutPlacement} w-full`}
      >
        <div
          onClick={(e) => {
            e.stopPropagation()
            onSelectPath(currentPath)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onSelectPath(currentPath)
            onOpenProperties?.(currentPath)
          }}
          className={`group/node relative w-full h-full transition-all duration-150 ${
            selected
              ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl z-20"
              : "hover:ring-1 hover:ring-primary/40 hover:rounded-xl"
          } ${
            wireframeMode && isSection
              ? "border border-dashed border-border/80 rounded-2xl my-3 bg-muted/5 w-full"
              : ""
          }`}
        >
          {/* Section Wireframe Header Bar */}
          {wireframeMode && isSection && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-dashed border-border/60 bg-muted/20 text-[10px] font-mono text-muted-foreground select-none rounded-t-2xl">
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1.5 font-mono uppercase bg-background/80 tracking-wider"
                >
                  PAGE SECTION
                </Badge>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground/70">Section</span>
            </div>
          )}

          {/* Floating Action Toolbar on Selected Node */}
          {selected && !isRoot && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute -top-9 start-2 z-30 flex items-center gap-1 rounded-xl border border-border/80 bg-background/95 px-2 py-1 shadow-md backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            >
              <Badge variant="default" className="text-[10px] h-4 px-1.5 font-mono">
                &lt;{node.type}&gt;
              </Badge>

              <div className="h-3 w-px bg-border/60 mx-0.5" />

              {/* Properties Icon Button */}
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onOpenProperties?.(currentPath)}
                aria-label="Edit Properties"
                className="text-primary hover:bg-primary/10"
              >
                <IconAdjustments className="size-3.5" />
              </Button>

              {/* Insert Above Button */}
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => {
                  if (onOpenPicker) onOpenPicker(currentPath, "above")
                  else onInsertAdjacent?.(currentPath, "above")
                }}
                aria-label="Insert Above"
              >
                <IconRowInsertTop className="size-3.5" />
              </Button>

              {/* Insert Under Button */}
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => {
                  if (onOpenPicker) onOpenPicker(currentPath, "below")
                  else onInsertAdjacent?.(currentPath, "below")
                }}
                aria-label="Insert Under"
              >
                <IconRowInsertBottom className="size-3.5" />
              </Button>

              <div className="h-3 w-px bg-border/60 mx-0.5" />

              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onMoveNode(currentPath, "up")}
                aria-label="Move Up"
              >
                <IconArrowUp className="size-3" />
              </Button>

              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onMoveNode(currentPath, "down")}
                aria-label="Move Down"
              >
                <IconArrowDown className="size-3" />
              </Button>

              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onDuplicateNode(currentPath)}
                aria-label="Duplicate"
              >
                <IconCopy className="size-3" />
              </Button>

              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => {
                  if (onOpenPicker) onOpenPicker(currentPath, "inside")
                  else onInsertChild(currentPath)
                }}
                aria-label="Add Child Inside"
              >
                <IconPlus className="size-3 text-primary" />
              </Button>

              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onDeleteNode(currentPath)}
                aria-label="Delete Node"
                className="text-destructive hover:bg-destructive/10"
              >
                <IconTrash className="size-3" />
              </Button>
            </div>
          )}

          {/* Selected Pill Indicator on Root */}
          {selected && isRoot && (
            <div className="absolute -top-8 start-2 z-30 flex items-center gap-1.5">
              <Badge variant="default" className="text-[10px] h-5 px-2 font-mono shadow-xs">
                Root (&lt;{node.type}&gt;)
              </Badge>
              {onToggleRootWidth && (
                <Button
                  size="xs"
                  variant="outline"
                  onPress={onToggleRootWidth}
                  className="h-5 gap-1 px-2 text-[10px] font-semibold bg-background shadow-xs hover:border-primary text-primary"
                  aria-label="Toggle between 100% full width and boxed"
                >
                  <IconArrowsMaximize className="size-3 text-primary" />
                  <span>Stretch Width</span>
                </Button>
              )}
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onOpenProperties?.(currentPath)}
                aria-label="Edit Root Properties"
                className="text-primary hover:bg-primary/10"
              >
                <IconAdjustments className="size-3.5" />
              </Button>
            </div>
          )}

          {element}
        </div>


      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      {/* Top Breadcrumbs Bar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-background/60 px-4 py-2 text-xs text-muted-foreground backdrop-blur-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="font-semibold text-foreground me-1">Hierarchy:</span>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path.join("-") || "root"}>
              {idx > 0 && <IconChevronRight className="size-3 text-muted-foreground/60" />}
              <button
                type="button"
                onClick={() => onSelectPath(crumb.path)}
                className={`rounded px-1.5 py-0.5 transition-colors font-mono text-[11px] ${
                  isSelected(crumb.path)
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-muted hover:text-foreground"
                }`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {onOpenProperties && (
          <Button
            size="xs"
            variant="ghost"
            onPress={() => onOpenProperties(selectedPath)}
            className="gap-1 text-[11px] text-primary hover:bg-primary/10 shrink-0"
          >
            <IconAdjustments className="size-3.5" />
            <span className="hidden sm:inline">Properties</span>
          </Button>
        )}
      </div>

      {/* Viewport Frame */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className={`transition-all duration-200 ${viewportWidthClass}`}>
          <div className="rounded-[min(var(--radius-4xl),24px)] border border-border/60 bg-card p-6 shadow-sm min-h-[500px]">
            {renderEditableNode(root, [])}

            {/* Bottom Add Section Button (Matches unicorn.com reference) */}
            <div className="mt-8 flex items-center justify-center py-4">
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  if (onOpenPicker) {
                    onOpenPicker([], "below")
                  } else if (onAddSection) {
                    onAddSection("3-col")
                  }
                }}
                className="gap-2 rounded-2xl border-dashed border-border/80 px-5 py-2.5 text-xs font-semibold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all shadow-xs"
              >
                <IconPlus className="size-4 text-primary" />
                <span>Add section</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
