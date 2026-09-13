import type { FullUser } from "@/context/user-context"
import type { ElysiaClient } from "@/lib/elysia"
import type { toast } from "sonner"

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

/**
 * Repeat descriptor for unrolling arrays in JSON templates.
 */
export interface IrisRepeatDescriptor {
  /** Path in context to the array, e.g. "state.items" or "user.roles" */
  items: string
  /** Variable name for the item in the loop context (default: "item") */
  as?: string
  /** Variable name for the item index in the loop context (default: "index") */
  indexAs?: string
}

export type IrisChild = IrisNode | string | number

/**
 * AST Node representing a component in the IrisPage JSON schema.
 */
export interface IrisNode {
  /**
   * Component type matching any component in @workspace/ui, HTML tag, or Icon.
   * Supports dot-notation, e.g. "Card.Header" or "CardHeader".
   */
  type: string
  /** Optional key for React list rendering */
  key?: string | number
  /** Properties passed to the component, including event handlers and slots */
  props?: Record<string, IrisPropValue>
  /** Children nodes, strings, or numbers */
  children?: IrisChild | IrisChild[] | null
  /**
   * Optional conditional expression evaluated in the sandbox.
   * If falsy, the node will not be rendered.
   * e.g. "state.count > 5" or "user != null"
   */
  condition?: string
  /**
   * Optional repeater descriptor to loop over an array in state/context.
   */
  repeat?: IrisRepeatDescriptor
}

/**
 * Root Schema defining an entire page rendered by IrisPage.
 */
export interface IrisPageSchema {
  /** Optional page identifier */
  id?: string
  /** Page title metadata */
  title?: string
  /** Page description metadata */
  description?: string
  /** Page owner user ID or identifier */
  ownerId?: string
  /** Page author user ID or identifier */
  authorId?: string
  /** Arbitrary metadata */
  metadata?: Record<string, any>
  /** Initial reactive state for this page instance */
  state?: Record<string, any>
  /** Computed expressions evaluated reactively, e.g. { doubleCount: "state.count * 2" } */
  computed?: Record<string, string>
  /** Named actions that can be invoked via actions.actionName() */
  actions?: Record<string, string>
  /** Root component tree */
  root: IrisNode
}

/**
 * Theme controls provided to the sandbox.
 */
export interface SandboxThemeContext {
  theme?: string
  resolvedTheme?: string
  setTheme: (theme: string) => void
  systemTheme?: "dark" | "light"
}

/**
 * Sandboxed context passed to expressions and script executors.
 * Strictly isolated from browser globals.
 */
export interface SandboxContext {
  /** Page reactive state */
  state: Record<string, any>
  /** Helper to set a nested property: set('user.name', 'Iuno') */
  set: (path: string, value: any) => void
  /** Helper to toggle a boolean property: toggle('isOpen') */
  toggle: (path: string) => void
  /** Helper to append an item to an array: push('items', newItem) */
  push: (path: string, item: any) => void
  /** Helper to remove an item from an array: remove('items', index) */
  remove: (path: string, index: number) => void
  /** Trigger external host action callback: emit('customEvent', payload) */
  emit: (actionName: string, payload?: any) => void
  /** Typed Elysia Eden Treaty client */
  elysia: ElysiaClient
  /** Active user from UserContext */
  user: FullUser | null
  /** Session object from NextAuth */
  session: any
  /** Theme state and setter from next-themes */
  theme: SandboxThemeContext
  /** Sonner toast notification functions */
  toast: typeof toast
  /** Notification context */
  notifications?: any
  /** Sidebar state (e.g. isMobile, open, toggleSidebar) */
  sidebar?: any
  /** User-defined actions declared in the schema */
  actions: Record<string, (...args: any[]) => Promise<any> | any>
  /** Safe standard utility functions */
  helpers: Record<string, Function>
  /** Event payload if invoked within an event handler */
  event?: any
  /** Arguments array if invoked within an action/event handler */
  args?: any[]
  /** Any loop variables (item, index, etc.) */
  [key: string]: any
}
