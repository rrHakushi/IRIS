import type { IrisChild, IrisNode } from "@/components/iris-page"
import type { NodePath } from "./types"

/**
 * Retrieves a node by its index path in the tree.
 */
export function getNodeByPath(root: IrisNode, path: NodePath): IrisNode | null {
  if (path.length === 0) return root

  let current: IrisNode = root
  for (let i = 0; i < path.length; i++) {
    const idx = path[i]
    if (idx === undefined) return null

    if (!current.children) return null

    if (Array.isArray(current.children)) {
      const child = current.children[idx]
      if (typeof child !== "object" || child === null) return null
      current = child as IrisNode
    } else if (idx === 0 && typeof current.children === "object" && current.children !== null) {
      current = current.children as IrisNode
    } else {
      return null
    }
  }

  return current
}

/**
 * Immutably updates a node at a given path using an updater function.
 */
export function updateNodeByPath(
  root: IrisNode,
  path: NodePath,
  updater: (node: IrisNode) => IrisNode
): IrisNode {
  if (path.length === 0) {
    return updater(root)
  }

  const [head, ...rest] = path
  if (head === undefined) return root

  const clone: IrisNode = { ...root }
  const children = Array.isArray(clone.children)
    ? [...clone.children]
    : clone.children != null
      ? [clone.children]
      : []

  if (head < 0 || head >= children.length) {
    return root
  }

  const targetChild = children[head]
  if (typeof targetChild !== "object" || targetChild === null) {
    return root
  }

  children[head] = updateNodeByPath(targetChild as IrisNode, rest, updater)
  clone.children = children
  return clone
}

/**
 * Immutably inserts a child node into a target parent node.
 */
export function insertChildNode(
  root: IrisNode,
  parentPath: NodePath,
  newNode: IrisNode,
  index?: number
): { newRoot: IrisNode; newPath: NodePath } {
  let insertedIndex = 0

  const newRoot = updateNodeByPath(root, parentPath, (parent) => {
    const parentClone: IrisNode = { ...parent }
    const currentChildren: IrisChild[] = Array.isArray(parentClone.children)
      ? [...parentClone.children]
      : parentClone.children != null
        ? [parentClone.children]
        : []

    if (index !== undefined && index >= 0 && index <= currentChildren.length) {
      currentChildren.splice(index, 0, newNode)
      insertedIndex = index
    } else {
      currentChildren.push(newNode)
      insertedIndex = currentChildren.length - 1
    }

    parentClone.children = currentChildren
    return parentClone
  })

  return {
    newRoot,
    newPath: [...parentPath, insertedIndex],
  }
}

/**
 * Immutably deletes a node at a given path.
 */
export function deleteNodeByPath(
  root: IrisNode,
  path: NodePath
): { newRoot: IrisNode; newPath: NodePath } {
  if (path.length === 0) return { newRoot: root, newPath: [] }

  const parentPath = path.slice(0, -1)
  const targetIndex = path[path.length - 1]
  if (targetIndex === undefined) return { newRoot: root, newPath: [] }

  const newRoot = updateNodeByPath(root, parentPath, (parent) => {
    const parentClone = { ...parent }
    if (!Array.isArray(parentClone.children)) {
      parentClone.children = []
      return parentClone
    }

    const nextChildren = parentClone.children.filter((_, idx) => idx !== targetIndex)
    parentClone.children = nextChildren
    return parentClone
  })

  // Select parent or previous sibling after deletion
  const newPath = targetIndex > 0 ? [...parentPath, targetIndex - 1] : parentPath
  return { newRoot, newPath }
}

/**
 * Immutably duplicates a node at a given path.
 */
export function duplicateNodeByPath(
  root: IrisNode,
  path: NodePath
): { newRoot: IrisNode; newPath: NodePath } {
  if (path.length === 0) return { newRoot: root, newPath: [] }

  const targetNode = getNodeByPath(root, path)
  if (!targetNode) return { newRoot: root, newPath: path }

  // Deep clone target node with new keys
  const clonedNode = JSON.parse(JSON.stringify(targetNode)) as IrisNode
  clonedNode.key = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  const parentPath = path.slice(0, -1)
  const targetIndex = path[path.length - 1]
  const insertIndex = targetIndex !== undefined ? targetIndex + 1 : undefined

  return insertChildNode(root, parentPath, clonedNode, insertIndex)
}

