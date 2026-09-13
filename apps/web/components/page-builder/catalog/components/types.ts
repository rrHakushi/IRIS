import type { IrisNode } from "@/components/iris-page"

export interface ComponentPresetItem {
  id: string
  name: string
  category: "sections" | "blocks" | "typography" | "actions" | "forms" | "feedback" | "html" | "icons"
  icon: string // Tabler icon name
  description: string
  getNode: () => IrisNode
}
