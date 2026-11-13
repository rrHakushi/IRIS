import type { IrisNode, IrisPageSchema } from "@/components/iris-page"

export type BuilderMode = "visual" | "preview" | "code"
export type ViewportMode = "desktop" | "tablet" | "mobile"

/**
 * Path of indexes leading to a specific node in the AST.
 * [] points to root node.
 * [0] points to root.children[0].
 * [0, 2] points to root.children[0].children[2].
 */
export type NodePath = number[]

export type PaletteCategory =
  | "layout"
  | "forms"
  | "typography"
  | "feedback"
  | "media"
  | "advanced"
  | "html"
  | "icons"

export interface PaletteItem {
  id: string
  label: string
  icon: string
  category: PaletteCategory
  description: string
  defaultNode: IrisNode
}

export interface BuilderTemplate {
  id: string
  name: string
  description: string
  icon: string
  schema: IrisPageSchema
}