/**
 * Immutably moves a node up or down within its sibling array.
 */
export function moveNodeByPath(
  root: IrisNode,
  path: NodePath,
  direction: "up" | "down"
): { newRoot: IrisNode; newPath: NodePath } {
  if (path.length === 0) return { newRoot: root, newPath: [] }

  const parentPath = path.slice(0, -1)
  const targetIndex = path[path.length - 1]
  if (targetIndex === undefined) return { newRoot: root, newPath: path }

  const targetSwapIndex = direction === "up" ? targetIndex - 1 : targetIndex + 1

  let didSwap = false
  const newRoot = updateNodeByPath(root, parentPath, (parent) => {
    if (!Array.isArray(parent.children)) return parent
    if (targetSwapIndex < 0 || targetSwapIndex >= parent.children.length) return parent

    const children = [...parent.children]
    const temp = children[targetIndex]
    const swapTarget = children[targetSwapIndex]
    if (temp !== undefined && swapTarget !== undefined) {
      children[targetIndex] = swapTarget
      children[targetSwapIndex] = temp
      didSwap = true
    }

    return { ...parent, children }
  })

  return {
    newRoot,
    newPath: didSwap ? [...parentPath, targetSwapIndex] : path,
  }
}

/**
 * Builds breadcrumb representation of the path from root to current node.
 */
export function getNodeBreadcrumbs(
  root: IrisNode,
  path: NodePath
): Array<{ label: string; path: NodePath }> {
  const crumbs: Array<{ label: string; path: NodePath }> = [
    { label: root.type || "Root", path: [] },
  ]

  let current: IrisNode = root
  const runningPath: number[] = []

  for (const idx of path) {
    runningPath.push(idx)
    if (!current.children) break

    if (Array.isArray(current.children)) {
      const child = current.children[idx]
      if (typeof child === "object" && child !== null) {
        current = child as IrisNode
        crumbs.push({ label: current.type, path: [...runningPath] })
      } else {
        crumbs.push({ label: String(child), path: [...runningPath] })
        break
      }
    } else {
      break
    }
  }

  return crumbs
}

/**
 * Inserts a node immediately above (before) or under (after) a target node.
 */
export function insertNodeAdjacent(
  root: IrisNode,
  targetPath: NodePath,
  position: "above" | "below",
  newNode: IrisNode
): { newRoot: IrisNode; newPath: NodePath } {
  // If target is root, append or prepend to root children
  if (targetPath.length === 0) {
    const insertIdx = position === "above" ? 0 : (Array.isArray(root.children) ? root.children.length : 1)
    return insertChildNode(root, [], newNode, insertIdx)
  }

  const parentPath = targetPath.slice(0, -1)
  const targetIndex = targetPath[targetPath.length - 1]

  if (targetIndex === undefined) {
    return { newRoot: root, newPath: targetPath }
  }

  const insertIndex = position === "above" ? targetIndex : targetIndex + 1
  return insertChildNode(root, parentPath, newNode, insertIndex)
}

export type SectionPresetType =
  | "12-col-grid"
  | "3-zone-canvas"
  | "4-col-grid"
  | "sidebar-canvas"
  | "split-screen"
  | "fluid-full"
  | "1-col"
  | "2-col"
  | "3-col"
  | "hero"
  | "card-grid"

/**
 * Generates a structured section node with wireframe layouts.
 */
