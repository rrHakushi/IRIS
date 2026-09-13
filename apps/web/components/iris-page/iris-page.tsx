"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { useUser } from "@/context/user-context"
import { useNotifications } from "@/context/notification-context"
import { SidebarNavigationContext } from "@/components/navigation/sidebar-provider"
import { elysia } from "@/lib/elysia"
import { cn } from "@workspace/ui/lib/utils"

import type {
  IrisNode,
  IrisChild,
  IrisPageSchema,
  SandboxContext,
  SandboxThemeContext,
} from "./types"
import {
  evaluateExpression,
  executeScript,
  getByPath,
  pushByPath,
  removeByPath,
  setByPath,
  toggleByPath,
} from "./sandbox"
import { Button } from "@workspace/ui/components/button"
import { IconPencil } from "@tabler/icons-react"
import { IRISFlags, hasPermission } from "@IRIS/permissions"
import { resolveComponent } from "./registry"
import { resolveProps } from "./resolve-props"
import { IrisErrorBoundary } from "./error-boundary"

const PageBuilder = dynamic(
  () => import("@/components/page-builder").then((mod) => mod.PageBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground animate-pulse">
        Loading IrisPage Builder in current layout...
      </div>
    ),
  }
)

export interface IrisPageProps {
  /** The JSON schema or stringified JSON defining the page */
  schema: IrisPageSchema | string
  /** Optional overrides or initial state */
  initialState?: Record<string, any>
  /** Optional callback for custom actions emitted from inside the page */
  onAction?: (actionName: string, payload?: any) => void
  /** Container class name */
  className?: string
  /** Explicit override for whether the user can edit this page */
  canEdit?: boolean
  /** Whether to show the edit button in the footer when authorized (default: true) */
  showEditButton?: boolean
  /** Custom handler when Edit Page button is clicked */
  onEdit?: () => void
  /** Custom href for Edit button navigation */
  editHref?: string
  /** Callback when schema is saved in in-place editor */
  onSaveSchema?: (updatedSchema: IrisPageSchema) => void
}

