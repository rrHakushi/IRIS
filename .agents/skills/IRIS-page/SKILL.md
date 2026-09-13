---
name: IRIS-page
description: Comprehensive architecture and schema authoring guide for the IRIS Server-Driven UI (SDUI) component engine (IrisPage). Use whenever creating, modifying, or reviewing pages defined in JSON, authoring IrisPage schemas, configuring sandboxed event handlers and expressions, binding state or form controls, embedding React slots/icons, looping over arrays with repeat, or integrating with Elysia Eden Treaty and app providers in IRIS.
---

# IRIS Page — Server-Driven UI (SDUI) Engine & Schema Guide

`IrisPage` is the official Server-Driven UI (SDUI) component engine for the IRIS web application (`apps/web`). It enables rendering entire, highly responsive, bi-directional web pages declared **completely in JSON**, with full access to every component in `@workspace/ui`, isolated JavaScript execution, two-way state bindings, and direct access to Elysia and application providers.

---

## 1. Golden Rules & Conventions

### 1. Zero Hardcoded Markup in Routes
When building an SDUI page, `apps/web/app/<route>/page.tsx` must contain **nothing else** except passing the schema to `<IrisPage>`:

```tsx
"use client"

import { IrisPage } from "@/components/iris-page"
import pageSchema from "./page.json"

export default function MyPage() {
  return <IrisPage schema={pageSchema} />
}
```

### 2. Isolated JavaScript Execution
- All expressions (`{{ ... }}`) and actions (`onPress: ...`) execute inside a **strict Proxy sandbox**.
- Browser globals like `window`, `document`, `eval`, `localStorage`, `cookieStore`, and `fetch` are **strictly blocked**.
- All API communication MUST use the injected Eden Treaty client: `await elysia....`.

