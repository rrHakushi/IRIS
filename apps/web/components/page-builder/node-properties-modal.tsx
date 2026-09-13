"use client"

import * as React from "react"
import {
  IconAdjustments,
  IconArrowRight,
  IconCheck,
  IconCode,
  IconCopy,
  IconEye,
  IconHandClick,
  IconLayersLinked,
  IconLayoutGrid,
  IconPalette,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconVariable,
  IconWand,
  IconX,
} from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import type { IrisNode, IrisPageSchema } from "@/components/iris-page"
import type { NodePath } from "./types"
import { getNodeBreadcrumbs, getNodeByPath } from "./ast-utils"

export interface NodePropertiesModalProps {
  isOpen: boolean
  schema: IrisPageSchema
  selectedPath: NodePath
  onClose: () => void
  onUpdateNode: (path: NodePath, updater: (node: IrisNode) => IrisNode) => void
  onDeleteNode: (path: NodePath) => void
  onDuplicateNode?: (path: NodePath) => void
}

const COMMON_ICONS = [
  "IconSparkles",
  "IconCheck",
  "IconUser",
  "IconBell",
  "IconHeart",
  "IconSend",
  "IconRefresh",
  "IconPlus",
  "IconTrash",
  "IconDeviceFloppy",
  "IconSearch",
  "IconShieldCheck",
  "IconSun",
  "IconMoon",
  "IconInfoCircle",
  "IconSettings",
  "IconLayoutGrid",
  "IconArrowRight",
  "IconExternalLink",
]

const VARIANT_OPTIONS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "info",
  "warning",
]

const SIZE_OPTIONS = ["xs", "sm", "default", "lg"]

import { ACTION_CATALOG, type ActionCatalogItem } from "./catalog"

