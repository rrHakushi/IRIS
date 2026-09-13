import * as React from "react"
import type { IrisSlot, IrisPropValue, SandboxContext } from "./types"
import { evaluateExpression, executeScript, getByPath } from "./sandbox"

/**
 * Type guard to check if an object is an IrisSlot descriptor.
 */
export function isIrisSlot(val: any): val is IrisSlot {
  return typeof val === "object" && val !== null && "$slot" in val
}

/**
 * Resolves raw JSON properties into standard React props:
 * - String interpolations & dynamic expressions: "{{ state.count }}"
 * - Event handlers: "onPress", "onClick", "onChange" -> sandboxed async execution
 * - Slots: { $slot: IrisNode } -> React elements
 * - Two-way state bindings: "bind: 'state.name'", "bindChecked: 'state.enabled'"
 */
export function resolveProps(
  rawProps: Record<string, IrisPropValue> | undefined,
  context: SandboxContext,
  renderSubtree: (node: any) => React.ReactNode
): Record<string, any> {
  if (!rawProps) return {}
  const resolved: Record<string, any> = {}

  // 1. Two-way data binding shorthand: `bind: "state.field"`
  if (typeof rawProps.bind === "string") {
    const bindPath = rawProps.bind
    resolved.value = getByPath(context, bindPath) ?? ""
    resolved.onChange = (valOrEvent: any) => {
      const value = valOrEvent && typeof valOrEvent === "object" && "target" in valOrEvent
        ? valOrEvent.target.value
        : valOrEvent
      context.set(bindPath, value)
    }
  }

  // 2. Two-way boolean checked binding shorthand: `bindChecked: "state.toggleField"`
  if (typeof rawProps.bindChecked === "string") {
    const bindPath = rawProps.bindChecked
    resolved.isSelected = !!getByPath(context, bindPath)
    resolved.defaultSelected = !!getByPath(context, bindPath)
    resolved.onChange = (isSelected: boolean) => {
      context.set(bindPath, isSelected)
    }
  }

  // 3. Normalize shadcn conventions to React Aria Components primitives
  if (rawProps.defaultValue !== undefined && rawProps.defaultSelectedKey === undefined) {
    resolved.defaultSelectedKey = rawProps.defaultValue
  }
  if (rawProps.value !== undefined && rawProps.id === undefined && typeof rawProps.value === "string") {
    resolved.id = rawProps.value
  }

  // 3. Process every individual property
  for (const [key, value] of Object.entries(rawProps)) {
    // Skip binding helper keys as they are already mapped
    if (key === "bind" || key === "bindChecked") continue

    // Handle Event Handlers (e.g. onPress, onClick, onChange, onValueChange, onSubmit)
    if (key.startsWith("on") && typeof value === "string") {
      resolved[key] = (...args: any[]) => {
        const event = args[0]
        // Auto-prevent default for onSubmit forms
        if (key === "onSubmit" && event && typeof event.preventDefault === "function") {
          event.preventDefault()
        }

        const handlerScope: SandboxContext = {
          ...context,
          event,
          args,
        }

        // Check if value refers to a declared action name (e.g. "submitForm")
        if (context.actions && typeof context.actions[value] === "function") {
          return context.actions[value](...args)
        }

        // Otherwise execute inline script
        return executeScript(value, handlerScope).catch((err) => {
          console.error(`[IrisPage] Error in ${key} handler:`, err)
        })
      }
      continue
    }

    // Handle Slots (props that take a ReactNode or ReactNode[])
    if (isIrisSlot(value)) {
      resolved[key] = renderSubtree(value.$slot)
      continue
    }

    // Handle string interpolation and expressions
    if (typeof value === "string") {
      const trimmed = value.trim()
      // Pure expression: "{{ state.count }}" -> preserves native type (number, bool, object)
      if (trimmed.startsWith("{{") && trimmed.endsWith("}}") && !trimmed.slice(2, -2).includes("{{")) {
        const expr = trimmed.slice(2, -2)
        resolved[key] = evaluateExpression(expr, context)
      } else if (value.includes("{{")) {
        // String template interpolation: "Count: {{ state.count }} items"
        resolved[key] = value.replace(/\{\{(.*?)\}\}/g, (_, expr) => {
          const res = evaluateExpression(expr, context)
          return res != null ? String(res) : ""
        })
      } else {
        resolved[key] = value
      }
      continue
    }

    // Handle nested arrays with slots or expressions
    if (Array.isArray(value)) {
      resolved[key] = value.map((item) => {
        if (isIrisSlot(item)) {
          return renderSubtree(item.$slot)
        }
        if (typeof item === "string" && item.includes("{{")) {
          return item.replace(/\{\{(.*?)\}\}/g, (_, expr) => {
            const res = evaluateExpression(expr, context)
            return res != null ? String(res) : ""
          })
        }
        return item
      })
      continue
    }

    // Passthrough primitives and objects
    resolved[key] = value
  }

  return resolved
}
