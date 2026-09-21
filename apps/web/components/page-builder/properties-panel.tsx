"use client"

import * as React from "react"
import {
  IconAdjustments,
  IconCode,
  IconEye,
  IconHandClick,
  IconLayersLinked,
  IconPalette,
  IconSparkles,
  IconTrash,
  IconVariable,
} from "@tabler/icons-react"

import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import type { IrisNode, IrisPageSchema } from "@/components/iris-page"
import type { NodePath } from "./types"
import { getNodeByPath } from "./ast-utils"

interface PropertiesPanelProps {
  schema: IrisPageSchema
  selectedPath: NodePath
  onUpdateNode: (path: NodePath, updater: (node: IrisNode) => IrisNode) => void
  onDeleteNode: (path: NodePath) => void
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

export function PropertiesPanel({
  schema,
  selectedPath,
  onUpdateNode,
  onDeleteNode,
}: PropertiesPanelProps) {
  const selectedNode = React.useMemo(() => {
    return getNodeByPath(
      schema.root || { type: "div", children: [] },
      selectedPath
    )
  }, [schema.root, selectedPath])

  if (!selectedNode) {
    return (
      <aside className="flex h-full w-80 flex-col items-center justify-center border-s border-border/60 bg-card/60 p-6 text-center text-muted-foreground backdrop-blur-md">
        <IconAdjustments className="mb-2 size-8 stroke-[1.5] text-muted-foreground/60" />
        <h3 className="text-sm font-semibold text-foreground">
          No Element Selected
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Click any component in the visual canvas to configure its properties,
          styles, and events.
        </p>
      </aside>
    )
  }

  const props = selectedNode.props || {}
  const isRoot = selectedPath.length === 0

  // Helper to update a single prop
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

  // Helper to update children text
  const setChildrenText = (text: string) => {
    onUpdateNode(selectedPath, (node) => ({
      ...node,
      children: text,
    }))
  }

  // Determine if node has simple text children
  const isSimpleTextChild =
    typeof selectedNode.children === "string" ||
    typeof selectedNode.children === "number"

  return (
    <aside className="flex h-full w-80 flex-col border-s border-border/60 bg-card/60 backdrop-blur-md">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border/40 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="h-5 px-2 font-mono text-xs">
            &lt;{selectedNode.type}&gt;
          </Badge>
          <span className="text-xs text-muted-foreground">Properties</span>
        </div>
        {!isRoot && (
          <Button
            size="icon-xs"
            variant="ghost"
            onPress={() => onDeleteNode(selectedPath)}
            className="text-destructive hover:bg-destructive/10"
            aria-label="Delete node"
          >
            <IconTrash className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-xs">
        {/* 1. Text Content Editor */}
        {isSimpleTextChild && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span>Text / Markdown Content</span>
            </label>
            <Input
              value={String(selectedNode.children ?? "")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setChildrenText(e.target.value)
              }
              placeholder="Enter text content..."
              className="h-8 rounded-xl text-xs"
              aria-label="Text content"
            />
          </div>
        )}

        {/* 2. Visual Variants & Sizes */}
        <div className="space-y-3">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Appearance
          </span>

          {/* Variant Selector */}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Variant</label>
            <div className="flex flex-wrap gap-1">
              {VARIANT_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setProp("variant", v === props.variant ? undefined : v)
                  }
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    props.variant === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Size</label>
            <div className="flex gap-1">
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setProp("size", s === props.size ? undefined : s)
                  }
                  className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                    props.size === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ClassName Editor */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <IconPalette className="size-3" />
              <span>Tailwind CSS Classes</span>
            </label>
            <Input
              value={String(props.className || "")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProp("className", e.target.value)
              }
              placeholder="e.g. flex items-center gap-2 p-4"
              className="h-8 rounded-xl font-mono text-xs"
              aria-label="Tailwind CSS classes"
            />
          </div>
        </div>

        <Separator />

        {/* 4. Slot & Icon Picker */}
        {selectedNode.type === "Icon" ? (
          <div className="space-y-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <IconSparkles className="size-3 text-primary" />
              <span>Tabler Icon Name</span>
            </span>
            <Input
              value={String(props.name || "")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProp("name", e.target.value)
              }
              placeholder="IconSparkles"
              className="h-8 rounded-xl font-mono text-xs"
              aria-label="Icon name"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {COMMON_ICONS.slice(0, 10).map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setProp("name", icon)}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                    props.name === icon
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {icon.replace("Icon", "")}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 4b. HTML Element Attributes */}
        {["a", "img", "video", "iframe", "input"].includes(
          selectedNode.type.toLowerCase()
        ) && (
          <div className="space-y-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <IconCode className="size-3 text-primary" />
              <span>HTML Attributes</span>
            </span>
            {(selectedNode.type.toLowerCase() === "a" ||
              selectedNode.type.toLowerCase() === "img" ||
              selectedNode.type.toLowerCase() === "video" ||
              selectedNode.type.toLowerCase() === "iframe") && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  {selectedNode.type.toLowerCase() === "a"
                    ? "Link Href"
                    : "Source URL (src)"}
                </label>
                <Input
                  value={String(props.href || props.src || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProp(
                      selectedNode.type.toLowerCase() === "a" ? "href" : "src",
                      e.target.value
                    )
                  }
                  placeholder="https://..."
                  className="h-8 rounded-xl font-mono text-xs"
                  aria-label="URL"
                />
              </div>
            )}
            {selectedNode.type.toLowerCase() === "img" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Alt Description
                </label>
                <Input
                  value={String(props.alt || "")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProp("alt", e.target.value)
                  }
                  placeholder="Image description..."
                  className="h-8 rounded-xl text-xs"
                  aria-label="Alt description"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