export function NodePropertiesModal({
  isOpen,
  schema,
  selectedPath,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
}: NodePropertiesModalProps) {
  const [activeTab, setActiveTab] = React.useState<"general" | "styling" | "state" | "actions">("general")
  const [actionSearchQuery, setActionSearchQuery] = React.useState("")
  const [showActionCatalog, setShowActionCatalog] = React.useState(false)

  // Current selected node
  const selectedNode = React.useMemo(() => {
    return getNodeByPath(schema.root, selectedPath)
  }, [schema.root, selectedPath])

  // Breadcrumbs
  const breadcrumbs = React.useMemo(() => {
    return getNodeBreadcrumbs(schema.root, selectedPath)
  }, [schema.root, selectedPath])

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !selectedNode) return null

  const props = selectedNode.props || {}
  const isRoot = selectedPath.length === 0

  // Prop mutators
  const setProp = (key: string, value: any) => {
    onUpdateNode(selectedPath, (node) => {
      const nextProps = { ...(node.props || {}) }
      if (value === undefined || value === "") {
        delete nextProps[key]
      } else {
        nextProps[key] = value
      }
      return { ...node, props: nextProps }
    })
  }

  const setChildrenText = (text: string) => {
    onUpdateNode(selectedPath, (node) => ({
      ...node,
      children: text,
    }))
  }

  const isSimpleTextChild =
    typeof selectedNode.children === "string" || typeof selectedNode.children === "number"

  // Action script handlers
  const currentActionScript = String(props.onPress || props.onClick || "")

  const handleInsertSnippet = (snippet: string) => {
    const existing = currentActionScript.trim()
    const updated = existing ? `${existing}\n${snippet}` : snippet
    setProp("onPress", updated)
  }

  // Filtered action catalog
  const filteredCatalog = ACTION_CATALOG.filter((item) => {
    if (!actionSearchQuery.trim()) return true
    const q = actionSearchQuery.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    )
  })

  // Declared schema actions (if any)
  const declaredSchemaActions = Object.keys(schema.actions || {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-[min(var(--radius-4xl),28px)] border border-border/80 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconAdjustments className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs font-mono h-5 px-2">
                  &lt;{selectedNode.type}&gt;
                </Badge>
                <span className="text-xs font-semibold text-foreground">Component Properties</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                {breadcrumbs.map((crumb, idx) => (
                  <span key={idx}>
                    {idx > 0 && " / "}
                    {crumb.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onDuplicateNode && !isRoot && (
              <Button
                size="icon-xs"
                variant="outline"
                onPress={() => onDuplicateNode(selectedPath)}
                aria-label="Duplicate component"
              >
                <IconCopy className="size-3.5" />
              </Button>
            )}

            {!isRoot && (
              <Button
                size="icon-xs"
                variant="outline"
                onPress={() => {
                  onDeleteNode(selectedPath)
                  onClose()
                }}
                className="text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                aria-label="Delete component"
              >
                <IconTrash className="size-3.5" />
              </Button>
            )}

            <Button
              size="icon-xs"
              variant="ghost"
              onPress={onClose}
              aria-label="Close properties"
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </div>

        {/* 2. Modal Sub-Tabs */}
        <div className="flex items-center gap-1 border-b border-border/40 bg-muted/10 px-6 py-2">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "general"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            General & Content
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("styling")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "styling"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Appearance & Styling
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("state")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "state"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            State & Binding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("actions")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "actions"
                ? "bg-background text-foreground shadow-xs font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconHandClick className="size-3.5" />
            <span>Actions & Events</span>
          </button>
        </div>

        {/* 3. Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* TAB 1: General & Content */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Text content */}
              {isSimpleTextChild && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Text Content</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      supports {"{{ state.count }}"}
                    </span>
                  </label>
                  <Input
                    value={String(selectedNode.children ?? "")}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildrenText(e.target.value)}
                    placeholder="Enter text or dynamic expression..."
                    className="h-9 text-xs rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Insert dynamic bindings with double braces, e.g. <code className="font-mono bg-muted/60 px-1 py-0.5 rounded">Hello {"{{ user?.displayName || 'Guest' }}"}</code>
                  </p>
                </div>
              )}

              {/* Tabler Icon Selector */}
              {selectedNode.type === "Icon" && (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <IconSparkles className="size-4 text-primary" />
                    <span>Tabler Icon Name</span>
                  </label>
                  <Input
                    value={String(props.name || "")}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProp("name", e.target.value)}
                    placeholder="e.g. IconSparkles, IconUser, IconHeart"
                    className="h-9 text-xs font-mono rounded-xl"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {COMMON_ICONS.map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setProp("name", iconName)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
                          props.name === iconName
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/60 hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {iconName.replace("Icon", "")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* HTML Specific Attributes */}
              {["a", "img", "video", "iframe", "input"].includes(selectedNode.type.toLowerCase()) && (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <IconCode className="size-4 text-primary" />
                    <span>HTML Attributes</span>
                  </div>

                  {(selectedNode.type.toLowerCase() === "a" ||
                    selectedNode.type.toLowerCase() === "img" ||
                    selectedNode.type.toLowerCase() === "video" ||
                    selectedNode.type.toLowerCase() === "iframe") && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">
                        {selectedNode.type.toLowerCase() === "a" ? "Destination Link (href)" : "Source URL (src)"}
                      </label>
                      <Input
                        value={String(props.href || props.src || "")}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProp(selectedNode.type.toLowerCase() === "a" ? "href" : "src", e.target.value)
                        }
                        placeholder="https://..."
                        className="h-8 text-xs font-mono rounded-xl"
                      />
                    </div>
                  )}

                  {selectedNode.type.toLowerCase() === "img" && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Alt Description</label>
                      <Input
                        value={String(props.alt || "")}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProp("alt", e.target.value)}
                        placeholder="Image description..."
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Conditional Visibility */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <IconEye className="size-4 text-primary" />
                  <span>Conditional Visibility (condition)</span>
                </label>
                <Input
                  value={String(selectedNode.condition || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value
                    onUpdateNode(selectedPath, (node) => ({
                      ...node,
                      condition: val.trim() ? val : undefined,
                    }))
                  }}
                  placeholder="e.g. state.count > 0, user != null, state.tab === 'home'"
                  className="h-9 text-xs font-mono rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Node will only render if this expression evaluates to truthy in runtime.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Styling & Appearance */}
          {activeTab === "styling" && (
            <div className="space-y-4">
              {/* Variant Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Visual Variant</label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIANT_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setProp("variant", v === props.variant ? undefined : v)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
                        props.variant === v
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "border-border/60 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Size</label>
                <div className="flex gap-1.5">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setProp("size", s === props.size ? undefined : s)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                        props.size === s
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "border-border/60 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Screen Placement & 12-Column Grid */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <IconLayoutGrid className="size-4 text-primary" />
                    <span>Screen Placement & 12-Column Grid</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">Place anywhere</span>
                </div>

                {/* Horizontal Alignment */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Screen Alignment:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "Left", cls: "mr-auto" },
                      { label: "Center", cls: "mx-auto" },
                      { label: "Right", cls: "ml-auto" },
                      { label: "Full Width", cls: "w-full" },
                    ].map((align) => {
                      const active = String(props.className || "").includes(align.cls)
                      return (
                        <button
                          key={align.label}
                          type="button"
                          onClick={() => {
                            let nextCls = String(props.className || "")
                              .replace(/\b(mr-auto|mx-auto|ml-auto)\b/g, "")
                              .trim()
                            if (align.cls !== "w-full") {
                              nextCls = `${nextCls} ${align.cls}`.trim()
                            } else {
                              if (!nextCls.includes("w-full")) nextCls = `${nextCls} w-full`.trim()
                            }
                            setProp("className", nextCls)
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "border-border/60 hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {align.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Grid Column Span */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] text-muted-foreground">Grid Width (Column Span):</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "Full (12 cols)", cls: "col-span-12" },
                      { label: "3/4 (9 cols)", cls: "col-span-9" },
                      { label: "2/3 (8 cols)", cls: "col-span-8" },
                      { label: "1/2 (6 cols)", cls: "col-span-6" },
                      { label: "1/3 (4 cols)", cls: "col-span-4" },
                      { label: "1/4 (3 cols)", cls: "col-span-3" },
                      { label: "Sidebar (2 cols)", cls: "col-span-2" },
                    ].map((span) => {
                      const active = String(props.className || "").includes(span.cls)
                      return (
                        <button
                          key={span.label}
                          type="button"
                          onClick={() => {
                            let nextCls = String(props.className || "")
                              .replace(/\bcol-span-\d+\b/g, "")
                              .trim()
                            nextCls = `${nextCls} ${span.cls}`.trim()
                            setProp("className", nextCls)
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "border-border/60 hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {span.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Grid Column Start (Placement across screen) */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] text-muted-foreground">Start Column (Horizontal Offset):</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "Col 1 (Far Left)", cls: "col-start-1" },
                      { label: "Col 3", cls: "col-start-3" },
                      { label: "Col 4 (Center-Left)", cls: "col-start-4" },
                      { label: "Col 6", cls: "col-start-6" },
                      { label: "Col 7 (Center-Right)", cls: "col-start-7" },
                      { label: "Col 9", cls: "col-start-9" },
                      { label: "Col 10 (Far Right)", cls: "col-start-10" },
                    ].map((start) => {
                      const active = String(props.className || "").includes(start.cls)
                      return (
                        <button
                          key={start.label}
                          type="button"
                          onClick={() => {
                            let nextCls = String(props.className || "")
                              .replace(/\bcol-start-\d+\b/g, "")
                              .trim()
                            nextCls = `${nextCls} ${start.cls}`.trim()
                            setProp("className", nextCls)
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "border-border/60 hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {start.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Tailwind CSS Classes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <IconPalette className="size-4 text-primary" />
                  <span>Tailwind CSS Classes</span>
                </label>
                <Input
                  value={String(props.className || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProp("className", e.target.value)}
                  placeholder="e.g. flex items-center justify-between p-4 rounded-2xl bg-card border"
                  className="h-9 text-xs font-mono rounded-xl"
                />

                {/* Quick Add Presets */}
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] text-muted-foreground self-center me-1">Quick add:</span>
                  {[
                    "w-full",
                    "flex",
                    "flex-col",
                    "items-center",
                    "justify-between",
                    "gap-3",
                    "p-4",
                    "rounded-2xl",
                    "border",
                    "bg-card",
                    "shadow-sm",
                  ].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        const current = String(props.className || "")
                        if (!current.includes(cls)) {
                          setProp("className", current ? `${current} ${cls}` : cls)
                        }
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                    >
                      +{cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: State & Binding */}
          {activeTab === "state" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <IconVariable className="size-4 text-primary" />
                  <span>Two-Way Input Value Binding (bind)</span>
                </label>
                <Input
                  value={String(props.bind || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProp("bind", e.target.value)}
                  placeholder="e.g. state.searchQuery, state.userProfile.name"
                  className="h-9 text-xs font-mono rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Synchronizes input value bidirectionally with state. When user types, state updates automatically.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <IconCheck className="size-4 text-primary" />
                  <span>Two-Way Checkbox / Switch Binding (bindChecked)</span>
                </label>
                <Input
                  value={String(props.bindChecked || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProp("bindChecked", e.target.value)}
                  placeholder="e.g. state.notificationsEnabled, state.isSubscribed"
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>

              <Separator />

              {/* Repeat Array Binding */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <IconLayersLinked className="size-4 text-primary" />
                  <span>Loop / Repeat Array Binding (repeat)</span>
                </label>
                <Input
                  value={String(props.repeat || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProp("repeat", e.target.value)}
                  placeholder="e.g. state.items, state.users"
                  className="h-9 text-xs font-mono rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Repeats this node for every element in the array. Inside children, access the item via <code className="font-mono bg-muted px-1 rounded">{"{{ item.name }}"}</code> or <code className="font-mono bg-muted px-1 rounded">{"{{ index }}"}</code>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Actions, Events & Autocomplete */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <IconHandClick className="size-4 text-primary" />
                    <span>Event Script (onPress / onClick)</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Executed when the user clicks or presses this component. Supports async/await.
                  </p>
                </div>

                <Button
                  size="xs"
                  variant="outline"
                  onPress={() => setShowActionCatalog(!showActionCatalog)}
                  className="gap-1.5 text-xs text-primary"
                >
                  <IconWand className="size-3.5" />
                  <span>{showActionCatalog ? "Hide Catalog" : "Action Catalog"}</span>
                </Button>
              </div>

              {/* Action Catalog Drawer / Selector */}
              {showActionCatalog && (
                <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 space-y-2.5 animate-in fade-in zoom-in-98 duration-100">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <IconSearch className="size-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={actionSearchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActionSearchQuery(e.target.value)}
                        placeholder="Search actions (e.g. toast, elysia, state, toggle)..."
                        className="h-8 ps-8 text-xs rounded-xl bg-background"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 pe-1">
                    {filteredCatalog.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-background border border-border/60 hover:border-primary/60 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] font-mono font-bold text-primary">
                              {item.name}
                            </code>
                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 uppercase font-mono">
                              {item.category}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onPress={() => handleInsertSnippet(item.snippet)}
                          aria-label="Insert snippet"
                          className="shrink-0 text-primary hover:bg-primary/10"
                        >
                          <IconPlus className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script Textarea Editor */}
              <div className="space-y-1.5">
                <Textarea
                  value={currentActionScript}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    const script = e.target.value
                    setProp("onPress", script.trim() ? script : undefined)
                  }}
                  placeholder="e.g.&#10;set('counter', state.counter + 1);&#10;toast.success('Counter updated!');&#10;await elysia.auth.me.get();"
                  className="h-32 text-xs font-mono resize-none rounded-xl"
                />
              </div>

              {/* Autocomplete Quick Insert Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                  Quick Action Snippets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertSnippet("set('count', (state.count || 0) + 1);")}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                  >
                    + set(state)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInsertSnippet("toggle('isOpen');")}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                  >
                    + toggle(isOpen)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInsertSnippet("toast.success('Operation succeeded!');")}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                  >
                    + toast.success
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInsertSnippet("const res = await elysia.auth.me.get();")}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                  >
                    + elysia.api
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInsertSnippet("theme.setTheme(theme.resolvedTheme === 'dark' ? 'light' : 'dark');")}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                  >
                    + toggleTheme
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInsertSnippet("emit('customAction', { state });")}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40"
                  >
                    + emit(host)
                  </button>

                  {/* Declared schema actions */}
                  {declaredSchemaActions.map((actName) => (
                    <button
                      key={actName}
                      type="button"
                      onClick={() => handleInsertSnippet(`actions.${actName}();`)}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
                    >
                      + actions.{actName}()
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/60 bg-muted/20">
          <div className="text-[11px] text-muted-foreground">
            Changes apply instantly to the canvas. Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd> to exit.
          </div>
          <Button size="xs" variant="default" onPress={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
