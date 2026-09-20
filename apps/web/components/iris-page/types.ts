/**
 * A slot descriptor that enables embedding React components or component trees
 * into component properties (e.g. icon, prefix, fallback, header).
 */
export interface IrisSlot {
  $slot: IrisNode | IrisNode[]
}

/**
 * Supported values for component props in the JSON schema.
 */
export type IrisPropValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | IrisSlot
  | IrisPropValue[]
  | { [key: string]: IrisPropValue }

export type IrisChild = IrisNode | string | number

/**
 * AST Node representing a component in the IrisPage JSON schema.
 * Focused purely on raw components, content, typography, and layout for documentation.
 */
export interface IrisNode {
  /**
   * Component type matching any component in @workspace/ui, HTML tag, or Icon.
   * e.g. "Card", "Button", "h1", "p", "Callout", "CodeBlock", "Table", "IconSparkles"
   */
  type: string
  /** Optional key for React list rendering */
  key?: string | number
  /** Properties passed directly to the component */
  props?: Record<string, any>
  /** Children nodes, strings, or numbers */
  children?: IrisChild | IrisChild[] | null
  /** Direct text content (convenience helper for typography nodes) */
  text?: string
}

/**
 * Root Schema defining an entire document/page rendered by IrisPage.
 */
export interface IrisPageSchema {
  /** Optional page identifier */
  id?: string
  /** Page title metadata */
  title?: string
  /** Page description metadata */
  description?: string
  /** Page icon name (e.g. "IconBook", "IconFileText") */
  icon?: string
  /** Arbitrary metadata */
  metadata?: Record<string, any>
  /**
   * Root component tree for the document (AST JSON mode).
   */
  root?: IrisNode
}