### 3. Full `@workspace/ui` Coverage & Design System Adherence
- Every single component from `@workspace/ui` is available by its string name (e.g. `Button`, `Card`, `CardHeader`, `Dialog`, `Tabs`, `TabsList`, `Input`, `Field`, `Avatar`, `Badge`, `Progress`, `Switch`, etc.).
- All icons come from `@tabler/icons-react` using `<Icon name="IconName" />` or direct `type: "IconName"`.
- Adhere strictly to [design.md](file:///c:/Users/yki/Documents/GitHub/IRIS/design.md): `aria-rhea` radius scale (`rounded-2xl`), Mauve neutral base, Rose theme accent (`bg-primary`, `text-primary`), and logical CSS properties (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`).

---

## 2. Schema Specification (AST Structure)

An `IrisPage` document is a structured JSON object (`IrisPageSchema`):

```json
{
  "title": "Page Title",
  "description": "Optional page description",
  "state": {
    "count": 0,
    "userNotes": "Draft"
  },
  "computed": {
    "isOverLimit": "state.count > 10"
  },
  "actions": {
    "increment": "set('count', state.count + 1)",
    "fetchData": "const res = await elysia.user.me.get(); set('profile', res.data);"
  },
  "root": {
    "type": "div",
    "props": { "className": "p-6 max-w-4xl mx-auto space-y-6" },
    "children": []
  }
}
```

### Node Anatomy (`IrisNode`)

Each component node in the schema supports the following fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `type` | `string` | Component name matching `@workspace/ui`, HTML tag, or Tabler icon. Supports dot notation (`Card.Header` or `CardHeader`). |
| `key` | `string \| number` | Optional React key for list rendering. |
| `props` | `Record<string, any>` | Component properties (primitives, expressions, slots, events). |
| `children` | `IrisNode \| IrisNode[] \| string \| number` | Child node(s) or text content. |
| `condition` | `string` | Sandboxed expression. If falsy, the node is omitted from render. |
| `repeat` | `IrisRepeatDescriptor` | Loops over an array in state/context: `{ items: "state.list", as: "item", indexAs: "idx" }`. |

---

## 3. Supported Properties & Syntax

### 3.1 Primitives & Dynamic Expressions
- **Primitives**: Numbers, booleans, arrays, and objects pass through directly.
- **Pure Expression** (`"{{ expr }}"`): Evaluates in sandbox and **preserves native type**:
  ```json
  "props": {
    "disabled": "{{ !state.canSubmit }}",
    "value": "{{ state.progressPercent }}"
  }
  ```
- **String Interpolation** (`"Text {{ expr }} text"`):
  ```json
  "children": "Welcome back, {{ user?.displayName || user?.username || 'Guest' }}!"
  ```

### 3.2 Two-Way State Binding Helpers
`IrisPage` provides declarative bindings to eliminate boilerplate:

| Binding Prop | Description | Generated React Props |
| :--- | :--- | :--- |
| `bind: "state.path"` | Two-way text / form input binding | Sets `value = state.path` and handles `onChange` with `set(path, value)` |
| `bindChecked: "state.path"` | Two-way boolean switch / checkbox binding | Sets `isSelected = state.path` and handles `onChange` with `set(path, boolean)` |

Example:
```json
{
  "type": "Input",
  "props": {
    "bind": "state.searchQuery",
    "placeholder": "Search media..."
  }
}
```

### 3.3 Slots (`$slot`) — Injecting React Nodes via Props
In React, components frequently accept elements as props (e.g. `icon`, `trigger`, `fallback`, `prefix`). In JSON, represent them with `{ "$slot": IrisNode }`:

```json
{
  "type": "Button",
  "props": {
    "variant": "default",
    "onPress": "actions.save()"
  },
  "children": [
    {
      "type": "Icon",
      "props": { "name": "IconDeviceFloppy", "className": "size-4 me-1.5" }
    },
    "Save Changes"
  ]
}
```

Or as an explicit prop slot:
```json
{
  "type": "CardHeader",
  "props": {
    "action": {
      "$slot": {
        "type": "Badge",
        "props": { "variant": "secondary" },
        "children": "Live"
      }
    }
  }
}
```

### 3.4 Automatic Prop Normalization
`IrisPage` automatically normalizes common shadcn and React Aria Components discrepancies:
- `defaultValue` ➔ automatically sets `defaultSelectedKey` for `Tabs` and `Select`.
- `value` ➔ automatically sets `id` for `AccordionItem`, `TabsTrigger`, and `TabsContent`.

---

## 4. Sandboxed JavaScript Environment (`SandboxContext`)

All expressions (`{{ ... }}`) and actions execute in an isolated `Proxy` sandbox.

### 4.1 State Manipulation Functions
Inside any event handler or action, the following helper methods are available:

- **`set(path, value)`**: Immutably updates a nested property.
  ```javascript
  set('count', state.count + 1);
  set('user.preferences.notifications', false);
  ```
- **`toggle(path)`**: Immutably toggles a boolean value.
  ```javascript
  toggle('sidebarOpen');
  ```
- **`push(path, item)`**: Immutably appends an item to an array.
  ```javascript
  push('tasks', { id: Date.now(), title: state.newTitle, done: false });
  ```
- **`remove(path, index)`**: Immutably removes an item at an index.
  ```javascript
  remove('tasks', taskIndex);
  ```
- **`emit(actionName, payload)`**: Triggers the host's `onAction` callback.

### 4.2 Host Context & Provider Bridge
The following host systems are injected directly into the sandbox:

| Identifier | Source | Capabilities |
| :--- | :--- | :--- |
| **`elysia`** | `@/lib/elysia` | Typed Eden Treaty client: `await elysia.user.me.get()`, `await elysia.health.get()` |
| **`user`** | `useUser()` | Current user: `user.id`, `user.username`, `user.displayName`, `user.avatarUrl`, `user.email` |
| **`session`** | `useSession()` | NextAuth session token and auth state |
| **`theme`** | `useTheme()` | Theme info: `theme.theme`, `theme.resolvedTheme`, `theme.setTheme('dark' \| 'light')` |
| **`toast`** | `sonner` | Toast triggers: `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)` |
| **`notifications`** | `useNotifications()` | Notification items, unread counts, action handlers |
| **`sidebar`** | `useSidebar()` | Sidebar layout state |
| **`helpers`** | Safe utilities | `formatDate(d)`, `formatNumber(n)`, `toUpperCase(s)`, `toLowerCase(s)` |

### 4.3 Safe Built-ins Available
`Math`, `Date`, `Number`, `String`, `Boolean`, `Array`, `Object`, `JSON`, `RegExp`, `isNaN`, `parseInt`, `parseFloat`, `encodeURIComponent`, `console`.

---

## 5. Control Flow: Conditionals & Loops

### 5.1 Conditional Rendering (`condition`)
Nodes with a `condition` property evaluate the expression in the sandbox. If false, the node is omitted:

```json
{
  "type": "Alert",
  "condition": "state.clickCount >= 5",
  "props": { "variant": "info" },
  "children": [
    { "type": "AlertTitle", "children": "Milestone Reached!" },
    { "type": "AlertDescription", "children": "You unlocked the achievement with {{ state.clickCount }} clicks." }
  ]
}
```

### 5.2 Array Repeater (`repeat`)
Unrolls any array in context into dynamic UI elements:

```json
{
  "type": "div",
  "repeat": {
    "items": "state.tasks",
    "as": "task",
    "indexAs": "taskIdx"
  },
  "props": { "className": "flex items-center justify-between p-3 rounded-2xl border" },
  "children": [
    {
      "type": "span",
      "props": {
        "className": "text-sm {{ task.done ? 'line-through text-muted-foreground' : '' }}"
      },
      "children": "{{ task.title }}"
    },
    {
      "type": "Button",
      "props": {
        "size": "icon-xs",
        "variant": "ghost",
        "onPress": "remove('tasks', taskIdx); toast.info('Removed task')"
      },
      "children": [
        { "type": "Icon", "props": { "name": "IconTrash", "className": "size-3.5 text-destructive" } }
      ]
    }
  ]
}
```

---

## 6. Component Registry Reference

All components from `@workspace/ui` are available out of the box:

- **Layout & Surfaces**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Separator`, `AspectRatio`, `ScrollArea`, `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`
- **Navigation & Sectioning**: `Tabs`, `TabsList` (`TabList`), `TabsTrigger` (`Tab`), `TabsContent` (`TabPanel`), `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `Pagination`
- **Actions & Controls**: `Button`, `Switch`, `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Slider`, `Toggle`, `ToggleGroup`
- **Form & Input**: `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError`, `Input`, `Textarea`, `InputGroup`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- **Feedback & Status**: `Alert`, `AlertTitle`, `AlertDescription`, `Badge`, `Progress`, `Spinner`, `Skeleton`, `Empty`
- **Overlays & Dialogs**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`, `Drawer`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard`, `Accordion`
- **Icons**: `Icon` (`<Icon name="IconSearch" />`) and direct `Icon*` components
- **Semantic HTML**: `div`, `header`, `main`, `footer`, `section`, `p`, `span`, `h1`-`h6`, `form`, `ul`, `li`

---

## 7. Complete Reference Example

Below is a production-ready example of a full page defined in `page.json`:

```json
{
  "title": "Account Settings",
  "state": {
    "autoSave": true,
    "displayName": "Iuno",
    "themeMode": "dark"
  },
  "actions": {
    "saveProfile": "if (!state.displayName) { toast.error('Name required'); return; } toast.success('Saved profile for ' + state.displayName);"
  },
  "root": {
    "type": "div",
    "props": { "className": "max-w-3xl mx-auto p-6 space-y-6" },
    "children": [
      {
        "type": "Card",
        "children": [
          {
            "type": "CardHeader",
            "children": [
              { "type": "CardTitle", "children": "User Preferences" },
              { "type": "CardDescription", "children": "Manage your profile and theme settings" }
            ]
          },
          {
            "type": "CardContent",
            "props": { "className": "space-y-4" },
            "children": [
              {
                "type": "Field",
                "children": [
                  { "type": "FieldLabel", "children": "Display Name" },
                  {
                    "type": "Input",
                    "props": { "bind": "state.displayName", "placeholder": "Enter display name" }
                  }
                ]
              },
              {
                "type": "div",
                "props": { "className": "flex items-center justify-between pt-2" },
                "children": [
                  {
                    "type": "div",
                    "children": [
                      { "type": "span", "props": { "className": "text-sm font-medium" }, "children": "Automatic Cloud Sync" },
                      { "type": "p", "props": { "className": "text-xs text-muted-foreground" }, "children": "Keep settings synchronized across all devices" }
                    ]
                  },
                  {
                    "type": "Switch",
                    "props": { "bindChecked": "state.autoSave", "aria-label": "Toggle Auto Save" }
                  }
                ]
              },
              {
                "type": "div",
                "props": { "className": "flex items-center justify-end gap-2 pt-4" },
                "children": [
                  {
                    "type": "Button",
                    "props": {
                      "variant": "default",
                      "onPress": "actions.saveProfile()"
                    },
                    "children": [
                      { "type": "Icon", "props": { "name": "IconDeviceFloppy", "className": "size-4 me-1.5" } },
                      "Save Preferences"
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 8. Full Available Space & Layout Conventions

Iris pages dynamically occupy **100% of the space provided by their parent layout**.
- **With App Sidebar** (e.g. within `apps/web/app/(APPS)/...`): Fills the remaining viewport canvas (`flex-1 w-full`).
- **Standalone / Empty Pages** (e.g. `/iris-page-test`): Expands to full screen width.
- **Rule**: Avoid hardcoding `max-w-6xl mx-auto` or fixed widths on outer containers unless intentionally building a narrow modal/dialog. Use `w-full min-h-full flex-1 flex flex-col` and responsive gutters (`px-4 sm:px-6 lg:px-8 py-6`).

---

## 9. In-Place Page Editor & Admin/Owner Access

Each `IrisPage` automatically renders an **Edit Page** button inside the page footer when:
1. The user holds `IRISFlags.ADMINISTRATOR` (or `user.role === 'ADMIN'`).
2. The user is the author or owner of the page (`schema.ownerId === user.id` or `schema.authorId === user.username`).
3. `canEdit={true}` is explicitly passed.

### In-Place Editing (No Redirection)
When "Edit Page" is clicked:
- It **does NOT redirect** away to a blank full-screen `/iris-builder`.
- It dynamically switches `IrisPage` into an **embedded in-place editor right within the current layout and available space**!
- The editor inherits the exact layout container, sidebars, headers, widths, and margins of the host page, giving the user immediate, accurate visual feedback of their available space.
- The persistent right-side properties panel is removed. The canvas occupies 100% of the available width!
- When done, clicking "Exit" or "Save" seamlessly returns to the normal rendered page view.

### Properties Modal on Components
Instead of a cramped sidebar:
- Clicking any component displays a floating action toolbar with an **Edit Properties** button (`IconAdjustments`).
- Double-clicking any component in the canvas immediately opens the **Node Properties Modal**.
- The modal allows configuring:
  - **General & Content**: Text content (with `{{ expression }}` interpolation preview), HTML attributes (`href`, `src`, `alt`), and Tabler icon selector.
  - **Appearance & Styling**: Visual variants (`default`, `secondary`, `outline`, etc.), sizes, and Tailwind CSS classes with quick utility buttons.
  - **State & Binding**: Two-way input bindings (`bind`), boolean bindings (`bindChecked`), and array loops (`repeat`).
  - **Condition**: Visibility rule (`condition`).
  - **Actions & Events**: Event scripts with live **Action Catalog** and quick autocomplete snippets!

---

## 10. Complete Tabler Icons & Vanilla HTML Coverage

### Tabler Icons Universal Coverage
Every single icon in `@tabler/icons-react` (~3,500+) is resolved in O(1) time:
- By component type: `{ "type": "IconHeart" }` or `{ "type": "Sparkles" }`
- By generic Icon node: `{ "type": "Icon", "props": { "name": "chevron-right" } }`
- Case and format insensitive: `IconUser`, `user`, `icon-user`, `IconChevronRight`, `chevron_right`.

### Vanilla HTML Semantic Elements
All standard HTML5 semantic elements can be used directly as node types:
- `div`, `span`, `p`, `h1`-`h6`, `section`, `article`, `header`, `footer`, `nav`, `aside`, `main`
- `img` (with `src`, `alt`)
- `a` (with `href`, `target`)
- `table`, `thead`, `tbody`, `tr`, `th`, `td`
- `video`, `audio`, `iframe`
- `details`, `summary`, `blockquote`, `hr`, `code`, `pre`

---

## 11. Actions Catalog, Autocomplete & Accessing Data from Hooks

### 11.1 Built-in Hooks Automatically Injected into IrisPage Scope
`IrisPage` internally consumes standard host React hooks and exposes their reactive data directly into all expressions (`{{ ... }}`) and action scripts:

| Injected Property | Source Hook | Available Properties & Methods |
| :--- | :--- | :--- |
| `user` | `useUser()` | `user.id`, `user.username`, `user.displayName`, `user.email`, `user.avatarUrl`, `user.permissions` |
| `session` | `useSession()` | `session?.user?.name`, `session?.expires` |
| `theme` | `useTheme()` | `theme.theme`, `theme.resolvedTheme`, `theme.systemTheme`, `theme.setTheme('dark' \| 'light')` |
| `sidebar` | `useSidebar()` | `sidebar.isOpen`, `sidebar.toggleSidebar()`, `sidebar.setOpen(bool)` |
| `notifications` | `useNotifications()` | `notifications.unreadCount`, `notifications.notifications` |
| `elysia` | `edenTreaty` | Full type-safe backend client (e.g. `await elysia.auth.me.get()`) |
| `toast` | `sonner` | `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`, `toast.warning(msg)` |
| `helpers` | Safe Utilities | `helpers.formatDate(d)`, `helpers.formatNumber(n)`, `helpers.toUpperCase(s)` |

#### Examples in JSON:
```json
// In child text:
"children": "Welcome back, {{ user?.displayName || user?.username }}!"

// In button action:
"onPress": "theme.setTheme(theme.resolvedTheme === 'dark' ? 'light' : 'dark'); toast.info('Theme changed');"

// Calling backend API:
"onPress": "const res = await elysia.auth.me.get(); toast.success('Logged in as ' + res.data?.user?.username);"
```

---

### 11.2 Accessing Data from Custom React Hooks
If you have custom React hooks (e.g. React Query `useQuery()`, custom data fetchers, or router hooks) in your page or layout:

#### Method A: Pass Hook Data Down via `initialState`
Pass any custom hook data or reactive state into `initialState`:

```tsx
"use client"

import { IrisPage } from "@/components/iris-page"
import { useMyCustomHook } from "@/hooks/use-my-custom-hook"
import schema from "./schema.json"

export default function MyPage() {
  const { data, isLoading, error } = useMyCustomHook()

  return (
    <IrisPage
      schema={schema}
      initialState={{
        customData: data,
        loading: isLoading,
        error: error?.message,
      }}
    />
  )
}
```

Inside your JSON schema, access the hook data anywhere via `state.customData`:
```json
{
  "type": "div",
  "children": [
    {
      "type": "span",
      "condition": "!state.loading",
      "children": "Data: {{ state.customData?.title }}"
    }
  ]
}
```

#### Method B: Bridge Hook Actions & Mutations via `onAction`
When a button or form inside `IrisPage` needs to call a mutation or method from a custom hook, use `emit()` in the script and handle it in `onAction`:

```tsx
"use client"

import { IrisPage } from "@/components/iris-page"
import { useMutationHook } from "@/hooks/use-mutation-hook"
import { useRouter } from "next/navigation"
import schema from "./schema.json"

export default function MyPage() {
  const { mutateAsync } = useMutationHook()
  const router = useRouter()

  return (
    <IrisPage
      schema={schema}
      onAction={async (actionName, payload) => {
        if (actionName === "submitProfile") {
          await mutateAsync(payload)
        }
        if (actionName === "navigateTo") {
          router.push(payload.url)
        }
      }}
    />
  )
}
```

Inside your JSON schema:
```json
{
  "type": "Button",
  "props": {
    "onPress": "emit('submitProfile', { name: state.name }); emit('navigateTo', { url: '/dashboard' });"
  },
  "children": "Save and Continue"
}
```


