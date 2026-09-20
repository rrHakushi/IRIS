"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useUser } from "@/context/user-context"
import { IRISFlags, hasPermission } from "@IRIS/permissions"
import { Button } from "@workspace/ui/components/button"
import { IconPencil } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

import type { IrisChild, IrisNode, IrisPageSchema } from "./types"
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
  /** The JSON schema or stringified JSON defining the documentation page */
  schema?: IrisPageSchema | string
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
    return rawSchema || { root: { type: "div", children: [] } }
  }, [rawSchema])

  // Reactive in-place schema state
  const [activeSchema, setActiveSchema] = React.useState<IrisPageSchema>(schema)
  const [isEditing, setIsEditing] = React.useState(false)

  React.useEffect(() => {
    setActiveSchema(schema)
  }, [schema])

  const { user } = useUser()

  // Determine if active user has permission to edit this page
  const canEditPage = React.useMemo(() => {
    if (propsCanEdit !== undefined) return propsCanEdit
    if (!user) return false
    if (user.role === "ADMIN" || user.isAdmin === true) return true
    if (Array.isArray(user.permissions)) {
      return hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
    }
    return false
  }, [propsCanEdit, user])

  // Recursive pure AST Node Renderer
  const renderNode = React.useCallback(
    (node: IrisChild | null | undefined, index?: number): React.ReactNode => {
      if (node == null) return null

      // Direct text / number primitive
      if (typeof node === "string" || typeof node === "number") {
        return node
      }

      const key = node.key != null ? node.key : index

      // Resolve Component Type
      const Component = resolveComponent(node.type)
      if (!Component) {
        console.warn(`[IrisPage] Unrecognized component type: <${node.type}>`)
        return (
          <div
            key={key}
            className="my-1 rounded-md border border-dashed border-destructive/50 bg-destructive/5 p-2 text-xs text-destructive"
          >
            Unknown component: &lt;{node.type}&gt;
          </div>
        )
      }

      // Resolve Slots and Props
      const resolvedProps = resolveProps(node.props, (slotNode: any) =>
        Array.isArray(slotNode)
          ? slotNode.map((s, idx) => renderNode(s, idx))
          : renderNode(slotNode)
      )

      // Resolve Children or Text
      let renderedChildren: React.ReactNode = null
      if (node.text !== undefined) {
        renderedChildren = node.text
      } else if (node.children !== undefined && node.children !== null) {
        if (Array.isArray(node.children)) {
          renderedChildren = node.children.map((child, idx) => renderNode(child, idx))
        } else {
          renderedChildren = renderNode(node.children)
        }
      }

      return (
        <Component key={key} {...resolvedProps}>
          {renderedChildren}
        </Component>
      )
    },
    []
  )

  // 1. In-Place Visual Builder Mode
  if (isEditing) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden min-h-[600px] w-full">
        <PageBuilder
          initialSchema={activeSchema}
          embedded={true}
          onExit={() => setIsEditing(false)}
          onSave={(updated) => {
            setActiveSchema(updated)
            setIsEditing(false)
            if (onSaveSchema) {
              onSaveSchema(updated)
            }
          }}
        />
      </div>
    )
  }

  // 2. Pure AST Component Tree Mode with footer at bottom
  return (
    <IrisErrorBoundary>
      <div className={cn("relative flex w-full flex-col min-h-full", className)}>
        {/* Main Content Area */}
        <div className="w-full flex-1">
          {activeSchema.root ? renderNode(activeSchema.root) : null}
        </div>

        {/* Footer always at the bottom of the page */}
        {showEditButton && canEditPage && (
          <footer className="mt-auto w-full pt-10 pb-8 border-t border-border/40 flex items-center justify-between shrink-0 px-4 md:px-8">
            <div className="text-xs text-muted-foreground">
              {activeSchema.title && (
                <span className="font-semibold text-foreground/80">{activeSchema.title}</span>
              )}
              {activeSchema.description && (
                <span className="hidden sm:inline opacity-70"> — {activeSchema.description}</span>
              )}
            </div>

            <Button
              size="xs"
              variant="outline"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground ms-auto shadow-xs"
              onPress={() => {
                if (onEdit) onEdit()
                else if (editHref) window.location.href = editHref
                else setIsEditing(true)
              }}
            >
              <IconPencil className="size-3.5" />
              <span>Edit Document</span>
            </Button>
          </footer>
        )}
      </div>
    </IrisErrorBoundary>
  )
}
