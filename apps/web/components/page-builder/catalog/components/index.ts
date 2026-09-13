import type { ComponentPresetItem } from "./types"

export * from "./types"
export { sectionPresets } from "./sections"
export { blockPresets } from "./blocks"
export { typographyPresets } from "./typography"
export { actionPresets } from "./actions"
export { formPresets } from "./forms"
export { feedbackPresets } from "./feedback"

import { sectionPresets } from "./sections"
import { blockPresets } from "./blocks"
import { typographyPresets } from "./typography"
import { actionPresets } from "./actions"
import { formPresets } from "./forms"
import { feedbackPresets } from "./feedback"

/**
 * All pre-built component blocks and section templates available in the builder.
 * To add, edit, or remove component presets, simply modify the category files in this directory.
 */
export const COMPONENT_PRESETS: ComponentPresetItem[] = [
  ...sectionPresets,
  ...blockPresets,
  ...typographyPresets,
  ...actionPresets,
  ...formPresets,
  ...feedbackPresets,
]