export function IrisPage({
  schema: rawSchema,
  initialState,
  onAction,
  className,
  canEdit: propsCanEdit,
  showEditButton = true,
  onEdit,
  editHref,
  onSaveSchema,
}: IrisPageProps) {
  // 1. Parse JSON Schema if passed as a string
  const schema: IrisPageSchema = React.useMemo(() => {
    if (typeof rawSchema === "string") {
      try {
        return JSON.parse(rawSchema)
      } catch (err) {
        console.error("[IrisPage] Invalid JSON schema provided:", err)
        return {
          title: "JSON Error",
          root: {
            type: "Alert",
            props: { variant: "destructive" },
            children: [
              { type: "AlertTitle", children: "Invalid JSON Schema" },
              {
                type: "AlertDescription",
                children: err instanceof Error ? err.message : "Syntax error in JSON string",
              },
            ],
          },
        }
      }
    }
    return rawSchema
  }, [rawSchema])

  // Reactive in-place schema state
  const [activeSchema, setActiveSchema] = React.useState<IrisPageSchema>(schema)
  const [isEditing, setIsEditing] = React.useState(false)

  React.useEffect(() => {
    setActiveSchema(schema)
  }, [schema])

  // 2. Consume Host Providers
  const { user } = useUser()
  const { data: session } = useSession()
  const themeHook = useTheme()
  const notifications = useNotifications()
  const sidebarContext = React.useContext(SidebarNavigationContext)

  // 3. Reactive Page State
  const [state, setState] = React.useState<Record<string, any>>(() => ({
    ...(activeSchema.state || {}),
    ...(initialState || {}),
  }))

  // Re-sync when schema or initialState changes
  React.useEffect(() => {
    setState((prev) => ({
      ...(activeSchema.state || {}),
      ...prev,
      ...(initialState || {}),
    }))
  }, [activeSchema.state, initialState])

  // State mutation helpers
  const set = React.useCallback((path: string, value: any) => {
    setState((prev) => setByPath(prev, path, value))
  }, [])

  const toggle = React.useCallback((path: string) => {
    setState((prev) => toggleByPath(prev, path))
  }, [])

  const push = React.useCallback((path: string, item: any) => {
    setState((prev) => pushByPath(prev, path, item))
  }, [])

  const remove = React.useCallback((path: string, index: number) => {
    setState((prev) => removeByPath(prev, path, index))
  }, [])

  const emit = React.useCallback(
    (actionName: string, payload?: any) => {
      onAction?.(actionName, payload)
    },
    [onAction]
  )

  // Track client hydration to prevent SSR mismatch
  const [isMounted, setIsMounted] = React.useState(false)
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Safe theme context object for sandbox with SSR hydration safety
  const themeContext: SandboxThemeContext = React.useMemo(
    () => ({
      theme: isMounted ? themeHook.theme : "dark",
      resolvedTheme: isMounted ? themeHook.resolvedTheme : "dark",
      systemTheme: themeHook.systemTheme,
      setTheme: (t: string) => themeHook.setTheme(t),
    }),
    [themeHook, isMounted]
  )

  // 4. Build base Sandbox Context
  const baseContext: SandboxContext = React.useMemo(() => {
    const ctx: SandboxContext = {
      state,
      set,
      toggle,
      push,
      remove,
      emit,
      elysia,
      user,
      session,
      theme: themeContext,
      toast,
      notifications,
      sidebar: sidebarContext,
      actions: {},
      helpers: {
        formatDate: (d: string | number | Date) => new Date(d).toLocaleDateString(),
        formatNumber: (n: number) => new Intl.NumberFormat().format(n),
        toUpperCase: (s: string) => String(s).toUpperCase(),
        toLowerCase: (s: string) => String(s).toLowerCase(),
      },
    }

    // Build registered schema actions
    if (schema.actions) {
      for (const [actionName, script] of Object.entries(schema.actions)) {
        ctx.actions[actionName] = async (...args: any[]) => {
          const actionScope = { ...ctx, args }
          return executeScript(script, actionScope)
        }
      }
    }

    // Evaluate computed values
    if (schema.computed) {
      for (const [computedName, expr] of Object.entries(schema.computed)) {
        try {
          ctx[computedName] = evaluateExpression(expr, ctx)
        } catch {
          ctx[computedName] = undefined
        }
      }
    }

    return ctx
  }, [state, set, toggle, push, remove, emit, user, session, themeContext, notifications, sidebarContext, schema.actions, schema.computed])

  // 5. Recursive Subtree Rendering
  const renderSubtree = React.useCallback(
    (
      node: import("./types").IrisChild | import("./types").IrisChild[] | null | undefined,
      currentScope: SandboxContext = baseContext
    ): React.ReactNode => {
      if (node == null) return null

      // Handle raw strings (with dynamic interpolation e.g. "Hello {{ user.username }}")
      if (typeof node === "string") {
        if (node.includes("{{")) {
          return node.replace(/\{\{(.*?)\}\}/g, (match, expr) => {
            const res = evaluateExpression(expr, currentScope)
            return res != null ? String(res) : match
          })
        }
        return node
      }

      // Handle raw numbers
      if (typeof node === "number") {
        return node
      }

      // Handle Arrays of nodes
      if (Array.isArray(node)) {
        return node.map((child, idx) => (
          <React.Fragment key={typeof child === "object" && child?.key != null ? child.key : idx}>
            {renderSubtree(child, currentScope)}
          </React.Fragment>
        ))
      }

      // 1. Condition evaluation
      if (node.condition) {
        const isVisible = evaluateExpression(node.condition, currentScope)
        if (!isVisible) return null
      }

      // 2. Repeater loop unrolling: `repeat: { items: "state.todos", as: "todo" }`
      if (node.repeat) {
        const { items: itemsExpr, as = "item", indexAs = "index" } = node.repeat
        let list = getByPath(currentScope, itemsExpr)
        if (list == null) {
          list = evaluateExpression(itemsExpr, currentScope)
        }

        if (!Array.isArray(list)) return null

        return list.map((item, idx) => {
          const itemScope: SandboxContext = {
            ...currentScope,
            [as]: item,
            [indexAs]: idx,
          }
          const itemKey = item?.id ?? item?.key ?? `${node.key || "repeat"}-${idx}`
          const nodeWithoutRepeat = { ...node, repeat: undefined, key: itemKey }
          return (
            <React.Fragment key={itemKey}>
              {renderSubtree(nodeWithoutRepeat, itemScope)}
            </React.Fragment>
          )
        })
      }

      // 3. Resolve Component
      const Component = resolveComponent(node.type)
      if (!Component) {
        console.warn(`[IrisPage] Component "${node.type}" is not registered in COMPONENT_REGISTRY.`)
        return (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive font-mono my-1">
            <span>Unknown component: <strong>{node.type}</strong></span>
          </div>
        )
      }

      // 4. Resolve Props and Slots
      const resolvedProps = resolveProps(node.props, currentScope, (slotNode) =>
        renderSubtree(slotNode, currentScope)
      )

      // 5. Recursively render children
      const renderedChildren = renderSubtree(node.children, currentScope)

      return (
        <IrisErrorBoundary key={node.key} fallbackNodeName={node.type}>
          {React.createElement(Component, { key: node.key, ...resolvedProps }, renderedChildren)}
        </IrisErrorBoundary>
      )
    },
    [baseContext]
  )

  // 6. Admin / Owner check and edit handler
  const isAdmin = React.useMemo(() => {
    if (!user) return false
    if (user.role === "ADMIN" || user.isAdmin === true) return true
    if (Array.isArray(user.permissions)) {
      try {
        return hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
      } catch {
        return false
      }
    }
    return false
  }, [user])

  const isOwner = React.useMemo(() => {
    if (!user) return false
    const owner =
      activeSchema.ownerId ||
      activeSchema.authorId ||
      activeSchema.metadata?.ownerId ||
      activeSchema.metadata?.authorId
    if (!owner) return false
    return owner === user.id || owner === user.username
  }, [user, activeSchema])

  const canEdit = propsCanEdit ?? (isAdmin || isOwner)

  const handleEdit = React.useCallback(() => {
    if (onEdit) {
      onEdit()
      return
    }
    if (editHref) {
      window.location.href = editHref
      return
    }
    // Default: Open editor in-place directly on this page so real layout space is preserved!
    setIsEditing(true)
  }, [onEdit, editHref])

  // In-Place Editor Mode (mounted inside exact container)
  if (isEditing) {
    return (
      <div
        className={cn("flex flex-col min-h-full w-full flex-1", className)}
        suppressHydrationWarning
      >
        <PageBuilder
          embedded={true}
          initialSchema={activeSchema}
          onExit={() => setIsEditing(false)}
          onSave={(updated) => {
            setActiveSchema(updated)
            onSaveSchema?.(updated)
            setIsEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn("flex flex-col min-h-full w-full flex-1", className)}
      suppressHydrationWarning
    >
      {activeSchema.title && <h1 className="sr-only">{activeSchema.title}</h1>}
      <div className="flex-1 w-full">
        <IrisErrorBoundary fallbackNodeName="IrisPageRoot">
          {renderSubtree(activeSchema.root)}
        </IrisErrorBoundary>
      </div>

      {/* Page Footer with Admin / Owner Edit Button */}
      {canEdit && showEditButton !== false && (
        <footer className="mt-auto w-full border-t border-border/40 bg-card/40 backdrop-blur-xs px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-foreground">{activeSchema.title || "IrisPage"}</span>
            <span className="hidden sm:inline text-muted-foreground">• Server-Driven UI</span>
            {isAdmin && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-medium border border-primary/20">
                Admin
              </span>
            )}
            {isOwner && !isAdmin && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground font-medium border border-border/60">
                Owner
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onPress={handleEdit}
            className="gap-2 rounded-xl text-xs font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
            aria-label="Edit this Iris Page in Page Builder"
          >
            <IconPencil className="size-3.5 text-primary" />
            <span>Edit Page</span>
          </Button>
        </footer>
      )}
    </div>
  )
}
