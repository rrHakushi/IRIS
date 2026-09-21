"use client"

import * as React from "react"
import {
  IconAdjustments,
  IconCheck,
  IconCode,
  IconCopy,
  IconLayersLinked,
  IconPalette,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "sonner"
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
  "IconBook",
  "IconFileText",
  "IconInfoCircle",
  "IconBulb",
  "IconAlertTriangle",
  "IconAlertCircle",
  "IconCheck",
  "IconCode",
  "IconSparkles",
  "IconArrowRight",
  "IconExternalLink",
  "IconCopy",
  "IconDownload",
  "IconTrash",
  "IconUser",
  "IconBell",
  "IconSettings",
]

const VARIANT_OPTIONS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "info",
  "tip",
  "warning",
  "danger",
  "note",
]

const SIZE_OPTIONS = ["xs", "sm", "default", "lg"]

export function NodePropertiesModal({
  isOpen,
  schema,
  selectedPath,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
}: NodePropertiesModalProps) {
  const [activeTab, setActiveTab] = React.useState<
    "content" | "styling" | "props"
  >("content")
  const [propsJsonError, setPropsJsonError] = React.useState<string | null>(
    null
  )

  const rootNode = schema.root || { type: "div", children: [] }

  // Current selected node
  const selectedNode = React.useMemo(() => {
    return getNodeByPath(rootNode, selectedPath)
  }, [rootNode, selectedPath])

  // Breadcrumbs
  const breadcrumbs = React.useMemo(() => {
    return getNodeBreadcrumbs(rootNode, selectedPath)
  }, [rootNode, selectedPath])

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

  const setNodeText = (text: string) => {
    onUpdateNode(selectedPath, (node) => ({
      ...node,
      text,
      children: typeof node.children === "string" ? text : node.children,
    }))
  }

  const currentText =
    selectedNode.text !== undefined
      ? selectedNode.text
      : typeof selectedNode.children === "string"
        ? selectedNode.children
        : ""

  return (
    <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-md duration-150 fade-in">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-2xl animate-in flex-col overflow-hidden rounded-[min(var(--radius-4xl),28px)] border border-border/80 bg-card shadow-2xl duration-150 zoom-in-95"
      >
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
              <IconAdjustments className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">
                  &lt;{selectedNode.type}&gt;
                </h2>
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 font-mono text-[10px]"
                >
                  {isRoot ? "Root Node" : `Index [${selectedPath.join(", ")}]`}
                </Badge>
              </div>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                {breadcrumbs.map((b) => b.label).join(" / ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isRoot && onDuplicateNode && (
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => onDuplicateNode(selectedPath)}
                aria-label="Duplicate Node"
              >
                <IconCopy className="size-3.5" />
              </Button>
            )}
            {!isRoot && (
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onPress={() => {
                  onDeleteNode(selectedPath)
                  onClose()
                }}
                aria-label="Delete Node"
              >
                <IconTrash className="size-3.5" />
              </Button>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              onPress={onClose}
              aria-label="Close modal"
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </div>

        {/* 2. Tabs Navigation */}
        <div className="flex gap-2 border-b border-border/60 bg-muted/10 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "content"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconLayersLinked className="size-3.5" />
            <span>Content & Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("styling")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "styling"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconPalette className="size-3.5" />
            <span>Styling & Layout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("props")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "props"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconCode className="size-3.5" />
            <span>Raw Props JSON</span>
          </button>
        </div>

        {/* 3. Modal Body Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* TAB 1: Content & Text */}
          {activeTab === "content" && (
            <div className="animate-in space-y-4 duration-100 fade-in">
              {/* Component Type & Tag */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Component Type
                  </label>
                  <Input
                    value={selectedNode.type}
                    onChange={(e) => {
                      const newType = e.target.value
                      onUpdateNode(selectedPath, (node) => ({
                        ...node,
                        type: newType,
                      }))
                    }}
                    placeholder="e.g. Card, Callout, h1, p, CodeBlock"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Node Key (Optional)
                  </label>
                  <Input
                    value={
                      selectedNode.key !== undefined
                        ? String(selectedNode.key)
                        : ""
                    }
                    onChange={(e) => {
                      const keyVal = e.target.value
                      onUpdateNode(selectedPath, (node) => ({
                        ...node,
                        key: keyVal || undefined,
                      }))
                    }}
                    placeholder="e.g. doc-item-1"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Text / Content */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Text / Markdown Content
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    Direct text rendered inside this node
                  </span>
                </div>
                <Textarea
                  value={currentText}
                  onChange={(e) => setNodeText(e.target.value)}
                  placeholder="Enter text content or documentation copy..."
                  className="h-28 text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Styling & Layout */}
          {activeTab === "styling" && (
            <div className="animate-in space-y-5 duration-100 fade-in">
              {/* Variant and Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Variant
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {VARIANT_OPTIONS.map((opt) => (
                      <Button
                        key={opt}
                        size="xs"
                        variant={props.variant === opt ? "default" : "outline"}
                        onPress={() =>
                          setProp(
                            "variant",
                            props.variant === opt ? undefined : opt
                          )
                        }
                        className="text-[11px]"
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Size
                  </label>
                  <div className="flex gap-1.5">
                    {SIZE_OPTIONS.map((opt) => (
                      <Button
                        key={opt}
                        size="xs"
                        variant={props.size === opt ? "default" : "outline"}
                        onPress={() =>
                          setProp("size", props.size === opt ? undefined : opt)
                        }
                        className="flex-1 text-[11px] uppercase"
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* ClassName (Tailwind) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  CSS Class Name (Tailwind)
                </label>
                <Input
                  value={String(props.className || "")}
                  onChange={(e) => setProp("className", e.target.value)}
                  placeholder="e.g. p-6 rounded-2xl border bg-card max-w-3xl mx-auto space-y-4"
                  className="font-mono text-xs"
                />
              </div>

              {/* Icon Picker / Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Icon (Tabler Icon Name)
                </label>
                <Input
                  value={String(props.icon || "")}
                  onChange={(e) => setProp("icon", e.target.value)}
                  placeholder="e.g. IconBook, IconFileText, IconSparkles"
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {COMMON_ICONS.map((ic) => (
                    <Badge
                      key={ic}
                      variant={props.icon === ic ? "default" : "outline"}
                      className="cursor-pointer font-mono text-[10px] transition-colors hover:border-primary"
                      onClick={() =>
                        setProp("icon", props.icon === ic ? undefined : ic)
                      }
                    >
                      {ic.replace(/^Icon/, "")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Raw Props JSON */}
          {activeTab === "props" && (
            <div className="animate-in space-y-3 duration-100 fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">
                  Direct Node Properties (JSON Object)
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  props: &#123; ... &#125;
                </span>
              </div>

              {propsJsonError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                  JSON Error: {propsJsonError}
                </div>
              )}

              <Textarea
                defaultValue={JSON.stringify(selectedNode.props || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    onUpdateNode(selectedPath, (node) => ({
                      ...node,
                      props: parsed,
                    }))
                    setPropsJsonError(null)
                  } catch (err: any) {
                    setPropsJsonError(err.message)
                  }
                }}
                className="h-64 font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* 4. Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3.5">
          <span className="text-xs text-muted-foreground">
            Changes are saved live to the document.
          </span>
          <Button size="sm" variant="default" onPress={onClose}>
            <IconCheck className="me-1 size-3.5" />
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
