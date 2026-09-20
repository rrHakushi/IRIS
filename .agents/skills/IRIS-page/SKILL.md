---
name: IRIS-page
description: Comprehensive architecture and schema authoring guide for the IRIS Server-Driven UI (SDUI) component engine (IrisPage). Use whenever creating, modifying, or reviewing documentation pages defined in JSON, authoring IrisPage schemas, embedding Callouts/CodeBlocks/Tabler icons, or using the visual PageBuilder.
---

# IRIS Page — Server-Driven Documentation Engine & Schema Guide

`IrisPage` is the official Server-Driven UI (SDUI) component engine for the IRIS web application (`apps/web`). It is specialized for **documentation, API references, user guides, changelogs, and rich component showcases**, rendering structured pages directly from **declarative JSON AST schemas**.

---

## 1. Golden Rules & Conventions

### 1. Pure AST JSON Documentation Architecture
`IrisPage` focuses purely on **clean typography, documentation components, and layouts**:
- **Zero runtime state machines, computed getters, action evaluators, or JSX sandboxes**.
- Components render directly with standard props, text, and nested children.
- Documentation primitives (`Callout`, `CodeBlock`, `Table`, `Badge`) provide instant visual hierarchy out of the box.

### 2. Pinned Footer & Edit Access
- The Edit Document button is **always positioned at the bottom of the page footer** (`<footer className="mt-auto ...">`), ensuring clean visual separation from the document content.
- Authorized users (e.g. `IRISFlags.ADMINISTRATOR`) can click "Edit Document" to open the in-place **PageBuilder** embedded directly within the layout.

### 3. Full `@workspace/ui` Coverage & Design System Adherence
- Every single component from `@workspace/ui` is available by its string name (e.g. `Button`, `Card`, `CardHeader`, `CardTitle`, `Callout`, `CodeBlock`, `Dialog`, `Tabs`, `Table`, `Badge`, `Progress`, `Switch`, etc.).
- All icons come from `@tabler/icons-react` using `<Icon name="IconName" />` or direct `type: "IconName"`.
- Adhere strictly to [design.md](file:///c:/Users/yki/Documents/GitHub/IRIS/design.md): `aria-rhea` radius scale (`rounded-2xl`), Mauve neutral base, Rose theme accent (`bg-primary`, `text-primary`), and logical CSS properties (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`).

---

## 2. Schema Specification (AST Structure)

An `IrisPage` document is a clean JSON object (`IrisPageSchema`):

```json
{
  "title": "Getting Started with IRIS",
  "description": "Step-by-step documentation guide and tutorial",
  "icon": "IconBook",
  "root": {
    "type": "div",
    "props": { "className": "max-w-4xl mx-auto p-6 space-y-6" },
    "children": [
      {
        "type": "h1",
        "props": { "className": "text-3xl font-bold tracking-tight" },
        "text": "Getting Started"
      },
      {
        "type": "Callout",
        "props": { "variant": "tip", "title": "Quick Tip" },
        "text": "IRIS follows the Mauve neutral and Rose theme accent design specification."
      },
      {
        "type": "CodeBlock",
        "props": {
          "language": "bash",
          "filename": "terminal",
          "code": "pnpm add @IRIS/web @workspace/ui"
        }
      }
    ]
  }
}
```

### Node Anatomy (`IrisNode`)

Each component node supports the following fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `type` | `string` | Component name matching `@workspace/ui`, HTML tag, or Tabler icon. |
| `key` | `string \| number` | Optional React key for list rendering. |
| `props` | `Record<string, any>` | Component properties (Tailwind classes, variants, sizes, slots). |
| `text` | `string` | Direct textual content rendered inside this node. |
| `children` | `IrisNode \| IrisNode[] \| string \| number` | Child node(s) or nested component tree. |

---

## 3. Specialized Documentation Primitives

### 3.1 `Callout`
High-visibility banner for important notes, tips, warnings, and error alerts:

```json
{
  "type": "Callout",
  "props": {
    "variant": "tip", // "info" | "tip" | "warning" | "danger" | "destructive" | "note"
    "title": "Pro Tip"
  },
  "text": "Use keyboard shortcut Ctrl+K to open global search."
}
```

### 3.2 `CodeBlock`
Syntax highlighted code snippet block with filename header and one-click copy button:

```json
{
  "type": "CodeBlock",
  "props": {
    "language": "typescript",
    "filename": "auth.ts",
    "code": "export const auth = {\n  roles: ['ADMIN', 'USER']\n};"
  }
}
```

### 3.3 Slots (`$slot`) — Injecting Elements via Props
Components that accept elements as props (e.g. `action`, `icon`, `trigger`) use `{ "$slot": IrisNode }`:

```json
{
  "type": "CardHeader",
  "props": {
    "action": {
      "$slot": {
        "type": "Badge",
        "props": { "variant": "secondary" },
        "text": "v2.0"
      }
    }
  },
  "children": [
    { "type": "CardTitle", "text": "Feature Overview" }
  ]
}
```

---

## 4. In-Place Page Editor (`PageBuilder`)

Every `IrisPage` automatically provides an **Edit Document** button pinned in the footer for authorized users (e.g. `IRISFlags.ADMINISTRATOR`).
- Clicking "Edit Document" opens the in-place **PageBuilder** embedded directly within the layout.
- Supports **3 focused modes**:
  1. **Visual Builder**: Wireframes, component drag/insert slots, breadcrumb navigation, and node property modals.
  2. **Live Runtime**: Full preview across desktop, tablet, and mobile viewports.
  3. **JSON Schema**: Raw AST schema editor with syntax validation.
- Built-in documentation templates: **Getting Started Guide**, **API Reference**, and **Feature Showcase**.
