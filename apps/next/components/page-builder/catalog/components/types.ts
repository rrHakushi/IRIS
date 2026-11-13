import type { IrisNode } from "@/components/iris-page"

export interface ComponentPresetItem {
  id: string
  name: string
  category:
  | "docs"
  | "sections"
  | "blocks"
  | "typography"
  | "forms"
  | "feedback"
  | "html"
  | "icons"
  icon: string // Tabler icon name
  description: string
  getNode: () => IrisNode
}
