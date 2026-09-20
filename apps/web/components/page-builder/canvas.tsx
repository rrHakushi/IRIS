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

import {
  resolveComponent,
  resolveProps,
  type IrisChild,
  type IrisNode,
} from "@/components/iris-page"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { NodePath, ViewportMode } from "./types"
import { getNodeBreadcrumbs, type SectionPresetType } from "./ast-utils"

export interface CanvasProps {
  root: IrisNode
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
 * Strict HTML DOM category checks to prevent invalid DOM nesting
 * (e.g. <div> inside <table>, <thead>, <tbody>, <tr>, <ul>, <ol>, <select>).
 */
const TABLE_SECTION_TAGS = new Set([
  "thead", "tbody", "tfoot", "caption", "colgroup", "col",
  "doctableheader", "doctablebody", "doctablefooter", "doctablecaption",
  "tableheader", "tablebody", "tablefooter", "tablecaption",
])

const TABLE_ROW_TAGS = new Set([
  "tr", "doctablerow", "tablerow",
])

const TABLE_CELL_TAGS = new Set([
  "th", "td", "doctablehead", "doctablecell",
  "tablehead", "tablecell",
])

const LIST_ITEM_TAGS = new Set(["li"])
const SELECT_ITEM_TAGS = new Set(["option", "optgroup"])

function isTableSection(type: string): boolean {
  return TABLE_SECTION_TAGS.has(type.toLowerCase())
}

function isTableRow(type: string): boolean {
  return TABLE_ROW_TAGS.has(type.toLowerCase())
}

function isTableCell(type: string): boolean {
  return TABLE_CELL_TAGS.has(type.toLowerCase())
}

function isListItem(type: string): boolean {
  return LIST_ITEM_TAGS.has(type.toLowerCase())
}

function isSelectItem(type: string): boolean {
  return SELECT_ITEM_TAGS.has(type.toLowerCase())
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

  const toolbarHandlers = {
    onOpenProperties,
    onOpenPicker,
    onInsertAdjacent,
    onInsertChild,
    onMoveNode,
    onDuplicateNode,
    onDeleteNode,
  }

  /**
   * Floating Action Toolbar on Selected Node
   */
  const renderFloatingToolbar = (node: IrisNode, currentPath: NodePath) => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute -top-10 start-2 z-50 flex items-center gap-1 rounded-xl border border-border/90 bg-background/95 px-2 py-1 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap pointer-events-auto"
    >
      <Badge variant="default" className="text-[10px] h-4 px-1.5 font-mono shadow-xs">
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
  )

