import * as React from "react"
import type { IrisSlot, IrisPropValue } from "./types"

/**
 * Type guard to check if an object is an IrisSlot descriptor.
 */
export function isIrisSlot(val: any): val is IrisSlot {
  return typeof val === "object" && val !== null && "$slot" in val
}

/**
 * Resolves raw JSON properties into standard React props:
 * - Slots: { $slot: IrisNode } -> React elements
 * - Passthrough pure properties, class names, variants, icons, and texts.
 */
export function resolveProps(
  rawProps: Record<string, IrisPropValue> | undefined,
  renderSubtree: (node: any) => React.ReactNode
): Record<string, any> {
  if (!rawProps) return {}
  const resolved: Record<string, any> = {}

  for (const [key, value] of Object.entries(rawProps)) {
    // Handle Slots (props that take a ReactNode or ReactNode[])
    if (isIrisSlot(value)) {
      resolved[key] = renderSubtree(value.$slot)
      continue
    }

    // Handle nested arrays with slots
    if (Array.isArray(value)) {
      resolved[key] = value.map((item) => {
        if (isIrisSlot(item)) {
          return renderSubtree(item.$slot)
        }
        return item
      })
      continue
    }

    // Passthrough primitives and standard prop objects
    resolved[key] = value
  }

  return resolved
}
