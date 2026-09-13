"use client"

import * as React from "react"
import { IconPlus, IconTrash, IconVariable, IconX } from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import type { IrisPageSchema } from "@/components/iris-page"

interface StateManagerModalProps {
  isOpen: boolean
  schema: IrisPageSchema
  onClose: () => void
  onSave: (updated: Partial<IrisPageSchema>) => void
}

export function StateManagerModal({
  isOpen,
  schema,
  onClose,
  onSave,
}: StateManagerModalProps) {
  const [title, setTitle] = React.useState(schema.title || "")
  const [description, setDescription] = React.useState(schema.description || "")

  // Local state key-value pairs
  const [statePairs, setStatePairs] = React.useState<Array<{ key: string; value: string; type: string }>>(() => {
    return Object.entries(schema.state || {}).map(([k, v]) => ({
      key: k,
      value: typeof v === "object" ? JSON.stringify(v) : String(v),
      type: typeof v,
    }))
  })

  // Local action key-value pairs
  const [actionPairs, setActionPairs] = React.useState<Array<{ name: string; script: string }>>(() => {
    return Object.entries(schema.actions || {}).map(([k, v]) => ({
      name: k,
      script: String(v),
    }))
  })

  // Sync with schema on open
  React.useEffect(() => {
    if (isOpen) {
      setTitle(schema.title || "")
      setDescription(schema.description || "")
      setStatePairs(
        Object.entries(schema.state || {}).map(([k, v]) => ({
          key: k,
          value: typeof v === "object" ? JSON.stringify(v) : String(v),
          type: typeof v,
        }))
      )
      setActionPairs(
        Object.entries(schema.actions || {}).map(([k, v]) => ({
          name: k,
          script: String(v),
        }))
      )
    }
  }, [isOpen, schema])

  if (!isOpen) return null

  const handleAddState = () => {
    setStatePairs((prev) => [...prev, { key: `var_${Date.now().toString().slice(-4)}`, value: "0", type: "number" }])
  }

  const handleAddAction = () => {
    setActionPairs((prev) => [...prev, { name: `action_${Date.now().toString().slice(-4)}`, script: "toast.success('Action executed!');" }])
  }

  const handleSaveAll = () => {
    // Reconstruct state object
    const nextState: Record<string, any> = {}
    for (const pair of statePairs) {
      if (!pair.key.trim()) continue
      let parsed: any = pair.value
      if (pair.type === "number") {
        parsed = Number(pair.value) || 0
      } else if (pair.type === "boolean") {
        parsed = pair.value === "true"
      } else if (pair.type === "object") {
        try {
          parsed = JSON.parse(pair.value)
        } catch {
          parsed = pair.value
        }
      }
      nextState[pair.key.trim()] = parsed
    }

    // Reconstruct actions object
    const nextActions: Record<string, string> = {}
    for (const act of actionPairs) {
      if (!act.name.trim()) continue
      nextActions[act.name.trim()] = act.script
    }

    onSave({
      title,
      description,
      state: nextState,
      actions: nextActions,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="flex w-full max-w-2xl flex-col max-h-[85vh] rounded-[min(var(--radius-4xl),24px)] border border-border/80 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconVariable className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Page State & Actions Manager</h2>
              <p className="text-xs text-muted-foreground">Configure initial reactive state and named action scripts</p>
            </div>
          </div>
          <Button size="icon-xs" variant="ghost" onPress={onClose} aria-label="Close modal">
            <IconX className="size-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Metadata */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Metadata</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Page Title</label>
                <Input
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="My Custom Page"
                  className="h-8 text-xs rounded-xl"
                  aria-label="Page title"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Description</label>
                <Input
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="h-8 text-xs rounded-xl"
                  aria-label="Page description"
                />
              </div>
            </div>
          </div>

          {/* Reactive State Variables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Initial Reactive State (state.*)
                </h3>
                <p className="text-[11px] text-muted-foreground">Variables initialized when this page loads</p>
              </div>
              <Button size="xs" variant="outline" onPress={handleAddState} className="gap-1">
                <IconPlus className="size-3" />
                Add Variable
              </Button>
            </div>

            <div className="space-y-2">
              {statePairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-muted/20">
                  <Input
                    value={pair.key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value
                      setStatePairs((prev) => prev.map((p, i) => (i === idx ? { ...p, key: val } : p)))
                    }}
                    placeholder="keyName"
                    className="h-7 text-xs font-mono w-1/3 rounded-lg"
                    aria-label="Variable name"
                  />

                  <select
                    value={pair.type}
                    onChange={(e) => {
                      const t = e.target.value
                      setStatePairs((prev) => prev.map((p, i) => (i === idx ? { ...p, type: t } : p)))
                    }}
                    className="h-7 rounded-lg border border-input/60 bg-background px-2 text-xs"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="object">object/array</option>
                  </select>

                  <Input
                    value={pair.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value
                      setStatePairs((prev) => prev.map((p, i) => (i === idx ? { ...p, value: val } : p)))
                    }}
                    placeholder="Initial value"
                    className="h-7 text-xs font-mono flex-1 rounded-lg"
                    aria-label="Variable value"
                  />

                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onPress={() => setStatePairs((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-destructive hover:bg-destructive/10"
                    aria-label="Delete variable"
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </div>
              ))}

              {statePairs.length === 0 && (
                <div className="p-4 text-center rounded-xl border border-dashed text-xs text-muted-foreground">
                  No state variables declared. Click "Add Variable" to create one.
                </div>
              )}
            </div>
          </div>

          {/* Named Action Scripts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Named Actions (actions.*)
                </h3>
                <p className="text-[11px] text-muted-foreground">Reusable async scripts callable from buttons and events</p>
              </div>
              <Button size="xs" variant="outline" onPress={handleAddAction} className="gap-1">
                <IconPlus className="size-3" />
                Add Action
              </Button>
            </div>

            <div className="space-y-3">
              {actionPairs.map((act, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Input
                      value={act.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value
                        setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, name: val } : a)))
                      }}
                      placeholder="actionName"
                      className="h-7 text-xs font-mono w-48 rounded-lg"
                      aria-label="Action name"
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onPress={() => setActionPairs((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-destructive hover:bg-destructive/10"
                      aria-label="Delete action"
                    >
                      <IconTrash className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={act.script}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      const val = e.target.value
                      setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, script: val } : a)))
                    }}
                    placeholder="write script e.g. await elysia.auth.me.get(); toast.success('Loaded!');"
                    className="h-16 text-xs font-mono resize-none rounded-lg"
                    aria-label="Action script body"
                  />
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const existing = act.script.trim()
                        const snippet = "set('counter', state.counter + 1);"
                        const updated = existing ? `${existing}\n${snippet}` : snippet
                        setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, script: updated } : a)))
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background hover:bg-muted text-muted-foreground border border-border/40"
                    >
                      + set()
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = act.script.trim()
                        const snippet = "toggle('isOpen');"
                        const updated = existing ? `${existing}\n${snippet}` : snippet
                        setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, script: updated } : a)))
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background hover:bg-muted text-muted-foreground border border-border/40"
                    >
                      + toggle()
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = act.script.trim()
                        const snippet = "toast.success('Action executed!');"
                        const updated = existing ? `${existing}\n${snippet}` : snippet
                        setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, script: updated } : a)))
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background hover:bg-muted text-muted-foreground border border-border/40"
                    >
                      + toast()
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = act.script.trim()
                        const snippet = "const res = await elysia.auth.me.get();"
                        const updated = existing ? `${existing}\n${snippet}` : snippet
                        setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, script: updated } : a)))
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background hover:bg-muted text-muted-foreground border border-border/40"
                    >
                      + elysia.api
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = act.script.trim()
                        const snippet = "emit('customEvent', { state });"
                        const updated = existing ? `${existing}\n${snippet}` : snippet
                        setActionPairs((prev) => prev.map((a, i) => (i === idx ? { ...a, script: updated } : a)))
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background hover:bg-muted text-muted-foreground border border-border/40"
                    >
                      + emit(host)
                    </button>
                  </div>
                </div>
              ))}

              {actionPairs.length === 0 && (
                <div className="p-4 text-center rounded-xl border border-dashed text-xs text-muted-foreground">
                  No named actions declared.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 p-4">
          <Button size="sm" variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="default" onPress={handleSaveAll}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
