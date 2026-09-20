import type { ComponentPresetItem } from "./types"

export * from "./types"
export { docsPresets } from "./docs"
export { sectionPresets } from "./sections"
export { blockPresets } from "./blocks"
export { typographyPresets } from "./typography"
export { formPresets } from "./forms"
export { feedbackPresets } from "./feedback"

import { docsPresets } from "./docs"
import { sectionPresets } from "./sections"
import { blockPresets } from "./blocks"
import { typographyPresets } from "./typography"
import { formPresets } from "./forms"
import { feedbackPresets } from "./feedback"

/**
 * All pre-built component blocks and section templates available in the builder.
 * To add, edit, or remove component presets, simply modify the category files in this directory.
 */
export const COMPONENT_PRESETS: ComponentPresetItem[] = [
  ...docsPresets,
  ...sectionPresets,
  ...blockPresets,
  ...typographyPresets,
  ...formPresets,
  ...feedbackPresets,
]