  /**
   * Recursive node renderer for the visual edit canvas with wireframe mode
   */
  const renderEditableNode = (
    node: IrisChild | IrisChild[] | null | undefined,
    currentPath: NodePath
  ): React.ReactNode => {
    if (node == null) return null

    // Strings and numbers
    if (typeof node === "string" || typeof node === "number") {
      return (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onSelectPath(currentPath)
          }}
          className="cursor-pointer hover:underline decoration-primary/50"
        >
          {String(node)}
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

    // Resolve slots
    const resolvedProps = resolveProps(node.props, (slotNode: any) =>
      renderEditableNode(slotNode, [...currentPath])
    )

    // Render children
    const hasChildren =
      node.children != null &&
      (Array.isArray(node.children) ? node.children.length > 0 : true)

    let renderedChildren: React.ReactNode = null
    if (node.text !== undefined) {
      renderedChildren = (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onSelectPath(currentPath)
          }}
          className="cursor-pointer hover:underline decoration-primary/50"
        >
          {node.text}
        </span>
      )
    } else if (hasChildren) {
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

    // ========================================================================
    // HTML DOM COMPLIANCE: Avoid illegal outer <div> wrappers for table/list tags
    // ========================================================================

    // Case 1: Table Section (thead, tbody, tfoot, caption, colgroup)
    if (isTableSection(node.type)) {
      const sectionProps = {
        ...resolvedProps,
        key: currentPath.join("-") || "table-section",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
        },
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
          onOpenProperties?.(currentPath)
        },
        className: cn(
          resolvedProps.className,
          selected && "ring-2 ring-primary ring-inset bg-primary/5"
        ),
      }
      return React.createElement(Component, sectionProps, renderedChildren)
    }

    // Case 2: Table Row (tr, DocTableRow, TableRow)
    if (isTableRow(node.type)) {
      const rowProps = {
        ...resolvedProps,
        key: currentPath.join("-") || "table-row",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
        },
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
          onOpenProperties?.(currentPath)
        },
        className: cn(
          resolvedProps.className,
          selected && "ring-2 ring-primary ring-inset bg-primary/10 relative z-10",
          !selected && "hover:bg-muted/40 cursor-pointer"
        ),
      }
      return React.createElement(Component, rowProps, renderedChildren)
    }

    // Case 3: Table Cell (th, td, DocTableHead, DocTableCell, TableHead, TableCell)
    if (isTableCell(node.type)) {
      const cellProps = {
        ...resolvedProps,
        key: currentPath.join("-") || "table-cell",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
        },
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
          onOpenProperties?.(currentPath)
        },
        className: cn(
          resolvedProps.className,
          "relative cursor-pointer transition-colors",
          selected && "ring-2 ring-primary ring-inset bg-primary/10 z-20",
          !selected && "hover:outline-dashed hover:outline-1 hover:outline-primary/40"
        ),
      }
      return React.createElement(
        Component,
        cellProps,
        selected && !isRoot ? (
          <>
            {renderFloatingToolbar(node, currentPath)}
            {renderedChildren}
          </>
        ) : (
          renderedChildren
        )
      )
    }

    // Case 4: List Item (li)
    if (isListItem(node.type)) {
      const liProps = {
        ...resolvedProps,
        key: currentPath.join("-") || "list-item",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
        },
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          onSelectPath(currentPath)
          onOpenProperties?.(currentPath)
        },
        className: cn(
          resolvedProps.className,
          "group/node relative transition-all duration-150",
          selected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl z-30"
            : "hover:ring-1 hover:ring-primary/40 hover:rounded-lg"
        ),
      }
      return React.createElement(
        Component,
        liProps,
        selected && !isRoot ? (
          <>
            {renderFloatingToolbar(node, currentPath)}
            {renderedChildren}
          </>
        ) : (
          renderedChildren
        )
      )
    }

    // Case 5: Select Item (option, optgroup)
    if (isSelectItem(node.type)) {
      return React.createElement(
        Component,
        {
          ...resolvedProps,
          key: currentPath.join("-") || "select-item",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation()
            onSelectPath(currentPath)
          },
        },
        renderedChildren
      )
    }

    // ========================================================================
    // Case 6: Standard Elements / Containers
    // ========================================================================
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
              ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl z-30"
              : "hover:ring-1 hover:ring-primary/40 hover:rounded-xl"
          } ${
            wireframeMode && isSection
              ? "border border-dashed border-border/80 rounded-2xl my-5 pt-1 bg-muted/5 w-full"
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
          {selected && !isRoot && renderFloatingToolbar(node, currentPath)}

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
      {/* Top Breadcrumbs & Actions Bar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-background/60 px-4 py-2 text-xs text-muted-foreground backdrop-blur-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto me-2">
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

        <div className="flex items-center gap-1 shrink-0">
          {selectedPath.length > 0 && (
            <>
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onMoveNode(selectedPath, "up")}
                aria-label="Move Up"
              >
                <IconArrowUp className="size-3" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onMoveNode(selectedPath, "down")}
                aria-label="Move Down"
              >
                <IconArrowDown className="size-3" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onDuplicateNode(selectedPath)}
                aria-label="Duplicate"
              >
                <IconCopy className="size-3" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onDeleteNode(selectedPath)}
                aria-label="Delete Node"
                className="text-destructive hover:bg-destructive/10"
              >
                <IconTrash className="size-3" />
              </Button>
              <div className="h-3 w-px bg-border/60 mx-1" />
            </>
          )}

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
      </div>

      {/* Viewport Frame */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className={`transition-all duration-200 ${viewportWidthClass}`}>
          <div className="rounded-[min(var(--radius-4xl),24px)] border border-border/60 bg-card p-6 pt-10 shadow-sm min-h-[500px]">
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

