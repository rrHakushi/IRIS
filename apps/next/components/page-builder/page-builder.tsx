"use client"

import * as React from "react"
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsMaximize,
  IconBoxPadding,
  IconCode,
  IconCopy,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDownload,
  IconEye,
  IconLayoutDashboard,
  IconPlus,
  IconTemplate,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  IrisPage,
  type IrisNode,
  type IrisPageSchema,
} from "@/components/iris-page"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"

import type { BuilderMode, NodePath, ViewportMode } from "./types"
import { BUILDER_TEMPLATES } from "./templates"
import { Canvas } from "./canvas"
import { NodePropertiesModal } from "./node-properties-modal"
import { ComponentPickerModal } from "./component-picker-modal"
import {
  createSectionPreset,
  deleteNodeByPath,
  duplicateNodeByPath,
  insertChildNode,
  insertNodeAdjacent,
  moveNodeByPath,
  type SectionPresetType,
  updateNodeByPath,
} from "./ast-utils"

const DRAFT_STORAGE_KEY = "iris_page_builder_draft"

export interface PageBuilderProps {
  initialSchema?: IrisPageSchema
  onExit?: () => void
  onSave?: (schema: IrisPageSchema) => void
  embedded?: boolean
}

export function PageBuilder({
  initialSchema,
  onExit,
  onSave,
  embedded = false,
}: PageBuilderProps = {}) {
  // 1. Schema & History State
  const [schema, setSchema] = React.useState<IrisPageSchema>(() => {
    if (initialSchema) return initialSchema
    if (typeof window !== "undefined") {
      try {
        const editSession = sessionStorage.getItem("iris_page_builder_edit")
        if (editSession) {
          sessionStorage.removeItem("iris_page_builder_edit")
          return JSON.parse(editSession)
        }
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
        if (saved) return JSON.parse(saved)
      } catch {
        // ignore
      }
    }
    return BUILDER_TEMPLATES[0]!.schema
  })

  // Undo / Redo history stacks
  const [past, setPast] = React.useState<IrisPageSchema[]>([])
  const [future, setFuture] = React.useState<IrisPageSchema[]>([])

  // Selection & UI Mode State
  const [selectedPath, setSelectedPath] = React.useState<NodePath>([])
  const [mode, setMode] = React.useState<BuilderMode>("visual")
  const [viewport, setViewport] = React.useState<ViewportMode>("desktop")
  const [wireframeMode, setWireframeMode] = React.useState<boolean>(true)
  const [pickerTarget, setPickerTarget] = React.useState<{
    path: NodePath
    position: "inside" | "above" | "below"
  } | null>(null)
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] =
    React.useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false)
  const [importJsonText, setImportJsonText] = React.useState("")
  const [codeJsonText, setCodeJsonText] = React.useState(() =>
    JSON.stringify(schema, null, 2)
  )
  const [codeError, setCodeError] = React.useState<string | null>(null)

  // Auto-save draft to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(schema))
    } catch {
      // ignore
    }
  }, [schema])

  // Sync JSON text when switching to code mode or schema changes
  React.useEffect(() => {
    if (mode === "code") {
      setCodeJsonText(JSON.stringify(schema, null, 2))
      setCodeError(null)
    }
  }, [mode, schema])

  /**
   * Commit a new schema with history recording.
   */
  const commitSchema = React.useCallback(
    (
      nextSchema: IrisPageSchema | ((prev: IrisPageSchema) => IrisPageSchema)
    ) => {
      setSchema((current) => {
        const resolved =
          typeof nextSchema === "function" ? nextSchema(current) : nextSchema
        setPast((p) => [...p.slice(-25), current])
        setFuture([])
        return resolved
      })
    },
    []
  )

  // Undo / Redo handlers
  const handleUndo = React.useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    if (!previous) return

    setPast((p) => p.slice(0, -1))
    setFuture((f) => [schema, ...f])
    setSchema(previous)
    toast.info("Undo")
  }, [past, schema])

  const handleRedo = React.useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    if (!next) return

    setFuture((f) => f.slice(1))
    setPast((p) => [...p, schema])
    setSchema(next)
    toast.info("Redo")
  }, [future, schema])

  // Safe root accessor
  const getSafeRoot = (s: IrisPageSchema): IrisNode =>
    s.root || { type: "div", children: [] }

  // Node manipulation handlers
  const handleInsertNode = React.useCallback(
    (newNode: IrisNode) => {
      commitSchema((prev) => {
        const targetPath = selectedPath.length > 0 ? selectedPath : []
        const { newRoot, newPath } = insertChildNode(
          getSafeRoot(prev),
          targetPath,
          newNode
        )
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
      toast.success(`Added <${newNode.type}> to document`)
    },
    [commitSchema, selectedPath]
  )

  const handleInsertAdjacent = React.useCallback(
    (targetPath: NodePath, position: "above" | "below", newNode?: IrisNode) => {
      if (!newNode) {
        setPickerTarget({ path: targetPath, position })
        return
      }
      commitSchema((prev) => {
        const { newRoot, newPath } = insertNodeAdjacent(
          getSafeRoot(prev),
          targetPath,
          position,
          newNode
        )
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
      toast.success(`Inserted <${newNode.type}> ${position}`)
    },
    [commitSchema]
  )

  const handleAddSection = React.useCallback(
    (type: SectionPresetType = "3-col") => {
      const sectionNode = createSectionPreset(type)
      commitSchema((prev) => {
        const { newRoot, newPath } = insertChildNode(
          getSafeRoot(prev),
          [],
          sectionNode
        )
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
      toast.success(`Added ${type} section`)
    },
    [commitSchema]
  )

  const handleSelectPickerComponent = React.useCallback(
    (newNode: IrisNode) => {
      if (!pickerTarget) return
      if (pickerTarget.position === "inside") {
        commitSchema((prev) => {
          const { newRoot, newPath } = insertChildNode(
            getSafeRoot(prev),
            pickerTarget.path,
            newNode
          )
          setSelectedPath(newPath)
          return { ...prev, root: newRoot }
        })
        toast.success(`Added <${newNode.type}>`)
      } else {
        handleInsertAdjacent(pickerTarget.path, pickerTarget.position, newNode)
      }
      setPickerTarget(null)
    },
    [pickerTarget, commitSchema, handleInsertAdjacent]
  )

  const handleUpdateNode = React.useCallback(
    (path: NodePath, updater: (node: IrisNode) => IrisNode) => {
      commitSchema((prev) => ({
        ...prev,
        root: updateNodeByPath(getSafeRoot(prev), path, updater),
      }))
    },
    [commitSchema]
  )

  const handleDeleteNode = React.useCallback(
    (path: NodePath) => {
      commitSchema((prev) => {
        const { newRoot, newPath } = deleteNodeByPath(getSafeRoot(prev), path)
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
      toast.info("Node deleted")
    },
    [commitSchema]
  )

  const handleDuplicateNode = React.useCallback(
    (path: NodePath) => {
      commitSchema((prev) => {
        const { newRoot, newPath } = duplicateNodeByPath(
          getSafeRoot(prev),
          path
        )
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
      toast.success("Node duplicated")
    },
    [commitSchema]
  )

  const handleMoveNode = React.useCallback(
    (path: NodePath, direction: "up" | "down") => {
      commitSchema((prev) => {
        const { newRoot, newPath } = moveNodeByPath(
          getSafeRoot(prev),
          path,
          direction
        )
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
    },
    [commitSchema]
  )

  // Root container width toggle (100% full width vs boxed max-w-7xl)
  const isRootFullWidth = React.useMemo(() => {
    const cls = String(schema.root?.props?.className || "")
    return !cls.includes("max-w-") && !cls.includes("mx-auto")
  }, [schema.root])

  const handleToggleFullWidth = React.useCallback(() => {
    commitSchema((prev) => {
      const currentCls = String(prev.root?.props?.className || "")
      const isClamped =
        currentCls.includes("max-w-") || currentCls.includes("mx-auto")
      let newCls = currentCls
      if (isClamped) {
        newCls = currentCls
          .replace(/\bmax-w-\S+\b/g, "")
          .replace(/\bmx-auto\b/g, "")
          .replace(/\s+/g, " ")
          .trim()
        if (!newCls.includes("w-full")) newCls = `w-full ${newCls}`.trim()
        toast.success("Document stretched to 100% full width")
      } else {
        newCls = `max-w-7xl mx-auto ${newCls}`.replace(/\s+/g, " ").trim()
        toast.info("Document boxed to max-w-7xl")
      }
      return {
        ...prev,
        root: {
          ...(prev.root || { type: "div", children: [] }),
          props: { ...(prev.root?.props || {}), className: newCls },
        },
      }
    })
  }, [commitSchema])

  // Template loader
  const handleLoadTemplate = (templateId: string) => {
    const tpl = BUILDER_TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return
    commitSchema(tpl.schema)
    setSelectedPath([])
    toast.success(`Loaded "${tpl.name}" template`)
  }

  // Export JSON to Clipboard
  const handleCopyJson = () => {
    const json = JSON.stringify(schema, null, 2)
    navigator.clipboard.writeText(json)
    toast.success("Document schema copied to clipboard!")
  }

  // Download JSON File
  const handleDownloadJson = () => {
    const json = JSON.stringify(schema, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(schema.title || "document").toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Downloaded document schema JSON")
  }

  // Import JSON Submission
  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(importJsonText)
      if (!parsed.root) {
        throw new Error("Invalid schema: missing 'root' element")
      }
      commitSchema(parsed)
      setIsImportModalOpen(false)
      setImportJsonText("")
      setSelectedPath([])
      toast.success("Document schema successfully imported!")
    } catch (err: any) {
      toast.error("Import failed: " + err.message)
    }
  }

  // Apply Code Mode JSON edits
  const handleCodeJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setCodeJsonText(text)
    try {
      const parsed = JSON.parse(text)
      if (parsed.root) {
        setSchema(parsed)
        setCodeError(null)
      }
    } catch (err: any) {
      setCodeError(err.message)
    }
  }

  return (
    <div
      className={`flex w-full flex-col overflow-hidden bg-background text-foreground ${
        embedded
          ? "relative min-h-[650px] flex-1 rounded-[min(var(--radius-4xl),24px)] border border-border/60 shadow-lg"
          : "h-svh"
      }`}
    >
      {/* 1. Main Builder Studio Top Bar */}
      <header className="z-30 flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
        {/* Mode & Viewport Switchers */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("visual")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                mode === "visual"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconLayoutDashboard className="size-3.5" />
              <span>Builder</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                mode === "preview"
                  ? "bg-background font-semibold text-foreground text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconEye className="size-3.5" />
              <span>Live Runtime</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("code")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                mode === "code"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconCode className="size-3.5" />
              <span>JSON Schema</span>
            </button>
          </div>

          {/* Viewport Width Controls (in visual mode) */}
          {mode === "visual" && (
            <div className="flex items-center gap-1.5">
              <div className="hidden items-center rounded-xl border border-border/60 bg-muted/40 p-1 lg:flex">
                <Button
                  size="icon-xs"
                  variant={viewport === "desktop" ? "default" : "ghost"}
                  onPress={() => setViewport("desktop")}
                  aria-label="Desktop viewport"
                >
                  <IconDeviceDesktop className="size-3.5" />
                </Button>
                <Button
                  size="icon-xs"
                  variant={viewport === "tablet" ? "default" : "ghost"}
                  onPress={() => setViewport("tablet")}
                  aria-label="Tablet viewport"
                >
                  <IconDeviceTablet className="size-3.5" />
                </Button>
                <Button
                  size="icon-xs"
                  variant={viewport === "mobile" ? "default" : "ghost"}
                  onPress={() => setViewport("mobile")}
                  aria-label="Mobile viewport"
                >
                  <IconDeviceMobile className="size-3.5" />
                </Button>
              </div>

              <Button
                size="xs"
                variant={wireframeMode ? "default" : "outline"}
                onPress={() => setWireframeMode(!wireframeMode)}
                className="gap-1 text-xs"
                aria-label="Toggle Wireframes"
              >
                <IconBoxPadding className="size-3.5" />
                <span className="hidden sm:inline">Wireframes</span>
              </Button>

              <Button
                size="xs"
                variant={isRootFullWidth ? "default" : "outline"}
                onPress={handleToggleFullWidth}
                className="gap-1 text-xs"
                aria-label="Toggle Full Width"
              >
                <IconArrowsMaximize className="size-3.5" />
                <span className="hidden sm:inline">
                  {isRootFullWidth ? "100% Stretched" : "Stretch Width"}
                </span>
              </Button>

              <Button
                size="xs"
                variant="outline"
                onPress={() => {
                  setPickerTarget({
                    path: selectedPath.length > 0 ? selectedPath : [],
                    position: "inside",
                  })
                }}
                className="gap-1 border-primary/30 text-xs text-primary hover:border-primary hover:bg-primary/10"
              >
                <IconPlus className="size-3.5 text-primary" />
                <span>Add Component</span>
              </Button>
            </div>
          )}
        </div>

        {/* Right: Undo/Redo, Templates, Export & Save */}
        <div className="flex items-center gap-1.5">
          {/* Undo / Redo */}
          <Button
            size="icon-xs"
            variant="ghost"
            isDisabled={past.length === 0}
            onPress={handleUndo}
            aria-label="Undo"
          >
            <IconArrowBackUp className="size-3.5" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            isDisabled={future.length === 0}
            onPress={handleRedo}
            aria-label="Redo"
          >
            <IconArrowForwardUp className="size-3.5" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border/60" />

          {/* Templates Dropdown / Picker */}
          <div className="group relative">
            <Button size="xs" variant="outline" className="gap-1 text-xs">
              <IconTemplate className="size-3.5" />
              <span className="hidden sm:inline">Doc Templates</span>
            </Button>
            <div className="invisible absolute end-0 top-full z-50 mt-1 w-60 rounded-2xl border border-border/80 bg-background/95 p-1 shadow-lg backdrop-blur-md group-focus-within:visible group-hover:visible">
              <div className="p-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Document Templates
              </div>
              {BUILDER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleLoadTemplate(tpl.id)}
                  className="flex w-full items-start gap-2 rounded-xl p-2 text-start text-xs transition-colors hover:bg-muted/80"
                >
                  <div>
                    <div className="font-semibold text-foreground">
                      {tpl.name}
                    </div>
                    <div className="line-clamp-1 text-[11px] text-muted-foreground">
                      {tpl.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Import / Export */}
          <Button
            size="xs"
            variant="outline"
            onPress={() => setIsImportModalOpen(true)}
            aria-label="Import Schema JSON"
          >
            <IconUpload className="size-3.5" />
          </Button>

          <Button
            size="xs"
            variant="outline"
            onPress={handleCopyJson}
            aria-label="Copy JSON to Clipboard"
          >
            <IconCopy className="size-3.5" />
          </Button>

          <Button
            size="xs"
            variant="default"
            onPress={handleDownloadJson}
            className="gap-1"
          >
            <IconDownload className="size-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Save Button (when onSave handler is provided) */}
          {onSave && (
            <Button
              size="xs"
              variant="default"
              onPress={() => {
                onSave(schema)
                toast.success("Document saved successfully!")
              }}
              className="gap-1 bg-primary font-semibold text-primary-foreground"
            >
              <IconDeviceFloppy className="size-3.5" />
              <span>Save</span>
            </Button>
          )}

          {/* Exit In-Place Editor Button */}
          {onExit && (
            <Button
              size="xs"
              variant="outline"
              onPress={onExit}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-3.5" />
              <span>Exit</span>
            </Button>
          )}
        </div>
      </header>

      {/* 2. Workspace Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Mode A: Visual Builder Canvas with Full Available Space */}
        {mode === "visual" && (
          <>
            <Canvas
              root={getSafeRoot(schema)}
              selectedPath={selectedPath}
              viewport={viewport}
              wireframeMode={wireframeMode}
              onSelectPath={setSelectedPath}
              onMoveNode={handleMoveNode}
              onDuplicateNode={handleDuplicateNode}
              onDeleteNode={handleDeleteNode}
              onInsertChild={(parentPath, newNode) => {
                if (newNode) {
                  commitSchema((prev) => {
                    const { newRoot, newPath } = insertChildNode(
                      getSafeRoot(prev),
                      parentPath,
                      newNode
                    )
                    setSelectedPath(newPath)
                    return { ...prev, root: newRoot }
                  })
                  toast.success(`Added <${newNode.type}>`)
                } else {
                  setPickerTarget({ path: parentPath, position: "inside" })
                }
              }}
              onInsertAdjacent={handleInsertAdjacent}
              onOpenProperties={(path) => {
                setSelectedPath(path)
                setIsPropertiesModalOpen(true)
              }}
              onOpenPicker={(path, position) => {
                setPickerTarget({ path, position })
              }}
              onAddSection={(type) => {
                if (type) handleAddSection(type)
                else setPickerTarget({ path: [], position: "below" })
              }}
              onToggleRootWidth={handleToggleFullWidth}
            />
            <NodePropertiesModal
              isOpen={isPropertiesModalOpen}
              schema={schema}
              selectedPath={selectedPath}
              onClose={() => setIsPropertiesModalOpen(false)}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
            />
            <ComponentPickerModal
              isOpen={pickerTarget !== null}
              positionLabel={
                pickerTarget
                  ? pickerTarget.position === "inside"
                    ? "Inside Layout Slot"
                    : pickerTarget.position === "above"
                      ? "Insert Above"
                      : "Insert Under"
                  : undefined
              }
              onClose={() => setPickerTarget(null)}
              onSelectComponent={handleSelectPickerComponent}
            />
          </>
        )}

        {/* Mode B: Live Interactive Preview */}
        {mode === "preview" && (
          <div className="flex flex-1 flex-col overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8">
            <div
              className={`flex-1 transition-all duration-200 ${
                viewport === "mobile"
                  ? "mx-auto w-full max-w-sm"
                  : viewport === "tablet"
                    ? "mx-auto w-full max-w-2xl"
                    : "w-full"
              }`}
            >
              <div className="flex min-h-full flex-col rounded-[min(var(--radius-4xl),24px)] border border-border/60 bg-card p-6 shadow-sm">
                <IrisPage schema={schema} showEditButton={false} />
              </div>
            </div>
          </div>
        )}

        {/* Mode C: Raw JSON Code Editor */}
        {mode === "code" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 p-4 md:p-6">
            <div className="flex min-h-0 w-full flex-1 flex-col space-y-3 rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-card p-4 shadow-sm">
              {codeError && (
                <div className="shrink-0 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                  Syntax Error: {codeError}
                </div>
              )}

              <div className="min-h-0 w-full flex-1 overflow-hidden">
                <Textarea
                  value={codeJsonText}
                  onChange={handleCodeJsonChange}
                  className="h-full w-full resize-none overflow-auto rounded-xl border border-input/60 bg-muted/20 p-4 font-mono text-xs leading-relaxed whitespace-pre focus-visible:ring-primary"
                  spellCheck={false}
                  aria-label="Raw JSON Schema Editor"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Import JSON Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 p-4 backdrop-blur-xs duration-100 fade-in">
          <div className="flex w-full max-w-xl flex-col space-y-4 rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-semibold">Import Document JSON</h3>
                <p className="text-xs text-muted-foreground">
                  Paste any valid IrisPage schema JSON to load into the builder
                  studio.
                </p>
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                onPress={() => setIsImportModalOpen(false)}
                aria-label="Close"
              >
                <IconX className="size-4" />
              </Button>
            </div>

            <Textarea
              value={importJsonText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setImportJsonText(e.target.value)
              }
              placeholder='Paste JSON schema here... { "title": "My Document", "root": { ... } }'
              className="h-64 rounded-xl font-mono text-xs"
              spellCheck={false}
              aria-label="Paste JSON Schema"
            />

            <div className="flex justify-end gap-2 border-t border-border/40 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setIsImportModalOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" variant="default" onPress={handleApplyImport}>
                Import Schema
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
