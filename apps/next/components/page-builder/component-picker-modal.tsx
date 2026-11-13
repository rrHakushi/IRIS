"use client"

import * as React from "react"
import { IconBook, IconSearch, IconSparkles, IconX } from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { resolveTablerIcon, type IrisNode } from "@/components/iris-page"
import { COMPONENT_PRESETS, type ComponentPresetItem } from "./catalog"

export interface ComponentPickerModalProps {
  isOpen: boolean
  title?: string
  description?: string
  positionLabel?: string // e.g. "Inside <div.layout-item>", "Above <Card>", "Under <Button>"
  onClose: () => void
  onSelectComponent: (node: IrisNode) => void
}

export function ComponentPickerModal({
  isOpen,
  title = "Choose Component",
  description,
  positionLabel,
  onClose,
  onSelectComponent,
}: ComponentPickerModalProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all")

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

  if (!isOpen) return null

  const filteredItems = COMPONENT_PRESETS.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) {
      return false
    }
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-md duration-150 fade-in">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[85vh] w-full max-w-2xl animate-in flex-col overflow-hidden rounded-[min(var(--radius-4xl),28px)] border border-border/80 bg-card shadow-2xl duration-150 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconBook className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                {positionLabel && (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 font-mono text-[10px]"
                  >
                    {positionLabel}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {description ||
                  "Select a section layout, container, or component to insert."}
              </p>
            </div>
          </div>

          <Button
            size="icon-xs"
            variant="ghost"
            onPress={onClose}
            aria-label="Close picker"
          >
            <IconX className="size-4" />
          </Button>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="space-y-3 border-b border-border/40 bg-muted/10 px-6 pt-4 pb-3">
          <div className="relative">
            <IconSearch className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              placeholder="Search components or sections (e.g. 3-column, hero, card, button)..."
              className="h-9 rounded-xl bg-background ps-9 text-xs"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "All Items" },
              { id: "docs", label: "Docs" },
              { id: "sections", label: "Sections" },
              { id: "blocks", label: "Blocks" },
              { id: "typography", label: "Typography" },
              { id: "forms", label: "Forms" },
              { id: "feedback", label: "Feedback" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Component Grid List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const IconComp = resolveTablerIcon(item.icon) || IconSparkles
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectComponent(item.getNode())
                    onClose()
                  }}
                  className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-background p-3.5 text-start transition-all duration-150 hover:border-primary/60 hover:bg-primary/5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 transition-colors group-hover:bg-primary/10">
                    <IconComp className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground transition-colors group-hover:text-primary">
                        {item.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="h-3.5 px-1 font-mono text-[9px] uppercase"
                      >
                        {item.category}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No components matching "{searchQuery}".
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3 text-[11px] text-muted-foreground">
          <span>Click any item to insert immediately.</span>
          <Button size="xs" variant="ghost" onPress={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