export function createSectionPreset(type: SectionPresetType): IrisNode {
  switch (type) {
    case "12-col-grid":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-12 gap-2 w-full items-start" },
            children: Array.from({ length: 12 }, (_, i) => ({
              type: "div",
              props: { className: "col-span-1 min-h-24 flex flex-col" },
              children: [],
            })),
          },
        ],
      }

    case "3-zone-canvas":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-12 gap-6 w-full items-start" },
            children: [
              {
                type: "div",
                props: { className: "col-span-12 md:col-span-3 space-y-4 min-h-32" },
                children: [],
              },
              {
                type: "div",
                props: { className: "col-span-12 md:col-span-6 space-y-4 min-h-32" },
                children: [],
              },
              {
                type: "div",
                props: { className: "col-span-12 md:col-span-3 space-y-4 min-h-32" },
                children: [],
              },
            ],
          },
        ],
      }

    case "4-col-grid":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-12 gap-4 w-full items-start" },
            children: [
              { type: "div", props: { className: "col-span-12 sm:col-span-6 lg:col-span-3 min-h-24" }, children: [] },
              { type: "div", props: { className: "col-span-12 sm:col-span-6 lg:col-span-3 min-h-24" }, children: [] },
              { type: "div", props: { className: "col-span-12 sm:col-span-6 lg:col-span-3 min-h-24" }, children: [] },
              { type: "div", props: { className: "col-span-12 sm:col-span-6 lg:col-span-3 min-h-24" }, children: [] },
            ],
          },
        ],
      }

    case "sidebar-canvas":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-12 gap-8 w-full items-start" },
            children: [
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-3 space-y-4 min-h-48" },
                children: [],
              },
              {
                type: "div",
                props: { className: "col-span-12 lg:col-span-9 space-y-6 min-h-48" },
                children: [],
              },
            ],
          },
        ],
      }

    case "split-screen":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 w-full items-start" },
            children: [
              { type: "div", props: { className: "w-full space-y-4 min-h-40" }, children: [] },
              { type: "div", props: { className: "w-full space-y-4 min-h-40" }, children: [] },
            ],
          },
        ],
      }

    case "fluid-full":
      return {
        type: "section",
        props: { className: "w-full py-8 px-2 space-y-6 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "w-full min-h-36" },
            children: [],
          },
        ],
      }

    case "1-col":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "w-full" },
            children: [],
          },
        ],
      }

    case "2-col":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-1 md:grid-cols-2 gap-6 w-full" },
            children: [
              { type: "div", props: { className: "w-full min-h-24" }, children: [] },
              { type: "div", props: { className: "w-full min-h-24" }, children: [] },
            ],
          },
        ],
      }

    case "3-col":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-1 md:grid-cols-3 gap-6 w-full" },
            children: [
              { type: "div", props: { className: "w-full min-h-24" }, children: [] },
              { type: "div", props: { className: "w-full min-h-24" }, children: [] },
              { type: "div", props: { className: "w-full min-h-24" }, children: [] },
            ],
          },
        ],
      }

    case "hero":
      return {
        type: "section",
        props: { className: "w-full py-16 text-center space-y-4 border-b border-border/40" },
        children: [
          { type: "Badge", props: { variant: "secondary" }, children: "Feature Announcement" },
          { type: "h1", props: { className: "text-4xl font-bold font-heading tracking-tight" }, children: "Next-Gen Component Engine" },
          { type: "p", props: { className: "text-base text-muted-foreground max-w-xl mx-auto" }, children: "Build dynamic web interfaces directly from JSON with instant wireframe editing." },
          {
            type: "div",
            props: { className: "flex items-center justify-center gap-3 pt-2" },
            children: [
              { type: "Button", props: { variant: "default" }, children: "Explore Features" },
              { type: "Button", props: { variant: "outline" }, children: "View Docs" },
            ],
          },
        ],
      }

    case "card-grid":
      return {
        type: "section",
        props: { className: "w-full py-8 border-b border-border/40" },
        children: [
          {
            type: "div",
            props: { className: "grid grid-cols-1 md:grid-cols-3 gap-6 w-full" },
            children: [
              {
                type: "Card",
                children: [
                  { type: "CardHeader", children: [{ type: "CardTitle", children: "Feature One" }] },
                  { type: "CardContent", children: [{ type: "p", children: "Describe your capability with high fidelity." }] },
                ],
              },
              {
                type: "Card",
                children: [
                  { type: "CardHeader", children: [{ type: "CardTitle", children: "Feature Two" }] },
                  { type: "CardContent", children: [{ type: "p", children: "Seamless reactive binding and Elysia treaty." }] },
                ],
              },
              {
                type: "Card",
                children: [
                  { type: "CardHeader", children: [{ type: "CardTitle", children: "Feature Three" }] },
                  { type: "CardContent", children: [{ type: "p", children: "Automatic wireframe layout inspection." }] },
                ],
              },
            ],
          },
        ],
      }
  }
}
