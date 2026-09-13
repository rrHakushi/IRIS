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
  IconVariable,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { IrisPage, type IrisNode, type IrisPageSchema } from "@/components/iris-page"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"

import type { BuilderMode, NodePath, ViewportMode } from "./types"
import { BUILDER_TEMPLATES } from "./templates"
import { Canvas } from "./canvas"
import { NodePropertiesModal } from "./node-properties-modal"
import { ComponentPickerModal } from "./component-picker-modal"
import { StateManagerModal } from "./state-manager-modal"
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
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = React.useState(false)
  const [isStateModalOpen, setIsStateModalOpen] = React.useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false)
  const [importJsonText, setImportJsonText] = React.useState("")
  const [codeJsonText, setCodeJsonText] = React.useState(() => JSON.stringify(schema, null, 2))
  const [codeError, setCodeError] = React.useState<string | null>(null)

  // Auto-save draft to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(schema))
    } catch {
      // ignore
    }
  }, [schema])

  // Sync JSON text when switching to code mode
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
    (nextSchema: IrisPageSchema | ((prev: IrisPageSchema) => IrisPageSchema)) => {
      setSchema((current) => {
        const resolved = typeof nextSchema === "function" ? nextSchema(current) : nextSchema
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

  // Node manipulation handlers
  const handleInsertNode = React.useCallback(
    (newNode: IrisNode) => {
      commitSchema((prev) => {
        const targetPath = selectedPath.length > 0 ? selectedPath : []
        const { newRoot, newPath } = insertChildNode(prev.root, targetPath, newNode)
        setSelectedPath(newPath)
        return { ...prev, root: newRoot }
      })
      toast.success(`Added <${newNode.type}> to page`)
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
        const { newRoot, newPath } = insertNodeAdjacent(prev.root, targetPath, position, newNode)
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
        const { newRoot, newPath } = insertChildNode(prev.root, [], sectionNode)
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
          const { newRoot, newPath } = insertChildNode(prev.root, pickerTarget.path, newNode)
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
        root: updateNodeByPath(prev.root, path, updater),
      }))
    },
    [commitSchema]
  )

  const handleDeleteNode = React.useCallback(
    (path: NodePath) => {
      commitSchema((prev) => {
        const { newRoot, newPath } = deleteNodeByPath(prev.root, path)
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
        const { newRoot, newPath } = duplicateNodeByPath(prev.root, path)
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
        const { newRoot, newPath } = moveNodeByPath(prev.root, path, direction)
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
      const isClamped = currentCls.includes("max-w-") || currentCls.includes("mx-auto")
      let newCls = currentCls
      if (isClamped) {
        newCls = currentCls.replace(/\bmax-w-\S+\b/g, "").replace(/\bmx-auto\b/g, "").replace(/\s+/g, " ").trim()
        if (!newCls.includes("w-full")) newCls = `w-full ${newCls}`.trim()
        toast.success("Page stretched to 100% full width")
      } else {
        newCls = `max-w-7xl mx-auto ${newCls}`.replace(/\s+/g, " ").trim()
        toast.info("Page boxed to max-w-7xl")
      }
      return {
        ...prev,
        root: { ...prev.root, props: { ...(prev.root?.props || {}), className: newCls } },
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
    toast.success("Schema copied to clipboard!")
  }

  // Download JSON File
  const handleDownloadJson = () => {
    const json = JSON.stringify(schema, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(schema.title || "iris-page").toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Downloaded page schema JSON")
  }

  // Import JSON Submission
  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(importJsonText)
      if (!parsed.root || !parsed.root.type) {
        throw new Error("Invalid schema: missing 'root' element")
      }
      commitSchema(parsed)
      setIsImportModalOpen(false)
      setImportJsonText("")
      setSelectedPath([])
      toast.success("Schema successfully imported!")
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
      if (parsed.root && parsed.root.type) {
        setSchema(parsed)
        setCodeError(null)
      }
    } catch (err: any) {
      setCodeError(err.message)
    }
  }

  return (
    <div
      className={`flex w-full flex-col bg-background text-foreground overflow-hidden ${
        embedded
          ? "relative min-h-[650px] flex-1 rounded-[min(var(--radius-4xl),24px)] border border-border/60 shadow-lg"
          : "h-svh"
      }`}
    >
      {/* 1. Main Builder Studio Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-30">
        {/* Mode & Viewport Switchers */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("visual")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                mode === "visual"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconLayoutDashboard className="size-3.5" />
              <span>Builder</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                mode === "preview"
                  ? "bg-background text-foreground shadow-xs font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconEye className="size-3.5" />
              <span>Live Runtime</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("code")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                mode === "code"
                  ? "bg-background text-foreground shadow-xs font-semibold"
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
              <div className="hidden lg:flex items-center rounded-xl border border-border/60 bg-muted/40 p-1">
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
                <span className="hidden sm:inline">{isRootFullWidth ? "100% Stretched" : "Stretch Width"}</span>
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
                className="gap-1 text-xs text-primary border-primary/30 hover:bg-primary/10 hover:border-primary"
              >
                <IconPlus className="size-3.5 text-primary" />
                <span>Add Component</span>
              </Button>
            </div>
          )}
        </div>

        {/* Right: Actions, State, Undo/Redo & Export */}
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

          <div className="h-4 w-px bg-border/60 mx-1" />

          {/* State & Actions Manager */}
          <Button
            size="xs"
            variant="outline"
            onPress={() => setIsStateModalOpen(true)}
            className="gap-1 text-xs"
          >
            <IconVariable className="size-3.5 text-primary" />
            <span className="hidden md:inline">State & Actions</span>
          </Button>

          {/* Templates Dropdown / Picker */}
          <div className="relative group">
            <Button size="xs" variant="outline" className="gap-1 text-xs">
              <IconTemplate className="size-3.5" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
            <div className="invisible group-hover:visible group-focus-within:visible absolute end-0 top-full mt-1 w-56 rounded-2xl border border-border/80 bg-background/95 p-1 shadow-lg backdrop-blur-md z-50">
              <div className="p-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Starter Templates
              </div>
              {BUILDER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleLoadTemplate(tpl.id)}
                  className="flex w-full items-start gap-2 rounded-xl p-2 text-start text-xs hover:bg-muted/80 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-foreground">{tpl.name}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{tpl.description}</div>
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
                toast.success("Page schema saved successfully!")
              }}
              className="gap-1 bg-primary text-primary-foreground font-semibold"
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
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mode A: Visual Builder Canvas with Full Available Space */}
        {mode === "visual" && (
          <>
            <Canvas
              root={schema.root}
              state={schema.state}
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
                    const { newRoot, newPath } = insertChildNode(prev.root, parentPath, newNode)
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
          <div className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8 flex flex-col">
            <div
              className={`flex-1 transition-all duration-200 ${
                viewport === "mobile"
                  ? "max-w-sm mx-auto w-full"
                  : viewport === "tablet"
                    ? "max-w-2xl mx-auto w-full"
                    : "w-full"
              }`}
            >
              <div className="rounded-[min(var(--radius-4xl),24px)] border border-border/60 bg-card p-6 shadow-sm min-h-full flex flex-col">
                <IrisPage schema={schema} showEditButton={false} />
              </div>
            </div>
          </div>
        )}

        {/* Mode C: Raw JSON Code Editor */}
        {mode === "code" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 md:p-6 bg-muted/20">
            <div className="flex w-full flex-1 min-h-0 flex-col rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-card p-4 shadow-sm space-y-3">
              {codeError && (
                <div className="shrink-0 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-xs text-destructive">
                  Syntax Error: {codeError}
                </div>
              )}

              <div className="flex-1 min-h-0 w-full overflow-hidden">
                <Textarea
                  value={codeJsonText}
                  onChange={handleCodeJsonChange}
                  className="h-full w-full font-mono text-xs leading-relaxed resize-none rounded-xl border border-input/60 bg-muted/20 p-4 focus-visible:ring-primary overflow-auto whitespace-pre"
                  spellCheck={false}
                  aria-label="Raw JSON Schema Editor"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. State & Actions Modal */}
      <StateManagerModal
        isOpen={isStateModalOpen}
        schema={schema}
        onClose={() => setIsStateModalOpen(false)}
        onSave={(updated) => {
          commitSchema((prev) => ({
            ...prev,
            ...updated,
          }))
          toast.success("Page state and actions updated")
        }}
      />

      {/* 4. Import JSON Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="flex w-full max-w-xl flex-col rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-semibold">Import IrisPage JSON</h3>
                <p className="text-xs text-muted-foreground">Paste any valid IrisPage schema JSON to load into the builder studio.</p>
              </div>
              <Button size="icon-xs" variant="ghost" onPress={() => setIsImportModalOpen(false)} aria-label="Close">
                <IconX className="size-4" />
              </Button>
            </div>

            <Textarea
              value={importJsonText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportJsonText(e.target.value)}
              placeholder='Paste JSON schema here... { "title": "My Page", "root": { ... } }'
              className="h-64 font-mono text-xs rounded-xl"
              spellCheck={false}
              aria-label="Paste JSON Schema"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button size="sm" variant="ghost" onPress={() => setIsImportModalOpen(false)}>
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
